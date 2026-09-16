// 钉住「一键同步必须重试未推送的提交」。
//
// 背景：原先的条件是 `if (c.committed && options.gitPush)` —— 只有本次产生了
// 新提交才推送。于是「推送失败 → 提交留在本地 → 再点一键同步」会因为
// committed=false 而永不重试，还报 ok:true，属于静默空操作。
//
// 环境完全隔离：临时 DSH_HOME + 临时 bare 仓库当 origin，不碰真实 ~/.dsh。
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN = fileURLToPath(new URL('..', import.meta.url));

let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  [ok]   ${label}`); }
  else { fail++; console.log(`  [FAIL] ${label} ${extra}`); }
};
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-pushretry-'));
try {
  // ── 造环境 ────────────────────────────────────────────────────────────
  const home = path.join(TMP, 'home');
  const origin = path.join(TMP, 'origin.git');
  const work = path.join(TMP, 'work');
  fs.mkdirSync(home, { recursive: true });          // 故意留空：白名单里一个文件都没有

  git(TMP, ['init', '-q', '--bare', '-b', 'main', origin]);
  git(TMP, ['clone', '-q', origin, work]);
  git(work, ['config', 'user.email', 't@t.t']);
  git(work, ['config', 'user.name', 'test']);
  git(work, ['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(work, 'seed.txt'), 'seed\n');
  git(work, ['add', '-A']);
  git(work, ['commit', '-q', '-m', 'seed']);
  git(work, ['push', '-q', '-u', 'origin', 'main']);

  check('起始状态：origin 有 1 个提交', git(origin, ['rev-list', '--count', 'main']) === '1');
  check('起始状态：本地已无未推送提交', git(work, ['rev-list', '--count', '@{u}..HEAD']) === '0');

  // 模拟「上一次推送失败」：本地多出一个提交，origin 上还没有。
  fs.writeFileSync(path.join(work, 'left.txt'), 'left behind\n');
  git(work, ['add', '-A']);
  git(work, ['commit', '-q', '-m', 'previous push failed']);
  check('模拟推送失败后：本地领先 1 个提交', git(work, ['rev-list', '--count', '@{u}..HEAD']) === '1');
  check('模拟推送失败后：origin 仍只有 1 个提交', git(origin, ['rev-list', '--count', 'main']) === '1');

  // ── 驱动真实路由 ──────────────────────────────────────────────────────
  process.env.DSH_HOME = home;
  const mod = await import(`file:///${PLUGIN.replace(/\\/g, '/')}/lib/index.js`);
  let route = null;
  mod.apply({ effect: (fn) => fn(), webServer: { register: (r) => { route = r; } } }, { repoDir: work });

  const call = (method, url) => new Promise((resolve) => {
    const req = { method, url, headers: {} };
    const res = {
      statusCode: 0,
      setHeader() {},
      end(body) { resolve({ status: this.statusCode, body: JSON.parse(body) }); },
    };
    route.handler(req, res);
  });

  console.log('\n=== 一键同步（本机无变更，但本地有未推送提交）===');
  const r = await call('POST', '/dsh-git-sync/api/run?action=pull&gitPush=1');
  const logText = (r.body.log || []).join('\n');
  console.log('    返回日志：');
  for (const line of r.body.log || []) console.log(`      ${line}`);

  check('动作报告 ok', r.body.ok === true, JSON.stringify(r.body.ok));
  check('本机确实没有变更可提交', logText.includes('没有变更'), logText.slice(0, 120));
  check('★ 未推送的提交被补推上去（origin 现有 2 个提交）',
    git(origin, ['rev-list', '--count', 'main']) === '2',
    `origin 实际 ${git(origin, ['rev-list', '--count', 'main'])} 个`);
  check('★ 本地已与远端一致', git(work, ['rev-list', '--count', '@{u}..HEAD']) === '0');
  check('★ 日志如实说明推送了 1 个提交', /已推送\s*1\s*个提交/.test(logText), logText);

  console.log('\n=== 再点一次（此时确实无事可做）===');
  const r2 = await call('POST', '/dsh-git-sync/api/run?action=pull&gitPush=1');
  const log2 = (r2.body.log || []).join('\n');
  check('仍然 ok', r2.body.ok === true);
  check('不谎称推送了东西', !/已推送\s*\d+\s*个提交/.test(log2), log2);
  check('明确说没有需要推送的提交', log2.includes('没有需要推送'), log2);

  console.log('\n=== 放行的白名单 .bak 必须能通过提交前复查 ===');
  // 四层防御（白名单 / testForbidden / .gitignore / 提交前复查）必须共用同一份
  // 例外。曾经前三层放行、第四层用 SECRET_NAME_RE 把它判为疑似密钥而中止提交。
  const bakRel = 'profiles/web/cordis.patch.yml.bak-plugin-manager';
  fs.mkdirSync(path.join(home, 'profiles', 'web'), { recursive: true });
  fs.writeFileSync(path.join(home, bakRel), '# plugin manager backup\n');

  const r3 = await call('POST', '/dsh-git-sync/api/run?action=pull&gitPush=1');
  const log3 = (r3.body.log || []).join('\n');
  console.log('    返回日志：');
  for (const line of r3.body.log || []) console.log(`      ${line}`);

  check('★ 未被提交前复查误拦', r3.body.ok === true, log3);
  check('★ 未被判为疑似密钥文件', !log3.includes('疑似密钥文件'), log3);
  check('★ 确实产生了提交', log3.includes('已提交'), log3);
  check('★ 该 bak 已被 git 跟踪', git(work, ['ls-files', '--', bakRel]) === bakRel);
  check('★ 已推送到远端', git(origin, ['ls-tree', '-r', '--name-only', 'main']).includes(bakRel));
} catch (e) {
  fail++;
  console.log(`  [FAIL] 测试自身抛错：${e.message}`);
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}

console.log(`\n────────────  通过 ${pass} / 失败 ${fail}  ────────────`);
process.exit(fail ? 1 : 0);