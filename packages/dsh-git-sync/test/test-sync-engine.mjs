// dsh-git-sync 同步引擎测试：白名单覆盖 + 单文件失败不阻断。
// 先写测试（红）→ 实现（绿）。
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, chmodSync, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const PLUGIN = fileURLToPath(new URL('../lib/index.js', import.meta.url));
const TMP = path.join(os.tmpdir(), 'dsh-engine-tmp');

let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  [ok]   ${label}`); }
  else { fail++; console.log(`  [FAIL] ${label} ${extra}`); }
};

const mod = await import(`file:///${PLUGIN.replace(/\\/g, '/')}`);
const { WHITE_LIST, copyToRepo } = mod;

console.log('=== 1. 白名单必须覆盖 skills（当前缺口）===');
check('WHITE_LIST 含 skills', WHITE_LIST.includes('skills'), `实际=${JSON.stringify(WHITE_LIST)}`);
check('白名单仍含 profiles/web/cordis.patch.yml', WHITE_LIST.includes('profiles/web/cordis.patch.yml'));

console.log('\n=== 1b. 模型配置同步范围（含密钥安全）===');
check('白名单含 settings.yaml（模型配置 llm-pi-ai / llm-deepseek / agent-default-model 都在这个文件里）',
  WHITE_LIST.includes('settings.yaml'));
check('白名单含 cordis.patch.yml.bak-plugin-manager（插件管理器配置备份）',
  WHITE_LIST.includes('profiles/web/cordis.patch.yml.bak-plugin-manager'));

// 安全回归：放行了那个 bak 之后，其它 .bak 与密钥文件必须仍然被拒。
const { testForbidden } = mod;
check('放行的 bak 确实不被拒', testForbidden('profiles/web/cordis.patch.yml.bak-plugin-manager') === false);
check('★ 其它 .bak 仍被拒', testForbidden('profiles/web/cordis.patch.yml.bak-something') === true);
check('★ settings.yaml.bak-20260916-llm-audit 仍被拒', testForbidden('settings.yaml.bak-20260916-llm-audit') === true);
check('★ .credentials.yaml 仍被拒（密钥不进仓库）', testForbidden('.credentials.yaml') === true);
check('★ .env 仍被拒', testForbidden('.env') === true);
check('★ 任意 .pem 仍被拒', testForbidden('certs/foo.pem') === true);
check('★ 任意 .key 仍被拒', testForbidden('private.key') === true);
check('★ node_modules 仍被拒', testForbidden('profiles/node_modules/x/index.js') === true);
check('★ 伪造的近似路径不被误放行（必须精确整路径）',
  testForbidden('a/profiles/web/cordis.patch.yml.bak-plugin-manager') === true);

console.log('\n=== 2. 单个文件拷贝失败不得阻断整次同步 ===');
rmSync(TMP, { recursive: true, force: true });
const home = path.join(TMP, 'home');
const repo = path.join(TMP, 'repo');
mkdirSync(path.join(home, 'skills'), { recursive: true });
mkdirSync(path.join(home, 'task-board'), { recursive: true });
mkdirSync(repo, { recursive: true });

writeFileSync(path.join(home, 'settings.yaml'), 'theme: dark\n');
writeFileSync(path.join(home, 'skills', 'core-rules.md'), '# 核心规范\n');
writeFileSync(path.join(home, 'skills', 'tdd.md'), '# TDD\n');
writeFileSync(path.join(home, 'task-board', 'ledger-v2.json'), '{}\n');
writeFileSync(path.join(home, 'skills', 'readonly-case.md'), 'v2-new\n');

const BAD = 'skills\\core-rules.md';
const failingCopy = (src, dst) => {
  if (src.endsWith(BAD)) {
    const e = new Error('EPERM: operation not permitted, copyfile');
    e.code = 'EPERM';
    throw e;
  }
  writeFileSync(dst, readFileSync(src));
};

const result = copyToRepo(home, { repoDir: repo, includeSessions: true, includeAttachments: true }, { copyFile: failingCopy });

check('返回 copied 数组', Array.isArray(result?.copied));
check('返回 skipped 数组', Array.isArray(result?.skipped), `实际=${JSON.stringify(result)}`);
check('坏文件被记入 skipped', result?.skipped?.some((s) => s.path.endsWith('core-rules.md')));
check('skipped 里带错误原因', !!result?.skipped?.[0]?.error?.includes('EPERM'));
check('坏文件不阻断：settings.yaml 已拷', existsSync(path.join(repo, 'settings.yaml')));
check('坏文件不阻断：tdd.md 已拷', existsSync(path.join(repo, 'skills', 'tdd.md')));
check('坏文件不阻断：ledger-v2.json 已拷', existsSync(path.join(repo, 'task-board', 'ledger-v2.json')));
check('坏文件未产生半成品', !existsSync(path.join(repo, 'skills', 'core-rules.md')));
check('copied 计入 4 个成功文件（home 共 5 个，1 个坏）', result?.copied?.length === 4, `copied=${result?.copied?.length}`);

console.log('\n=== 4. Windows 只读目标必须能被覆盖（真正的根因）===');
// 场景：源文件带 ReadOnly 属性，首次拷贝会把它带到目标；之后再拷时
// CopyFileW 会以 ERROR_ACCESS_DENIED(EPERM) 拒绝覆盖只读目标。
const d2 = path.join(repo, 'skills', 'readonly-case.md');
mkdirSync(path.dirname(d2), { recursive: true });
writeFileSync(d2, 'v1-old\n');
chmodSync(d2, 0o444);
check('前置条件：目标确实是只读', (statSync(d2).mode & 0o200) === 0, `mode=${statSync(d2).mode.toString(8)}`);

const r2 = copyToRepo(home, { repoDir: repo, includeSessions: false, includeAttachments: false });
const hitSkip = r2.skipped.some((s) => s.path.endsWith('readonly-case.md'));
check('只读目标不被跳过（应被成功覆盖）', !hitSkip, `skipped=${JSON.stringify(r2.skipped)}`);
check('只读目标内容已更新为最新源内容', readFileSync(d2, 'utf8').trim() === 'v2-new', `实际=${JSON.stringify(readFileSync(d2, 'utf8'))}`);
check('覆盖后目标不再只读（避免下次再撞）', (statSync(d2).mode & 0o200) !== 0);

console.log('\n=== 5. 本机 vs 仓库 差异统计（「待同步」应该是这个）===');
{
  const h2 = path.join(TMP, 'home2');
  const r2 = path.join(TMP, 'repo2');
  mkdirSync(path.join(h2, 'skills'), { recursive: true });
  mkdirSync(path.join(r2, 'skills'), { recursive: true });
  mkdirSync(path.join(h2, 'task-board'), { recursive: true });
  mkdirSync(path.join(r2, 'task-board'), { recursive: true });

  writeFileSync(path.join(h2, 'settings.yaml'), 'same\n');
  writeFileSync(path.join(r2, 'settings.yaml'), 'same\n');
  writeFileSync(path.join(h2, 'skills', 'a.md'), 'aaa\n');
  writeFileSync(path.join(r2, 'skills', 'a.md'), 'aaa\n');
  writeFileSync(path.join(h2, 'skills', 'b.md'), 'new\n');
  writeFileSync(path.join(r2, 'skills', 'b.md'), 'old\n');
  writeFileSync(path.join(h2, 'task-board', 'ledger-v2.json'), '{}\n');
  writeFileSync(path.join(r2, 'skills', 'gone.md'), 'x\n');

  const { diffHomeVsRepo } = mod;
  check('导出 diffHomeVsRepo', typeof diffHomeVsRepo === 'function');
  const d = diffHomeVsRepo(h2, { repoDir: r2, includeSessions: false, includeAttachments: false });
  check('一致的文件不计入差异', !d.changed.includes('settings.yaml') && !d.changed.includes('skills/a.md'));
  check('本机更新的文件计入 changed', d.changed.includes('skills/b.md'), JSON.stringify(d.changed));
  check('本机新增的文件计入 added', d.added.includes('task-board/ledger-v2.json'), JSON.stringify(d.added));
  check('仓库多出的文件计入 removed', d.removed.includes('skills/gone.md'), JSON.stringify(d.removed));
  check('差异总数正确（1 added + 1 changed + 1 removed）', d.added.length + d.changed.length + d.removed.length === 3,
    `added=${d.added.length} changed=${d.changed.length} removed=${d.removed.length}`);
  check('顺带返回仓库与本机文件总数', d.repoFiles === 4 && d.homeFiles === 4, `repo=${d.repoFiles} home=${d.homeFiles}`);
}

console.log('\n=== 3. skills 内容确实会被同步进去 ===');
check('skills/core-rules.md 在白名单覆盖范围内', WHITE_LIST.some((w) => 'skills/core-rules.md' === w || 'skills/core-rules.md'.startsWith(w + '/')));

rmSync(TMP, { recursive: true, force: true });
console.log(`\n────────────  通过 ${pass} / 失败 ${fail}  ───────────`);
process.exit(fail ? 1 : 0);