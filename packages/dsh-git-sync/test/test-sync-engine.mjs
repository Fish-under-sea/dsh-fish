// dsh-git-sync 同步引擎测试：白名单覆盖 + 单文件失败不阻断。
// 先写测试（红）→ 实现（绿）。
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, chmodSync, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const PLUGIN = fileURLToPath(new URL('../lib/index.js', import.meta.url));
const TMP = path.join(os.tmpdir(), 'dsh-engine-tmp');

// 额外扫描根（壁纸引擎）默认落在 ~/.dsh-wallpaper-engine。测试必须把它隔离到临时目录，
// 否则断言里的文件计数会跟着「这台机器上真实存在的那份」飘 —— 那是壁纸引擎自己也遵守的
// 同一套测试隔离约定（DSH_WE_DATA_DIR，见其 lib/index.js 的注释）。
process.env.DSH_WE_DATA_DIR = path.join(TMP, 'we-isolated');

let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  [ok]   ${label}`); }
  else { fail++; console.log(`  [FAIL] ${label} ${extra}`); }
};

const mod = await import(`file:///${PLUGIN.replace(/\\/g, '/')}`);
const { WHITE_LIST, copyToRepo } = mod;
// testForbidden 必须在使用前解构：它是 const，在后面的段里才解构会踩暂时性死区。
const { testForbidden } = mod;

console.log('=== 1. 白名单必须覆盖 skills（当前缺口）===');
check('WHITE_LIST 含 skills', WHITE_LIST.includes('skills'), `实际=${JSON.stringify(WHITE_LIST)}`);
check('profiles 条目不再写死 web（改由 activeList 按 profile 目录动态枚举）',
  !WHITE_LIST.some((w) => w.startsWith('profiles/')));

console.log('\n=== 1a. 白名单必须覆盖 skill-refs（Skill 的 refs / 脚本 / 测试样本）===');
check('WHITE_LIST 含 skill-refs', WHITE_LIST.includes('skill-refs'), `实际=${JSON.stringify(WHITE_LIST)}`);
const coversPath = (rel) => WHITE_LIST.some((w) => rel === w || rel.startsWith(w + '/'));
check('skill-refs 下的脚本被覆盖', coversPath('skill-refs/design-essence/scripts/detect.mjs'));
check('skill-refs 下的 refs 被覆盖', coversPath('skill-refs/design-essence/refs/02-judgments.md'));
check('skill-refs 下的测试样本被覆盖', coversPath('skill-refs/design-essence/tests/samples/good-dashboard.html'));
check('近似前缀不被误判覆盖（skill-other）', !coversPath('skill-other/x.md'));
check('★ skill-refs 下的 .bak 仍被拒', testForbidden('skill-refs/x/old.bak-2026') === true);
check('★ skill-refs 下的 .pem 仍被拒', testForbidden('skill-refs/certs/foo.pem') === true);
check('★ skill-refs 下的 .env 仍被拒', testForbidden('skill-refs/.env') === true);

console.log('\n=== 1b. 模型配置同步范围（含密钥安全）===');
check('白名单含 settings.yaml（模型配置 llm-pi-ai / llm-deepseek / agent-default-model 都在这个文件里）',
  WHITE_LIST.includes('settings.yaml'));
check('白名单不再写死 profiles/web 的 bak（改由路径规则放行）',
  !WHITE_LIST.includes('profiles/web/cordis.patch.yml.bak-plugin-manager'));

// 安全回归：放行了那个 bak 之后，其它 .bak 与密钥文件必须仍然被拒。
check('放行的 bak 确实不被拒', testForbidden('profiles/web/cordis.patch.yml.bak-plugin-manager') === false);
check('★ 任意 profile 的 bak 都被放行（desktop）', testForbidden('profiles/desktop/cordis.patch.yml.bak-plugin-manager') === false);
check('★ 任意 profile 的其它 .bak 仍被拒（desktop）', testForbidden('profiles/desktop/cordis.patch.yml.bak-something') === true);
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

console.log('\n=== 6. 0.2.0 能力收缩：会话与附件永不进仓库 ===');
{
  check('白名单不含 sessions', !WHITE_LIST.includes('sessions'), `实际=${JSON.stringify(WHITE_LIST)}`);
  check('白名单不含 attachments', !WHITE_LIST.includes('attachments'));

  const h3 = path.join(TMP, 'home3');
  const r3 = path.join(TMP, 'repo3');
  mkdirSync(path.join(h3, 'sessions', '--ws--', 'sid-1'), { recursive: true });
  mkdirSync(path.join(h3, 'attachments', 'v1', 'files', 'ab'), { recursive: true });
  mkdirSync(path.join(h3, 'skills'), { recursive: true });
  mkdirSync(r3, { recursive: true });
  writeFileSync(path.join(h3, 'sessions', '--ws--', 'sid-1', 'session.v3.jsonl.zstd'), 'zstd-bytes\n');
  writeFileSync(path.join(h3, 'attachments', 'v1', 'files', 'ab', 'shot.png'), 'png-bytes\n');
  writeFileSync(path.join(h3, 'settings.yaml'), 'theme: dark\n');
  writeFileSync(path.join(h3, 'skills', 'core-rules.md'), '# rules\n');

  const r = copyToRepo(h3, { repoDir: r3 });
  check('会话文件未被拷贝', !existsSync(path.join(r3, 'sessions')), 'sessions/ 不应出现在仓库里');
  check('附件未被拷贝', !existsSync(path.join(r3, 'attachments')), 'attachments/ 不应出现在仓库里');
  check('配置面照常拷贝（settings.yaml）', existsSync(path.join(r3, 'settings.yaml')));
  check('配置面照常拷贝（skills/）', existsSync(path.join(r3, 'skills', 'core-rules.md')));
  check('copied 里不含任何 sessions/attachments 路径',
    !r.copied.some((p) => p.startsWith('sessions') || p.startsWith('attachments')),
    JSON.stringify(r.copied));
  check('旧配置里的 includeSessions=true 不再生效（传了也不拷）',
    (() => {
      const r4 = copyToRepo(h3, { repoDir: r3, includeSessions: true, includeAttachments: true });
      return !existsSync(path.join(r3, 'sessions')) && !r4.copied.some((p) => p.startsWith('sessions'));
    })());
}


console.log('\n=== 7. profile 名不得写死：任意 profile（desktop 等）都在同步范围 ===');
{
  const h4 = path.join(TMP, 'home4');
  const r4 = path.join(TMP, 'repo4');
  const p4 = path.join(h4, 'profiles', 'desktop');
  mkdirSync(path.join(p4, 'node_modules', 'noise'), { recursive: true });
  mkdirSync(r4, { recursive: true });
  writeFileSync(path.join(p4, 'package.json'), '{"name":"dsh-profile-desktop"}\n');
  writeFileSync(path.join(p4, 'cordis.patch.yml'), '- id: desktop-shell\n');
  writeFileSync(path.join(p4, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  writeFileSync(path.join(p4, 'pnpm-workspace.yaml'), 'packages: []\n');
  writeFileSync(path.join(p4, 'node_modules', 'noise', 'index.js'), 'noise\n');

  const { activeList, copyToRepo: ctr, diffHomeVsRepo: dhv } = mod;
  const rel = (p) => p.split(path.sep).join('/');
  check('导出 activeList', typeof activeList === 'function');
  const list = typeof activeList === 'function' ? activeList(h4) : [];
  check('activeList 覆盖 desktop/package.json（装了什么插件）', list.includes('profiles/desktop/package.json'), JSON.stringify(list.filter((x) => x.startsWith('profiles/'))));
  check('activeList 覆盖 desktop/cordis.patch.yml（插件启用状态）', list.includes('profiles/desktop/cordis.patch.yml'));
  check('activeList 覆盖 desktop/pnpm-lock.yaml（精确版本）', list.includes('profiles/desktop/pnpm-lock.yaml'));
  check('activeList 不把 node_modules 卷进来', !list.some((x) => x.includes('node_modules')));

  const r = ctr(h4, { repoDir: r4 });
  check('采集：desktop/package.json 真的进了仓库', existsSync(path.join(r4, 'profiles', 'desktop', 'package.json')));
  check('采集：desktop/cordis.patch.yml 真的进了仓库', existsSync(path.join(r4, 'profiles', 'desktop', 'cordis.patch.yml')));
  check('采集：desktop/node_modules 未进仓库', !existsSync(path.join(r4, 'profiles', 'desktop', 'node_modules')));
  check('采集：copied 里含 profiles/desktop/cordis.patch.yml', r.copied.map(rel).includes('profiles/desktop/cordis.patch.yml'), JSON.stringify(r.copied));

  const d = dhv(h4, { repoDir: r4 });
  check('diff：本机 desktop 的 4 个文件都在本机侧', d.homeFiles === 4, `homeFiles=${d.homeFiles}`);
  check('diff：采集后两边一致，差异为 0', d.added.length + d.changed.length + d.removed.length === 0, JSON.stringify({ added: d.added, changed: d.changed, removed: d.removed }));

  mkdirSync(path.join(r4, 'profiles', 'legacy'), { recursive: true });
  writeFileSync(path.join(r4, 'profiles', 'legacy', 'package.json'), '{}\n');
  const d2 = dhv(h4, { repoDir: r4 });
  check('diff：仓库里的旧 profile 残留记入 removed', d2.removed.includes('profiles/legacy/package.json'), JSON.stringify(d2.removed));
}

console.log('\n=== 8. 设置导航顺序偏好（浏览器 localStorage 的镜像）必须跟着走 ===');
{
  // 这份偏好真正生效的地方是浏览器 localStorage（键 dsh-settings-nav-order/v1），
  // 宿主进程够不着；dsh-settings-nav-order 的宿主半区把它落成这个文件，本插件搬它。
  const NAV = 'dsh-settings-nav-order/state.json';
  check('白名单收录 dsh-settings-nav-order/state.json', WHITE_LIST.includes(NAV), JSON.stringify(WHITE_LIST));
  check('★ 该路径不被任何一道拒绝闸拦下', testForbidden(NAV) === false);
  check('★ 白名单里该目录只有这一条（精确文件，不是整目录）',
    WHITE_LIST.filter((w) => w.startsWith('dsh-settings-nav-order')).length === 1,
    JSON.stringify(WHITE_LIST.filter((w) => w.startsWith('dsh-settings-nav-order'))));

  const h5 = path.join(TMP, 'home5');
  const r5 = path.join(TMP, 'repo5');
  mkdirSync(path.join(h5, 'dsh-settings-nav-order'), { recursive: true });
  mkdirSync(r5, { recursive: true });
  const stateText = JSON.stringify({ enabled: true, order: [{ name: '模型', index: 0 }], hidden: [{ name: '账户', index: 0 }] });
  writeFileSync(path.join(h5, 'dsh-settings-nav-order', 'state.json'), stateText);
  writeFileSync(path.join(h5, 'dsh-settings-nav-order', 'noise.json'), '{}\n');

  const r5res = mod.copyToRepo(h5, { repoDir: r5 });
  const copiedRel = r5res.copied.map((p) => p.split(path.sep).join('/'));
  check('采集：state.json 进了仓库', existsSync(path.join(r5, 'dsh-settings-nav-order', 'state.json')));
  check('采集：copied 里含该相对路径', copiedRel.includes(NAV), JSON.stringify(copiedRel));
  check('采集：同目录的其它文件未被顺带搬运', !existsSync(path.join(r5, 'dsh-settings-nav-order', 'noise.json')));
  check('采集：内容逐字一致（浏览器读的就是这份原文）',
    readFileSync(path.join(r5, 'dsh-settings-nav-order', 'state.json'), 'utf8') === stateText);
  check('diff：采集后两边一致，差异为 0', (() => {
    const d = mod.diffHomeVsRepo(h5, { repoDir: r5 });
    return d.added.length + d.changed.length + d.removed.length === 0;
  })());

  // 还原方向：仓库 → 本机（换机后浏览器半区回填读的就是还原回来的这一份）
  const h6 = path.join(TMP, 'home6');
  mkdirSync(h6, { recursive: true });
  const back = mod.copyToHome(h6, { repoDir: r5 });
  const backRel = (back.copied ?? []).map((p) => p.split(path.sep).join('/'));
  check('还原：state.json 回到本机 home', existsSync(path.join(h6, 'dsh-settings-nav-order', 'state.json')));
  check('还原：copied 里含该相对路径', backRel.includes(NAV), JSON.stringify(backRel));
  check('还原：内容与仓库一致',
    readFileSync(path.join(h6, 'dsh-settings-nav-order', 'state.json'), 'utf8') === stateText);

  // 本机还没保存过偏好时：不该凭空造出目录 —— 否则「待同步」永远差一个文件。
  const h7 = path.join(TMP, 'home7');
  const r7 = path.join(TMP, 'repo7');
  mkdirSync(h7, { recursive: true });
  mkdirSync(r7, { recursive: true });
  const r7res = mod.copyToRepo(h7, { repoDir: r7 });
  check('本机没有该文件时：不造空目录、不写空文件', !existsSync(path.join(r7, 'dsh-settings-nav-order')));
  check('本机没有该文件时：copied 里也不出现',
    !r7res.copied.map((p) => p.split(path.sep).join('/')).includes(NAV), JSON.stringify(r7res.copied));
}

console.log('\n=== 9. 0.2.5 撤下三条 + 0.2.6 再撤一条：预设 / 桌宠存档 / 工作区映射 / 归档台账 ===');
{
  for (const gone of ['.agent-presets', 'pet.json', 'storages/workspace.json', 'dsh-session-archive']) {
    check(`白名单不含 ${gone}`, !WHITE_LIST.includes(gone), JSON.stringify(WHITE_LIST));
    check(`activeList 也不含 ${gone}`, !mod.activeList(TMP).includes(gone));
  }

  // 本机即使有这几样，也不该被采集（免得只改了清单、采集侧还照搬）
  const h8 = path.join(TMP, 'home8');
  const r8 = path.join(TMP, 'repo8');
  mkdirSync(path.join(h8, '.agent-presets', 'liangshen'), { recursive: true });
  mkdirSync(path.join(h8, 'storages'), { recursive: true });
  mkdirSync(path.join(h8, 'dsh-session-archive'), { recursive: true });
  mkdirSync(path.join(h8, 'skills'), { recursive: true });
  mkdirSync(r8, { recursive: true });
  writeFileSync(path.join(h8, '.agent-presets', 'liangshen', 'preset.yml'), 'name: 不该被同步\n');
  writeFileSync(path.join(h8, 'pet.json'), '{"petId":"whale-girl"}\n');
  writeFileSync(path.join(h8, 'storages', 'workspace.json'), '{"workspaces":[]}\n');
  writeFileSync(path.join(h8, 'dsh-session-archive', 'archive-ledger.json'), '{"version":1,"entries":{}}\n');
  writeFileSync(path.join(h8, 'dsh-session-archive', 'state.json'), '{"version":1}\n');
  writeFileSync(path.join(h8, 'settings.yaml'), 'theme: dark\n');
  writeFileSync(path.join(h8, 'skills', 'core-rules.md'), '# rules\n');

  const r8res = mod.copyToRepo(h8, { repoDir: r8 });
  const copied8 = r8res.copied.map((p) => p.split(path.sep).join('/'));
  check('预设未被采集', !existsSync(path.join(r8, '.agent-presets')));
  check('pet.json 未被采集', !existsSync(path.join(r8, 'pet.json')));
  check('workspace.json 未被采集（连 storages 目录都不建）', !existsSync(path.join(r8, 'storages')));
  check('归档台账未被采集', !existsSync(path.join(r8, 'dsh-session-archive')));
  check('copied 里也不含这几条',
    !copied8.some((p) => p.startsWith('.agent-presets') || p === 'pet.json' || p.startsWith('storages')
      || p.startsWith('dsh-session-archive')),
    JSON.stringify(copied8));
  check('其余配置面照常采集（settings.yaml / skills）',
    existsSync(path.join(r8, 'settings.yaml')) && existsSync(path.join(r8, 'skills', 'core-rules.md')));

  // 还原方向同理：仓库里就算留着旧文件，也不该写回本机
  const h9 = path.join(TMP, 'home9');
  mkdirSync(h9, { recursive: true });
  mkdirSync(path.join(r8, '.agent-presets', 'liangshen'), { recursive: true });
  writeFileSync(path.join(r8, '.agent-presets', 'liangshen', 'preset.yml'), 'name: 仓库里的旧预设\n');
  writeFileSync(path.join(r8, 'pet.json'), '{}\n');
  const back9 = mod.copyToHome(h9, { repoDir: r8 });
  check('还原不会把仓库里的旧预设写回本机', !existsSync(path.join(h9, '.agent-presets')));
  check('还原不会把 pet.json 写回本机', !existsSync(path.join(h9, 'pet.json')));
  check('还原 copied 里不含这两条',
    !back9.copied.map((p) => p.split(path.sep).join('/')).some((p) => p.startsWith('.agent-presets') || p === 'pet.json'),
    JSON.stringify(back9.copied));
}

console.log('\n=== 12. 额外扫描根：壁纸引擎数据目录（在 $DSH_HOME 之外）===');
{
  /** 文件不存在时返回空串：红灯阶段要「断言失败」而不是「抛错中断整轮」。 */
  const safeRead = (file) => {
    try { return readFileSync(file, 'utf8'); } catch { return ''; }
  };
  // 白名单口径：额外根在仓库里落成一个同名子目录，所以条目本身带前缀。
  check('★ 白名单含壁纸引擎设置', WHITE_LIST.includes('wallpaper-engine/config.json'), JSON.stringify(WHITE_LIST));
  check('★ 白名单含壁纸引擎玻璃预设目录', WHITE_LIST.includes('wallpaper-engine/glass-presets'));
  check('玻璃预设目录下的文件被覆盖', coversPath('wallpaper-engine/glass-presets/preset-muy3afnl-nq7l.json'));
  // 安全回归：换了个根，排除规则必须一条都不松。
  check('★ 额外根里的 .bak 仍被拒', testForbidden('wallpaper-engine/glass-presets/x.json.bak-1') === true);
  check('★ 额外根里的 .credentials 仍被拒', testForbidden('wallpaper-engine/.credentials.yaml') === true);
  check('★ 额外根里的 .pem 仍被拒', testForbidden('wallpaper-engine/certs/a.pem') === true);
  check('★ 额外根里的 node_modules 仍被拒', testForbidden('wallpaper-engine/node_modules/x/y.js') === true);

  const h10 = path.join(TMP, 'home10');
  const r10 = path.join(TMP, 'repo10');
  const we10 = path.join(TMP, 'we10');
  const prevWe = process.env.DSH_WE_DATA_DIR;
  process.env.DSH_WE_DATA_DIR = we10;
  try {
    mkdirSync(path.join(h10, 'skills'), { recursive: true });
    mkdirSync(path.join(we10, 'glass-presets'), { recursive: true });
    mkdirSync(path.join(we10, 'cache', 'faststart'), { recursive: true });
    mkdirSync(path.join(we10, 'ffmpeg'), { recursive: true });
    mkdirSync(path.join(we10, 'avatars'), { recursive: true });
    mkdirSync(r10, { recursive: true });
    writeFileSync(path.join(h10, 'skills', 'core-rules.md'), '# rules\n');
    writeFileSync(path.join(we10, 'config.json'), '{"settings":{"glassAlpha":80}}\n');
    writeFileSync(path.join(we10, 'glass-presets', 'preset-muy3afnl-nq7l.json'), '{"name":"FISH"}\n');
    writeFileSync(path.join(we10, 'cache', 'faststart', 'fs_x.mp4'), 'binary\n');
    writeFileSync(path.join(we10, 'ffmpeg', 'ffmpeg.exe'), 'binary\n');
    writeFileSync(path.join(we10, 'avatars', 'ai-x.webp'), 'binary\n');
    // 同名陷阱：$DSH_HOME 下也存在一个 wallpaper-engine/，绝不能被当成来源。
    mkdirSync(path.join(h10, 'wallpaper-engine'), { recursive: true });
    writeFileSync(path.join(h10, 'wallpaper-engine', 'config.json'), '{"fromHome":true}\n');

    // 差异比较：先看未同步时的待同步量（3 = skills 1 + 壁纸引擎 2）。
    const diffTotal = (d) => d.added.length + d.changed.length + d.removed.length;
    const diffBefore = mod.diffHomeVsRepo(h10, { repoDir: r10, lastRun: null });
    check('★ 差异比较认得额外根（3 个待同步）', diffTotal(diffBefore) === 3, JSON.stringify(diffBefore));

    const r10res = mod.copyToRepo(h10, { repoDir: r10 });
    const copied10 = r10res.copied.map((p) => p.split(path.sep).join('/'));
    check('★ 壁纸引擎设置被采集到配置仓的 wallpaper-engine/ 下',
      existsSync(path.join(r10, 'wallpaper-engine', 'config.json')));
    check('★ 采集的是额外根那份，不是 $DSH_HOME 同名目录那份',
      safeRead(path.join(r10, 'wallpaper-engine', 'config.json')).includes('glassAlpha'));
    check('★ FISH 玻璃预设被采集',
      existsSync(path.join(r10, 'wallpaper-engine', 'glass-presets', 'preset-muy3afnl-nq7l.json')));
    check('★ cache/ 未被采集（2.8 GB 派生缓存）', !existsSync(path.join(r10, 'wallpaper-engine', 'cache')));
    check('★ ffmpeg/ 未被采集', !existsSync(path.join(r10, 'wallpaper-engine', 'ffmpeg')));
    check('★ avatars/ 未被采集（本轮未纳入）', !existsSync(path.join(r10, 'wallpaper-engine', 'avatars')));
    check('copied 的键以 "/" 分隔且带根前缀',
      copied10.includes('wallpaper-engine/config.json'), JSON.stringify(copied10));
    check('其余配置面照常采集', existsSync(path.join(r10, 'skills', 'core-rules.md')));
    check('采集后待同步归零', diffTotal(mod.diffHomeVsRepo(h10, { repoDir: r10, lastRun: null })) === 0,
      JSON.stringify(mod.diffHomeVsRepo(h10, { repoDir: r10, lastRun: null })));

    // 还原方向：仓库里的两条要写回**额外根**，而不是 $DSH_HOME。
    const h11 = path.join(TMP, 'home11');
    const we11 = path.join(TMP, 'we11');
    mkdirSync(h11, { recursive: true });
    process.env.DSH_WE_DATA_DIR = we11;
    const back11 = mod.copyToHome(h11, { repoDir: r10 });
    check('★ 还原把设置写回额外根',
      existsSync(path.join(we11, 'config.json')), JSON.stringify(back11.copied));
    check('★ 还原把 FISH 预设写回额外根的 glass-presets/',
      existsSync(path.join(we11, 'glass-presets', 'preset-muy3afnl-nq7l.json')));
    check('★ 还原不会在 $DSH_HOME 下造出 wallpaper-engine/',
      !existsSync(path.join(h11, 'wallpaper-engine')));
    check('还原照常写回 skills', existsSync(path.join(h11, 'skills', 'core-rules.md')));
    check('还原后 $DSH_HOME 侧待同步也归零',
      diffTotal(mod.diffHomeVsRepo(h11, { repoDir: r10, lastRun: null })) === 0,
      JSON.stringify(mod.diffHomeVsRepo(h11, { repoDir: r10, lastRun: null })));

    // 额外根不存在（全新机器 / 没装壁纸引擎）：跳过它，其余照常，绝不抛错。
    const h12 = path.join(TMP, 'home12');
    const r12 = path.join(TMP, 'repo12');
    mkdirSync(path.join(h12, 'skills'), { recursive: true });
    mkdirSync(r12, { recursive: true });
    writeFileSync(path.join(h12, 'skills', 'core-rules.md'), '# rules\n');
    process.env.DSH_WE_DATA_DIR = path.join(TMP, 'we-does-not-exist');
    let r12res;
    let threw = false;
    try { r12res = mod.copyToRepo(h12, { repoDir: r12 }); } catch { threw = true; }
    check('★ 额外根不存在时不抛错', threw === false);
    check('额外根不存在时其余条目照常采集', existsSync(path.join(r12, 'skills', 'core-rules.md')));
    check('额外根不存在时不造出 wallpaper-engine/ 目录', !existsSync(path.join(r12, 'wallpaper-engine')));
    check('额外根不存在时 listed 里没有壁纸引擎条目',
      !r12res.copied.map((p) => p.split(path.sep).join('/')).some((p) => p.startsWith('wallpaper-engine/')),
      JSON.stringify(r12res.copied));
  } finally {
    if (prevWe === undefined) delete process.env.DSH_WE_DATA_DIR;
    else process.env.DSH_WE_DATA_DIR = prevWe;
  }
}

console.log('\n=== 13. 免费模型插件（our-free-model）：只搬配置，不搬用量账本与凭据 ===');
{
  const OMF = ['our-free-model/settings.json', 'our-free-model/catalog.json', 'our-free-model/availability.json'];
  for (const rel of OMF) {
    check(`白名单收录 ${rel}`, WHITE_LIST.includes(rel), JSON.stringify(WHITE_LIST));
    check(`★ ${rel} 不被任何一道拒绝闸拦下`, testForbidden(rel) === false);
  }
  // 反向断言：两个必须排除的文件一个都不能被覆盖。
  check('★ 用量账本 stats.json 不在同步范围（本机累计量，跨机会互相覆盖）',
    !coversPath('our-free-model/stats.json'));
  check('★ 凭据 eac-user.json 不在同步范围（含真实 token）',
    !coversPath('our-free-model/eac-user.json'));
  check('★ 凭据 eac-user.json 被拒绝闸独立拦下（纵深防御：白名单被改成整目录也拦得住）',
    testForbidden('our-free-model/eac-user.json') === true);
  // 白名单必须是三条精确文件，不是 'our-free-model' 整目录 —— 整目录会把上面两份一起带走。
  check('★ 白名单里 our-free-model 是三条精确文件，不是整目录',
    WHITE_LIST.filter((w) => w.startsWith('our-free-model')).length === 3,
    JSON.stringify(WHITE_LIST.filter((w) => w.startsWith('our-free-model'))));

  const h13 = path.join(TMP, 'home13');
  const r13 = path.join(TMP, 'repo13');
  mkdirSync(path.join(h13, 'our-free-model'), { recursive: true });
  mkdirSync(r13, { recursive: true });
  const settingsText = JSON.stringify({ enabled: true, defaultMaxTokens: 32768, forward: { enabled: false, key: '' } });
  writeFileSync(path.join(h13, 'our-free-model', 'settings.json'), settingsText);
  writeFileSync(path.join(h13, 'our-free-model', 'catalog.json'), '{"models":["glm-f","kimi-f"]}\n');
  writeFileSync(path.join(h13, 'our-free-model', 'availability.json'), '{"egressIp":"203.0.113.7"}\n');
  // 两个「同目录但在范围外」的文件：真实存在，且必须原地不动。
  writeFileSync(path.join(h13, 'our-free-model', 'stats.json'), '{"days":{"2026-10-10":{"requests":9}}}\n');
  writeFileSync(path.join(h13, 'our-free-model', 'eac-user.json'), '{"token":"SECRET-SHOULD-NOT-TRAVEL"}\n');

  const r13res = mod.copyToRepo(h13, { repoDir: r13 });
  const copied13 = r13res.copied.map((p) => p.split(path.sep).join('/'));
  for (const rel of OMF) {
    check(`采集：${rel} 进了仓库`, existsSync(path.join(r13, ...rel.split('/'))));
    check(`采集：copied 里含 ${rel}`, copied13.includes(rel), JSON.stringify(copied13));
  }
  check('采集：settings.json 内容逐字一致',
    readFileSync(path.join(r13, 'our-free-model', 'settings.json'), 'utf8') === settingsText);
  check('★ 采集：stats.json 未被搬运', !existsSync(path.join(r13, 'our-free-model', 'stats.json')));
  check('★ 采集：eac-user.json 未被搬运', !existsSync(path.join(r13, 'our-free-model', 'eac-user.json')));
  check('★ 采集：copied 里不含 stats.json / eac-user.json',
    !copied13.some((p) => p.endsWith('stats.json') || p.endsWith('eac-user.json')), JSON.stringify(copied13));

  // 差异比较：采集后两边一致。若 stats.json / eac-user.json 被误判为「本机有、仓库没有」，
  // 这里的 added 就会是 2 —— 那正是「面板永远显示待同步 2」的病根。
  check('★ diff：采集后待同步归零（账本与凭据不算缺口）', (() => {
    const d = mod.diffHomeVsRepo(h13, { repoDir: r13 });
    return d.added.length + d.changed.length + d.removed.length === 0;
  })(), JSON.stringify(mod.diffHomeVsRepo(h13, { repoDir: r13 })));

  // 还原方向：换机后这三份配置必须回到 home。
  const h14 = path.join(TMP, 'home14');
  mkdirSync(h14, { recursive: true });
  const back13 = mod.copyToHome(h14, { repoDir: r13 });
  const backRel13 = (back13.copied ?? []).map((p) => p.split(path.sep).join('/'));
  for (const rel of OMF) {
    check(`还原：${rel} 回到本机 home`, existsSync(path.join(h14, ...rel.split('/'))));
    check(`还原：copied 里含 ${rel}`, backRel13.includes(rel), JSON.stringify(backRel13));
  }
  check('还原：settings.json 内容与仓库一致',
    readFileSync(path.join(h14, 'our-free-model', 'settings.json'), 'utf8') === settingsText);
  check('★ 还原：不凭仓库凭空造出 stats.json', !existsSync(path.join(h14, 'our-free-model', 'stats.json')));
  check('★ 还原：不凭仓库凭空造出 eac-user.json', !existsSync(path.join(h14, 'our-free-model', 'eac-user.json')));

  // 本机从未装过该插件时：不该凭空造出目录。
  const h15 = path.join(TMP, 'home15');
  const r15 = path.join(TMP, 'repo15');
  mkdirSync(h15, { recursive: true });
  mkdirSync(r15, { recursive: true });
  const r15res = mod.copyToRepo(h15, { repoDir: r15 });
  check('本机没有该目录时：不造空目录、不写空文件', !existsSync(path.join(r15, 'our-free-model')));
  check('本机没有该目录时：copied 里也不出现',
    !r15res.copied.map((p) => p.split(path.sep).join('/')).some((p) => p.startsWith('our-free-model/')),
    JSON.stringify(r15res.copied));
}

rmSync(TMP, { recursive: true, force: true });
console.log(`\n────────────  通过 ${pass} / 失败 ${fail}  ───────────`);
process.exit(fail ? 1 : 0);