// 钉住「一键同步必须先与远端合并，再推送」。
//
// 背景：本插件的 pull 动作原先只会 push。只要另一台机器往同一个仓库推过东西，
// 本机 push 就被拒（`! [rejected] main -> main (fetch first)`），而面板上没有任何
// 按钮能让本机知道远端发生了什么 —— 用户只能手工进仓库处理。
//
// 三个场景：分叉（本地有未推送提交 + 远端有新提交）、纯落后（可快进）、
// 冲突（必须回滚，不留半合并状态）。
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
const gitSafe = (cwd, args) => {
  try { return git(cwd, args); } catch { return ''; }
};

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-merge-'));
// 壁纸引擎的额外扫描根默认落在 **~/.dsh-wallpaper-engine**，不受 DSH_HOME 影响。
// 不隔离就会读到真机那份，采集内容随机器而变。与 test-sync-engine.mjs 同一套约定。
process.env.DSH_WE_DATA_DIR = path.join(TMP, 'we-isolated');
const mod = await import(`file:///${PLUGIN.replace(/\\/g, '/')}/lib/index.js`);

/** 造一套「origin + 本机 work + 另一台机器 other」的隔离环境。 */
function setupRepo(label) {
  const dir = path.join(TMP, label);
  const origin = path.join(dir, 'origin.git');
  const work = path.join(dir, 'work');
  const other = path.join(dir, 'other');
  const home = path.join(dir, 'home');
  fs.mkdirSync(home, { recursive: true });          // 故意留空：白名单里一个文件都没有

  git(dir, ['init', '-q', '--bare', '-b', 'main', origin]);
  git(dir, ['clone', '-q', origin, work]);
  for (const w of [work]) {
    git(w, ['config', 'user.email', 't@t.t']);
    git(w, ['config', 'user.name', 'test']);
    git(w, ['config', 'commit.gpgsign', 'false']);
  }
  fs.writeFileSync(path.join(work, 'seed.txt'), 'seed\n');
  git(work, ['add', '-A']);
  git(work, ['commit', '-q', '-m', 'seed']);
  git(work, ['push', '-q', '-u', 'origin', 'main']);

  git(dir, ['clone', '-q', origin, other]);          // origin 已有提交后再克隆
  git(other, ['config', 'user.email', 't@t.t']);
  git(other, ['config', 'user.name', 'test']);
  git(other, ['config', 'commit.gpgsign', 'false']);
  return { dir, origin, work, other, home };
}

/** 用真实路由驱动一次动作（每次重新 apply，让 DSH_HOME 重新解析）。 */
function drive(home, work) {
  process.env.DSH_HOME = home;
  let route = null;
  mod.apply({ effect: (fn) => fn(), webServer: { register: (r) => { route = r; } } }, { repoDir: work });
  return (url) => new Promise((resolve) => {
    const req = { method: 'POST', url, headers: {} };
    const res = {
      statusCode: 0,
      setHeader() {},
      end(body) { resolve({ status: this.statusCode, body: JSON.parse(body) }); },
    };
    route.handler(req, res);
  });
}

const printLog = (body) => {
  console.log('    返回日志：');
  for (const line of body.log || []) console.log(`      ${line}`);
};

/** 另一台机器推一个提交上去。 */
function otherMachinePushes(env, file, content, message) {
  fs.writeFileSync(path.join(env.other, file), content);
  git(env.other, ['add', '-A']);
  git(env.other, ['commit', '-q', '-m', message]);
  git(env.other, ['push', '-q', 'origin', 'main']);
}

try {
  // ── 场景 A：分叉（本机有未推送提交，远端也有新提交）────────────────────
  console.log('=== A. 分叉：本机有未推送提交 + 远端有新提交 → 自动重放后推送 ===');
  const A = setupRepo('a');
  otherMachinePushes(A, 'from-other.txt', 'other machine\n', 'from other machine');
  fs.writeFileSync(path.join(A.work, 'local.txt'), 'local\n');
  git(A.work, ['add', '-A']);
  git(A.work, ['commit', '-q', '-m', 'local work']);
  check('A 前置：本机领先 1 个提交', git(A.work, ['rev-list', '--count', '@{u}..HEAD']) === '1');

  const rA = await drive(A.home, A.work)('/dsh-git-sync/api/run?action=pull&gitPush=1');
  const logA = (rA.body.log || []).join('\n');
  printLog(rA.body);
  check('A ★ 动作报告 ok（不再被 fetch first 顶回来）', rA.body.ok === true, logA);
  check('A ★ 日志说明自动把本机提交重放到远端之上', /重放到远端之上/.test(logA), logA);
  const filesA = git(A.origin, ['ls-tree', '-r', '--name-only', 'main']).split('\n');
  check('A ★ 远端同时含两台机器的文件', filesA.includes('from-other.txt') && filesA.includes('local.txt'), filesA.join(','));
  check('A ★ 本地与远端完全一致',
    git(A.work, ['rev-list', '--count', '@{u}..HEAD']) === '0' && git(A.work, ['rev-list', '--count', 'HEAD..@{u}']) === '0');
  check('A ★ 历史保持线性（没有冒出来的 merge 提交）', git(A.work, ['rev-list', '--count', '--merges', 'HEAD']) === '0');
  check('A：其它机器那个提交的改动也在本地（README 类文件没被丢掉）',
    fs.existsSync(path.join(A.work, 'from-other.txt')));

  // ── 场景 B：纯落后（本机无提交，可直接快进）──────────────────────────
  console.log('\n=== B. 纯落后：远端有新提交、本机没有 → 快进合并 ===');
  const B = setupRepo('b');
  otherMachinePushes(B, 'from-other.txt', 'other machine\n', 'from other machine');
  const rB = await drive(B.home, B.work)('/dsh-git-sync/api/run?action=pull&gitPush=1');
  const logB = (rB.body.log || []).join('\n');
  printLog(rB.body);
  check('B ★ 动作报告 ok', rB.body.ok === true, logB);
  check('B ★ 日志说明走了快进合并', /已快进合并/.test(logB), logB);
  check('B ★ 本地已经拿到远端的文件', fs.existsSync(path.join(B.work, 'from-other.txt')));
  check('B ★ 无未推送提交', git(B.work, ['rev-list', '--count', '@{u}..HEAD']) === '0');

  // ── 场景 C：冲突（必须回滚，不留半合并状态）──────────────────────────
  console.log('\n=== C. 冲突：两边改同一文件 → 回滚并报失败，不留半合并状态 ===');
  const C = setupRepo('c');
  fs.writeFileSync(path.join(C.work, 'seed.txt'), 'local version\n');
  git(C.work, ['add', '-A']);
  git(C.work, ['commit', '-q', '-m', 'local change']);
  otherMachinePushes(C, 'seed.txt', 'remote version\n', 'remote change');
  const headBefore = git(C.work, ['rev-parse', 'HEAD']);

  const rC = await drive(C.home, C.work)('/dsh-git-sync/api/run?action=pull&gitPush=1');
  const logC = (rC.body.log || []).join('\n');
  printLog(rC.body);
  check('C ★ 动作报告失败（不谎报成功）', rC.body.ok === false, logC);
  check('C ★ 日志说明自动合并失败并给出人工指引',
    /自动合并失败/.test(logC) && /git pull --rebase/.test(logC), logC);
  check('C ★ 仓库已回滚：没有半合并残留（工作区干净）',
    git(C.work, ['status', '--porcelain']) === '', JSON.stringify(git(C.work, ['status', '--porcelain'])));
  check('C ★ HEAD 未被改动（本机提交原样保留）', git(C.work, ['rev-parse', 'HEAD']) === headBefore);
  check('C：没有把半成品推上去', !git(C.origin, ['ls-tree', '-r', '--name-only', 'main']).includes('local version'));

  // ── 场景 D：应急通道 pushgit 同样不能被 fetch first 卡住 ──────────────
  console.log('\n=== D. 应急通道 pushgit：远端有新提交时也要先合并再推送 ===');
  const D = setupRepo('d');
  otherMachinePushes(D, 'from-other.txt', 'other machine\n', 'from other machine');
  fs.writeFileSync(path.join(D.work, 'local.txt'), 'local\n');
  git(D.work, ['add', '-A']);
  git(D.work, ['commit', '-q', '-m', 'local work']);

  const rD = await drive(D.home, D.work)('/dsh-git-sync/api/run?action=pushgit&gitPush=1');
  const logD = (rD.body.log || []).join('\n');
  printLog(rD.body);
  check('D ★ pushgit 报告 ok（自动合并后推送成功）', rD.body.ok === true, logD);
  check('D ★ 远端拿到了本机提交的内容',
    git(D.origin, ['ls-tree', '-r', '--name-only', 'main']).includes('local.txt'));
  check('D ★ 本地与远端一致', git(D.work, ['rev-list', '--count', '@{u}..HEAD']) === '0');
} catch (e) {
  fail++;
  console.log(`  [FAIL] 测试自身抛错：${e.message}`);
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}

console.log(`\n────────────  通过 ${pass} / 失败 ${fail}  ────────────`);
process.exit(fail ? 1 : 0);