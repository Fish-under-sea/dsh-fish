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

rmSync(TMP, { recursive: true, force: true });
console.log(`\n────────────  通过 ${pass} / 失败 ${fail}  ───────────`);
process.exit(fail ? 1 : 0);