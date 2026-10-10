/**
 * dsh-git-sync — 宿主半边。
 *
 * 给 DSH Web GUI 的「设置 → Git 同步」提供一个一键同步面板：把 ~/.dsh 里
 * 值得跨机复原的部分（插件清单、插件启用状态、插件配置、本地设置、会话记录）
 * 采集进一个私有 git 仓库并推送，或从仓库还原到本机。
 *
 * 设计原则：
 *  - 白名单搬运，绝不整目录镜像 —— 密钥文件（.credentials.yaml）永远碰不到。
 *  - 零 npm 依赖：只用 node 内置模块（宿主不导出 Config schema，见 cordis
 *    的 `if (!runtime.Config) return config`）。
 *  - 不做 force push、不重写历史。提交前复查暂存区，发现密钥类文件即中止。
 *
 * @module dsh-git-sync/host
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export const name = 'dsh-git-sync';
// webServer 用来挂同源 API 路由。
export const inject = ['webServer'];

const API_PREFIX = '/dsh-git-sync/api';

/** DSH home：与 @deepseek-ai/dsh-home-paths 的解析口径一致。 */
function resolveHome() {
  const configured = process.env.DSH_HOME;
  if (configured && configured.trim()) return path.resolve(configured.trim());
  return path.join(os.homedir(), '.dsh');
}

/** 统一把路径规整成 `/` 分隔：白名单、仓库键、`.gitignore` 都按这个口径比对。 */
const normRel = (p) => String(p).split(path.sep).join('/');

/**
 * 白名单：相对 DSH home 的路径。换机后需要复原的就在这里面。
 * 与 sync-kit/dsh-sync.ps1 的清单保持一致。
 *
 * 0.2.5 起**不再收录**这三条（本机决定，理由各自独立）：
 *   - `.agent-presets`  —— 不用自定义 agent 预设；
 *   - `pet.json`        —— 桌宠插件没启用，纯死文件；
 *   - `storages/workspace.json` —— 里面是**机器相关的绝对路径**，搬到另一台机器
 *     本来也要手工改，同步它只会带来「换机后工作区指向不存在的位置」的噪声。
 *
 * 0.2.6 起**再撤一条** `dsh-session-archive`（`@linxin666/dsh-session-archive` 的
 * 归档台账与运行状态）：它是**纯本机状态**——记「哪些会话何时被归档」，而会话本身
 * 永久不跨机同步（`sessions/`、`attachments/` 已排除），台账换机后没有意义；
 * 自动归档的**策略**在 `profiles/<profile>/cordis.patch.yml` 里、那份是同步的，
 * 新机器会自己重新记账。此前它还制造了一个假象：它被同步进配置仓，而那份仓库的
 * `.gitignore` 恰好排除了它 —— 于是「复制了却永远不提交」，面板却显示待同步 0。
 *
 * 0.2.7 起**新增** `skill-refs`（Skill 的 refs 判据、可运行脚本与测试样本）：
 * 这些内容原先不进仓库，后果是 Skill 正文跨机复原了、它引用的
 * `$DSH_HOME/skill-refs/...` 却在新机器上不存在 —— 正文里的命令一条都跑不起来
 * （例如 `design-essence` 的 `detect.mjs`、`ai-asset-forge` 的 `routecheck.mjs`）。
 * 该目录只含 md / json / mjs / html，无密钥类文件，无需担心密钥外流。
 *
 * 想恢复同步，把对应那行加回来即可 —— 顺便看一眼 `git log -- <路径>`，
 * 被撤下的内容仍留在本仓历史里。
 */
const WHITE_LIST = [
  'settings.yaml',                    // 全局设置：主题/模型/provider/皮肤
  'skin-center-active.json',
  'skills',                           // Skill 目录（~/.dsh/skills）
  'skill-refs',                       // Skill 的 refs / 脚本 / 测试样本（~/.dsh/skill-refs）
  'AGENTS.md',                        // 用户级全局指令：Skill 加载优先级总表
  'task-board/ledger-v2.json',
  'task-board/scheduler-v2.json',
  'dsh-usage',
  // 设置导航顺序（dsh-settings-nav-order）的顺序 / 隐藏项。
  //
  // 这份偏好真正生效的地方是**浏览器 localStorage**（键 dsh-settings-nav-order/v1），
  // 本插件在宿主进程里够不着它 —— 所以 dsh-settings-nav-order 的宿主半区把它落成这个
  // 文件（用户每次保存时用自己那条同源路由写入），本插件只负责按相对路径搬运。
  // 少了这一条，换机后设置菜单的顺序与隐藏项就复原不了（剩下的都能复原）。
  'dsh-settings-nav-order/state.json',
  // ── our-free-model（omf）的配置面 ──
  //
  // 该目录在 $DSH_HOME **之内**（`$DSH_HOME/our-free-model/`），所以按普通相对路径点名即可，
  // 不需要往 EXTRA_ROOTS 加根。
  //
  // 只点名下面三个文件，**绝不写 'our-free-model' 整目录**：同目录下另有两个文件必须排除 ——
  //   - `stats.json`     用量统计账本（days / models / requests / failedRequests / samples）。
  //                      它是**本机累计量**，两台机器各自累加后互相覆盖，两边的统计都会失真，
  //                      换机后也没有复原价值，所以明确排除。
  //   - `eac-user.json`  含一个**真实的登录 token** 与 GitHub 登录名，属凭据。
  //                      凭据一律不进配置仓（`.credentials.yaml` 同理，由用户用 U 盘手工拷贝）。
  //
  // 收录的三个都是纯配置 / 快照，不含密钥：
  // 注意：settings.json 里 `forward.key` / `egress` / `chanGateway.relay.key` 三个字段目前是
  // **空串**（字段存在、值为空），所以能过下方 SECRET_PATTERNS 的内容级体检；将来真填了密钥，
  // 「体检」动作会如实报出来 —— 那时该由用户决定是走 U 盘还是别的办法，而不是放宽体检。
  'our-free-model/settings.json',     // 用户设置：开关、探测间隔、转发、出口、渠道网关、默认 maxTokens
  'our-free-model/catalog.json',      // 模型目录快照（模型 id 列表 + 时间戳），无密钥
  'our-free-model/availability.json', // 模型可用性快照（出口 IP + 各模型探测结果），无密钥
  // ── 额外扫描根（见上方 EXTRA_ROOTS）：前缀就是根的键，不是 $DSH_HOME 下的路径 ──
  // 壁纸引擎（dsh-plugin-wallpaper-engine）的**全部设置**都在这一个文件里：外观
  //（配色 / 边框 / 雾化 / 玻璃颜色与透明度 / 保真度 / 思考块与左侧栏液态玻璃）、
  // 扩展（自定义会话头像开关与尺寸、点击与拖尾效果）、播放与系统、壁纸库的隐藏与轮播。
  // 它落在 `~/.dsh-wallpaper-engine`，与 $DSH_HOME 同级，普通白名单条目够不到。
  'wallpaper-engine/config.json',
  // 用户保存的玻璃预设（本机是「FISH」）。按**目录**收录而不是点名某个文件：
  // 以后新存的预设自动跟着走；隐藏出厂预设的墓碑标记也是同目录的同名形态文件。
  'wallpaper-engine/glass-presets',
  // `profiles/<profile>/` 下的配置面不在这里写死，见下方 PROFILE_FILES + activeList()。
  //
  // 曾经的写法是 'profiles/web/package.json' 这类字面量：0.2.0 桌面版把 profile
  // 从 web 改名为 desktop 之后，这些条目一条都命中不了 ——「装了什么插件 /
  // 每个插件是否启用 / 精确版本」三样全部没进仓库，只剩 0.1.x 的 web 快照。
];

/**
 * 每个 profile 下值得跨机复原的配置面（相对 profile 目录）。
 *
 * 只列具体文件、绝不整目录：`profiles/<name>/node_modules/` 因此天然被排除。
 */
const PROFILE_FILES = [
  'package.json',                        // 装了什么插件 + bundle 层顺序
  'cordis.patch.yml',                    // 每个插件是否启用（disabled 行）+ 配置覆盖
  'cordis.patch.yml.bak-plugin-manager', // 插件管理器写的配置备份
  'pnpm-lock.yaml',                      // 精确版本，保证可复现
  'pnpm-workspace.yaml',                 // pnpm 配置
];

/**
 * 会话与附件**不再同步**（0.2.0 起的能力收缩）。
 *
 * 原因：二者是只增不减的 zstd 二进制，git 无法 diff、无法行级合并，两台机器
 * 同时改必然冲突；仓库只增不减；且它们是本机隐私数据。同步范围收敛为「配置面」，
 * 换机后靠这一份配置 + 各自的会话副本复原。
 *
 * 历史：0.1.x 时代本清单是 `['sessions', 'attachments']`，由 UI 开关控制。
 * 已提交到仓库的旧会话文件不删除（只停新增）。
 */

/**
 * 永不搬运：路径的任一段命中即拒绝。
 * 这是第一道闸，也是唯一一道「不依赖内容判断」的闸。
 */
const NEVER_COPY = new Set([
  '.credentials.yaml', 'credentials.yaml', 'credentials.json',
  '.env', 'node_modules', '.pnpm', '.git', 'session_projcache',
  '.anonymous-user-id', '.dshw-size.json', '.dshw-usage.json',
  'cordis.yml', 'workspace-local-paths.json',
  // our-free-model（omf）的登录凭据：含真实 token 与 GitHub 登录名。
  // 它**本来就不在白名单里**，这里再拦一道是纵深防御 —— 白名单哪天被改成
  // `'our-free-model'` 整目录（注释里明确警告过不要这么做），这道闸仍然拦得住。
  // 与 `.credentials.yaml` 同理：凭据只走 U 盘，永不进配置仓。
  'eac-user.json',
]);

const SECRET_NAME_RE = /(^|[\\/])(\.credentials|\.env|credentials\.|.*\.pem$|.*\.key$|.*\.bak)/i;

/**
 * 允许同步的 `*.bak*` 例外。
 *
 * 默认规则是「任何含 .bak 的路径一律拒绝」——那是防呆，不是安全需要。
 * 但 `cordis.patch.yml.bak-plugin-manager` 是插件管理器写的配置备份，
 * 换机复原时它有用，所以按**精确整路径**放行。
 *
 * 只放行这一个文件名（profile 段通配），任何其它 .bak 仍然一律拒绝。
 */
const BAK_ALLOW_RE = /^profiles\/[^/]+\/cordis\.patch\.yml\.bak-plugin-manager$/;

/**
 * 唯一的例外判定入口 —— 所有防御层都必须走这里，否则会各自漂移。
 *
 * 曾经踩过：白名单放行 + testForbidden 放行 + .gitignore 反向规则放行，
 * 但提交前复查用的 SECRET_NAME_RE 仍把该文件判为疑似密钥而中止提交。
 * 四层防御「各自为政」的结果就是文件永远进不了提交。
 *
 * 只按**精确整路径**匹配，不做前缀/后缀放宽；传入任意其它路径一律返回 false。
 */
function isBakAllowed(relPath) {
  return BAK_ALLOW_RE.test(String(relPath).split(/[\\/]/).join('/'));
}

function testForbidden(relPath) {
  // 先看例外，且必须是精确整路径匹配（不做前缀/后缀放宽）。
  if (isBakAllowed(relPath)) return false;

  const parts = String(relPath).split(/[\\/]/);
  for (const part of parts) {
    if (NEVER_COPY.has(part)) return true;
    if (/\.bak/i.test(part)) return true;
    if (/^\.credentials/i.test(part)) return true;
    if (/\.pem$/i.test(part) || /\.key$/i.test(part)) return true;
  }
  return false;
}

// ── 运行时设置（可在 UI 里改，存在 home 下，不进仓库） ────────────────────
function statePath(home) {
  return path.join(home, 'dsh-git-sync', 'config.json');
}

function readState(home) {
  try {
    return JSON.parse(fs.readFileSync(statePath(home), 'utf8'));
  } catch {
    return {};
  }
}

function writeState(home, patch) {
  const dir = path.dirname(statePath(home));
  fs.mkdirSync(dir, { recursive: true });
  const next = { ...readState(home), ...patch };
  fs.writeFileSync(statePath(home), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

/** 解析本次要用的设置：插件 config > 状态文件 > 内置默认。 */
function resolveSettings(home, config) {
  const cfg = config ?? {};
  const state = readState(home);
  const repoDir = String(
    state.repoDir || cfg.repoDir || path.join(os.homedir(), 'dsh-config'),
  );
  return {
    repoDir: path.resolve(repoDir),
    lastRun: state.lastRun ?? null,
  };
}

/**
 * 列出某个扫描根下、白名单覆盖的相对路径。
 *
 * 必须**按根动态枚举**：本机与仓库两侧各有自己的 profile 目录（本机是
 * desktop，仓库里可能还留着历史的 web），只有各自枚举，「本机 ↔ 仓库」
 * 的差异才能如实反映。
 *
 * 调用约定：采集传 home（源）、还原传 repoDir（源）、差异比较各传各侧。
 */
function activeList(root) {
  const list = [...WHITE_LIST];
  for (const profile of listProfileDirs(root)) {
    for (const file of PROFILE_FILES) list.push(`profiles/${profile}/${file}`);
  }
  return list;
}

/** 列出 `<root>/profiles` 下的 profile 目录名；读不到就当作一个都没有。 */
function listProfileDirs(root) {
  let entries;
  try {
    entries = fs.readdirSync(path.join(root, 'profiles'), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => entry.name)
    .sort();
}

// ── 扫描根 ────────────────────────────────────────────────────────────
/**
 * 额外扫描根：白名单里以 `<key>/` 开头的条目**不来自** $DSH_HOME，而来自这些目录。
 *
 * 为什么需要它：`dsh-plugin-wallpaper-engine`（壁纸引擎）把全部设置与素材放在
 * `~/.dsh-wallpaper-engine` —— 那是 $DSH_HOME 的**同级**目录，而白名单的口径是
 * 「相对 DSH home 的路径」，所以无论往白名单里写什么都够不到它。
 *
 * 为什么用「加扫描根」而不是「把文件搬进 home」：壁纸引擎的默认数据目录是**跨插件读
 * 契约**（皮肤中心在出文档之前同步读 `<该目录>/config.json` 的 `settings.id` 来预判
 * 「壁纸在台」），把它挪走会让皮肤侧的首帧先闪一下。加扫描根则完全不动生产路径。
 *
 * 仓库里的落点就是同名子目录（`<repoDir>/<key>/…`），所以额外根在 git 侧只是一个普通
 * 文件夹，`.gitignore` 与提交前复查都按它看待。
 *
 * 再加一个根：在表里补一行，然后往 WHITE_LIST 加 `<key>/…` 条目即可。
 */
const EXTRA_ROOTS = {
  'wallpaper-engine': () => {
    const override = process.env.DSH_WE_DATA_DIR;
    return override && override.trim()
      ? path.resolve(override.trim())
      : path.join(os.homedir(), '.dsh-wallpaper-engine');
  },
};

/** 一条白名单条目属于哪个额外根；不属于任何额外根时返回 undefined（= 走 DSH home）。 */
function extraRootKeyOf(rel) {
  const text = normRel(rel);
  for (const key of Object.keys(EXTRA_ROOTS)) {
    if (text === key || text.startsWith(`${key}/`)) return key;
  }
  return undefined;
}

/** 条目在额外根**之内**的相对路径（不属于额外根时原样返回）。 */
function innerOf(rel, key) {
  const text = normRel(rel);
  return key === undefined ? text : text.slice(key.length + 1);
}

/**
 * 额外根的磁盘位置。
 * @returns 绝对路径；取不到时返回 undefined —— 调用方跳过该条目，**绝不抛错**
 *（全新机器没装壁纸引擎是常态）。
 */
function extraRootDir(key) {
  let dir;
  try { dir = EXTRA_ROOTS[key]?.(); } catch { return undefined; }
  return typeof dir === 'string' && dir.trim() ? dir : undefined;
}

/**
 * 枚举一侧（本机 / 配置仓）在白名单范围内的全部文件 —— **唯一**的
 * 「白名单条目 → 磁盘文件」入口。
 *
 * 采集、还原、差异比较、密钥体检、面板统计都走这里。此前这五处各写一遍循环，
 * 于是「新增一种扫描口径只在其中一两处生效」是必然结局；本项目已经因为「多层防御
 * 各自为政」踩过两次（见 `isBakAllowed` 与 `.gitignore` 的注释），所以额外扫描根
 * 这件事必须只有一个落点。
 *
 * @param base - 本机侧传 DSH home，配置仓侧传 repoDir。
 * @param side - `'home'` 时额外根会重定向到它自己的目录；`'repo'` 时一切都在配置仓内。
 * @returns 每项 `{ repoRel, abs }`；`repoRel` 是**配置仓内**的相对路径（`/` 分隔），
 *          两侧因此天然对齐，差异比较不需要任何额外映射。
 */
export function entriesOf(base, side) {
  const out = [];
  for (const rel of activeList(base)) {
    if (testForbidden(rel)) continue;
    const key = side === 'home' ? extraRootKeyOf(rel) : undefined;
    const dir = key === undefined ? base : extraRootDir(key);
    if (dir === undefined) continue;
    const inner = key === undefined ? normRel(rel) : innerOf(rel, key);
    for (const abs of collectFiles(dir, inner)) {
      const within = normRel(path.relative(dir, abs));
      if (!within || within.startsWith('..') || testForbidden(within)) continue;
      out.push({ repoRel: key === undefined ? within : `${key}/${within}`, abs });
    }
  }
  return out;
}

/**
 * 配置仓内的相对路径 → 本机侧的落地路径（额外根会落回它自己的目录）。
 * @returns 绝对路径；额外根解析不出来时返回 undefined（调用方跳过该文件）。
 */
export function homeDestination(home, repoRel) {
  const key = extraRootKeyOf(repoRel);
  if (key === undefined) return path.join(home, ...normRel(repoRel).split('/'));
  const dir = extraRootDir(key);
  if (dir === undefined) return undefined;
  return path.join(dir, ...innerOf(repoRel, key).split('/'));
}

// ── 文件搬运 ──────────────────────────────────────────────────────────
function collectFiles(root, rel) {
  const start = path.join(root, rel);
  if (!fs.existsSync(start)) return [];
  const out = [];
  const walk = (abs) => {
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      for (const entry of fs.readdirSync(abs)) walk(path.join(abs, entry));
      return;
    }
    out.push(abs);
  };
  walk(start);
  return out;
}

/**
 * 覆盖式拷贝，专门处理 Windows「只读目标」这个坑。
 *
 * `copyFileSync` 会把源文件的只读属性**带到目标**；而 `CopyFileW` 在目标已存在
 * 且带 ReadOnly 时以 ERROR_ACCESS_DENIED 失败。两者叠加的后果是
 * 「第一次拷贝成功、之后每次都失败」—— 这正是本插件最早那次采集失败的根因。
 *
 * 处理：拷前清掉目标只读位；仍失败则删掉目标重来；拷后保持可写，
 * 让下一次同步不会重复撞同一个坑。
 */
export function copyFileRobust(src, dst) {
  if (fs.existsSync(dst)) {
    try { fs.chmodSync(dst, 0o666); } catch { /* 清不掉就靠下面的重试 */ }
  }
  try {
    fs.copyFileSync(src, dst);
  } catch (error) {
    if (error?.code !== 'EPERM' && error?.code !== 'EACCES') throw error;
    try { fs.rmSync(dst, { force: true }); } catch { /* 交给最后一次尝试报错 */ }
    fs.copyFileSync(src, dst);
  }
  try { fs.chmodSync(dst, 0o666); } catch { /* 非致命：仅影响下次覆盖 */ }
}

/**
 * 采集：home → repo。
 *
 * 单个文件失败**不阻断**整次同步：被锁定、权限不足或被文件策略拒绝的文件
 * 记入 `skipped` 并继续。这里必须容错 —— 插件跑在 DSH 宿主进程内，而会话与
 * 附件正在被该进程写入，出现 EBUSY/EPERM 是常态。
 *
 * @param io 测试注入点，`{ copyFile }` 可替换默认实现。
 * @returns `{ copied, skipped }`，skipped 每项形如 `{ path, error }`。
 */
export function copyToRepo(home, settings, io = {}) {
  const copyFile = io.copyFile ?? copyFileRobust;
  const copied = [];
  const skipped = [];
  for (const { repoRel, abs: src } of entriesOf(home, 'home')) {
    const dst = path.join(settings.repoDir, ...repoRel.split('/'));
    try {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      copyFile(src, dst);
      copied.push(repoRel);
    } catch (error) {
      skipped.push({ path: repoRel, error: String(error?.message ?? error) });
    }
  }
  return { copied, skipped };
}

/** 还原：repo → home。覆盖前备份到 _backup/。同样单文件失败不阻断。 */
export function copyToHome(home, settings) {
  const copied = [];
  const backedUp = [];
  const skipped = [];
  const backupDir = path.join(settings.repoDir, '_backup');
  for (const { repoRel, abs: src } of entriesOf(settings.repoDir, 'repo')) {
    const dst = homeDestination(home, repoRel);
    if (dst === undefined) continue;
    if (fs.existsSync(dst)) {
      fs.mkdirSync(backupDir, { recursive: true });
      const bk = path.join(backupDir, `${repoRel.replace(/[\\/]/g, '__')}.pre-sync`);
      try { copyFileRobust(dst, bk); backedUp.push(bk); } catch { /* 备份失败不阻断 */ }
    }
    try {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      copyFileRobust(src, dst);
      copied.push(repoRel);
    } catch (error) {
      skipped.push({ path: repoRel, error: String(error?.message ?? error) });
    }
  }
  return { copied, backedUp, skipped };
}

/** 把 skipped 渲染成日志行，最多列 8 条，其余只报数量。 */
function reportSkipped(say, skipped) {
  if (!skipped.length) return;
  say(`[!] 跳过 ${skipped.length} 个无法读取的文件（不阻断同步）：`);
  for (const s of skipped.slice(0, 8)) say(`    ${s.path} → ${s.error}`);
  if (skipped.length > 8) say(`    …另有 ${skipped.length - 8} 个未列出`);
}

// ─ git ───────────────────────────────────────────────────────────────
async function git(repoDir, args, { timeout = 120000 } = {}) {
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd: repoDir,
    timeout,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    // 强制非交互，避免弹出凭据窗口卡住宿主进程。
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_CREDENTIAL_NONINTERACTIVE: '1',
      GCM_INTERACTIVE: 'never',
    },
  });
  return `${stdout}${stderr}`.trim();
}

async function gitTry(repoDir, args, opts) {
  try {
    return { ok: true, out: await git(repoDir, args, opts) };
  } catch (error) {
    return { ok: false, out: `${error.stderr || ''}${error.stdout || ''}${error.message || ''}`.trim() };
  }
}

/** 提交：add → 复查暂存区 → commit。发现密钥类文件立即回滚暂存。 */
/**
 * 从远端 URL 里取 GitHub 主人名（只认 github.com）。
 *
 * 用途：本机没有 git 身份时，给提交编一个**说得通**的作者 —— 换机后第一次同步
 * 的用户名，最好就是这份配置仓的主人，而不是某台机器的登录名。
 * 拿不到（不是 GitHub / 没配 origin）就返回 null，由调用方退回机器名。
 *
 * 注意：只解析出主人名，**绝不把 URL 本身写进日志**（URL 里可能带 token）。
 */
export function githubOwner(url) {
  const text = String(url ?? '').trim();
  if (!text) return null;
  const https = /^https?:\/\/(?:[^@/]+@)?github\.com\/([^/]+)\//i.exec(text);
  if (https) return https[1];
  const ssh = /^(?:ssh:\/\/)?git@github\.com[:/]([^/]+)\//i.exec(text);
  if (ssh) return ssh[1];
  return null;
}

/**
 * 本机没有 git 身份时，编一个可用的作者身份。
 *
 * 为什么必须有这一步：user.name / user.email 都没有时 `git commit` 直接失败
 * （实测原话是 `Author identity unknown … unable to auto-detect email address`），
 * 而**全新的机器本来就不会有身份** —— 那恰恰是「换机复原」最需要同步成功的时刻。
 * 原实现把这句报错笼统报成「推送失败」，用户只会看到推送不行。
 *
 * 优先级：origin 的 GitHub 主人（配成 `<主人>@users.noreply.github.com`，与仓库
 * 既有提交一致）→ 本机登录名 @ 主机名。只在确实没有身份时使用。
 */
async function fallbackIdentity(repoDir) {
  const remote = await gitTry(repoDir, ['remote', 'get-url', 'origin']);
  const owner = remote.ok ? githubOwner(remote.out.split('\n')[0]) : null;
  if (owner) return { name: owner, email: `${owner}@users.noreply.github.com`, source: 'origin' };
  let user = 'dsh';
  try { user = os.userInfo().username || user; } catch { /* 取不到就用兜底名 */ }
  return { name: user, email: `${user}@${os.hostname()}`, source: 'machine' };
}

/**
 * 本次提交该用什么身份：本机已经有（仓库级 / 全局 / 环境变量）就返回 null 表示
 * 「照原样」，没有才返回兜底身份。
 *
 * 探针用 `git var GIT_AUTHOR_IDENT` —— 它和 `git commit` 走同一套解析，比逐个查
 * config 键更准（同时覆盖 GIT_AUTHOR_* 环境变量与 include 文件）。
 */
export async function resolveCommitIdentity(repoDir) {
  const probe = await gitTry(repoDir, ['var', 'GIT_AUTHOR_IDENT']);
  if (probe.ok) return null;
  return fallbackIdentity(repoDir);
}

/** git 报错只取第一行非空内容：面板日志一行一条，塞整段 stderr 反而看不出重点。 */
function firstLine(text) {
  const line = String(text ?? '').split(/\r?\n/).find((row) => row.trim());
  return line ? line.trim() : '（git 没有给出原因）';
}

/**
 * 提交：暂存 → 复查暂存区 → commit。发现密钥类文件立即回滚暂存。
 *
 * 每一步都走 gitTry：**任何一步失败都变成一行可读日志**，而不是抛出去被路由兜成
 * 一个把整段 git stderr 塞进 error 字段的 500 —— 用户实测撞过，面板只显示
 * 「推送不行」，实际是提交被 git 拒绝，看不出真正原因。
 *
 * 本机没有 git 身份时改用兜底身份提交，并回报用了什么、从哪来。
 *
 * @param io 测试注入点，`{ say }` 收提交过程的说明行。
 */
export async function commitAll(repoDir, message, io = {}) {
  const say = io.say ?? (() => {});

  const added = await gitTry(repoDir, ['add', '-A']);
  if (!added.ok) return { ok: false, staged: [], error: `暂存失败：${firstLine(added.out)}` };

  const listed = await gitTry(repoDir, ['diff', '--cached', '--name-only']);
  if (!listed.ok) return { ok: false, staged: [], error: `读取暂存区失败：${firstLine(listed.out)}` };
  const staged = listed.out.split('\n').map((s) => s.trim()).filter(Boolean);

  // 必须与 testForbidden / 白名单 共用同一份例外（isBakAllowed），
  // 否则会出现「前几层放行、这一层拦下」的僵局。
  const suspicious = staged.filter((f) => SECRET_NAME_RE.test(f) && !isBakAllowed(f));
  if (suspicious.length) {
    await gitTry(repoDir, ['reset']);
    return { ok: false, staged, error: `暂存区出现疑似密钥文件，已中止提交：${suspicious.join(', ')}` };
  }
  if (!staged.length) return { ok: true, staged, committed: false };

  const identity = await resolveCommitIdentity(repoDir);
  const args = identity
    ? ['-c', `user.name=${identity.name}`, '-c', `user.email=${identity.email}`, 'commit', '-m', message]
    : ['commit', '-m', message];
  const committed = await gitTry(repoDir, args);
  if (!committed.ok) {
    return { ok: false, staged, error: `提交失败：${firstLine(committed.out)}` };
  }
  if (identity) {
    const where = identity.source === 'origin' ? '取自 origin 的 GitHub 主人名' : '取自本机登录名';
    say(`[i] 本机没有 git 身份，本次提交临时用 ${identity.name} <${identity.email}>（${where}）。`);
    say('    想固定下来：在仓库里执行 git config user.name / user.email（仓库级即可）。');
  }
  return { ok: true, staged, committed: true, identity: identity ?? undefined };
}

// ── 密钥体检 ──────────────────────────────────────────────────────────
const SECRET_PATTERNS = [
  [/sk-[A-Za-z0-9_-]{16,}/g, 'OpenAI 风格 sk-'],
  [/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}/g, 'GitHub token'],
  [/AKIA[0-9A-Z]{16}/g, 'AWS Access Key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, '私钥块'],
  [/Bearer\s+[A-Za-z0-9._-]{20,}/gi, 'Bearer 头'],
  [/(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd)\s*[:=]\s*["']?[A-Za-z0-9._-]{16,}/gi, 'key/token 赋值'],
];

/**
 * 从 .credentials.yaml 里粗略提取真实密钥值，用于精确匹配。
 * 这是启发式辅助（不是主闸）：主闸是 NEVER_COPY 的文件级拒绝。
 */
function extractCredentialValues(home) {
  const file = path.join(home, '.credentials.yaml');
  if (!fs.existsSync(file)) return [];
  const values = [];
  let inRefs = false;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (/^refs:\s*$/.test(raw)) { inRefs = true; continue; }
    if (/^\S/.test(raw) && !/^refs:/.test(raw)) inRefs = false;
    const secret = raw.match(/^\s*secret:\s*["']?([^\s"']{8,})/);
    if (secret) { values.push(secret[1]); continue; }
    if (inRefs) {
      const kv = raw.match(/^\s+[A-Za-z0-9_.-]+:\s*["']?([^\s"']{8,})/);
      if (kv) values.push(kv[1]);
    }
  }
  return [...new Set(values)];
}

function scanForSecrets(home, settings) {
  const findings = [];
  const targets = [];
  for (const { repoRel, abs } of entriesOf(home, 'home')) {
    // 只扫文本类，跳过 zstd 二进制（纯文本扫描无法解释压缩内容）
    if (/\.(jsonl\.zstd|zst|gz|zip|png|jpe?g|webp|gif|pdf|tgz)$/i.test(abs)) continue;
    targets.push({ repoRel, abs });
  }
  const creds = extractCredentialValues(home);
  for (const { repoRel, abs } of targets) {
    let text;
    try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    for (const value of creds) {
      if (text.includes(value)) findings.push({ file: repoRel, kind: '精确命中 .credentials.yaml 中的密钥值' });
    }
    for (const [re, label] of SECRET_PATTERNS) {
      const m = text.match(re);
      if (m?.length) findings.push({ file: repoRel, kind: `${label} ×${m.length}` });
    }
  }
  return { scanned: targets.length, credentialValues: creds.length, findings };
}

// ── 本机 ↔ 仓库 差异 ──────────────────────────────────────────────────

/** 两个文件内容是否一致（先比大小，再比字节）。 */
function sameFile(a, b) {
  try {
    if (fs.statSync(a).size !== fs.statSync(b).size) return false;
    return fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
}

/** 收集白名单范围内某一侧的全部文件，键为统一的仓库相对路径。 */
function collectSide(root, side) {
  const map = new Map();
  for (const { repoRel, abs } of entriesOf(root, side)) map.set(repoRel, abs);
  return map;
}

/**
 * 本机 ↔ 仓库 的差异 —— 这才是「待同步」真正该表达的东西。
 *
 * 注意：**不要**拿「仓库里的文件数」当待办量显示（那只是已同步的载荷规模），
 * 否则会出现「显示 46 个待同步、但其实一切都已提交推送」这种误导。
 *
 * @returns `{ added, changed, removed, repoFiles, homeFiles }`
 */
export function diffHomeVsRepo(home, settings) {
  const homeSet = collectSide(home, 'home');
  const repoSet = collectSide(settings.repoDir, 'repo');
  const added = [];
  const changed = [];
  const removed = [];
  for (const [rel, abs] of homeSet) {
    const dst = repoSet.get(rel);
    if (dst === undefined) { added.push(rel); continue; }
    if (!sameFile(abs, dst)) changed.push(rel);
  }
  for (const rel of repoSet.keys()) if (!homeSet.has(rel)) removed.push(rel);
  return {
    added: added.sort(),
    changed: changed.sort(),
    removed: removed.sort(),
    repoFiles: repoSet.size,
    homeFiles: homeSet.size,
  };
}

// ─ 状态 ──────────────────────────────────────────────────────────────
async function readStatus(home, settings) {
  const status = {
    home,
    repoDir: settings.repoDir,
    repoExists: fs.existsSync(settings.repoDir),
    isGitRepo: fs.existsSync(path.join(settings.repoDir, '.git')),
    branch: null,
    remote: null,
    dirty: false,
    ahead: 0,
    files: 0,
    sizeKB: 0,
    pending: 0,
    pendingDetail: { added: 0, changed: 0, removed: 0 },
    homeFiles: 0,
    lastRun: settings.lastRun,
  };
  if (!status.repoExists) return status;

  for (const { abs } of entriesOf(settings.repoDir, 'repo')) {
    status.files += 1;
    try { status.sizeKB += fs.statSync(abs).size / 1024; } catch { /* 忽略 */ }
  }
  status.sizeKB = Math.round(status.sizeKB);

  // 真正的「待同步」= 本机与仓库的内容差异，而不是仓库的文件数。
  const diff = diffHomeVsRepo(home, settings);
  status.pending = diff.added.length + diff.changed.length + diff.removed.length;
  status.pendingDetail = {
    added: diff.added.length,
    changed: diff.changed.length,
    removed: diff.removed.length,
  };
  status.homeFiles = diff.homeFiles;

  if (status.isGitRepo) {
    const b = await gitTry(settings.repoDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
    if (b.ok) status.branch = b.out.split('\n')[0].trim();
    const r = await gitTry(settings.repoDir, ['remote', 'get-url', 'origin']);
    if (r.ok) status.remote = r.out.split('\n')[0].trim();
    const s = await gitTry(settings.repoDir, ['status', '--porcelain']);
    if (s.ok) status.dirty = s.out.length > 0;
    const a = await gitTry(settings.repoDir, ['rev-list', '--count', '@{u}..HEAD']);
    if (a.ok) status.ahead = Number.parseInt(a.out.split('\n')[0], 10) || 0;
  }
  return status;
}

// ── 远端合并 ──────────────────────────────────────────────────────────
/**
 * 采集/推送之前，先把远端的变化取回来。
 *
 * 为什么必须有：本插件原先只会 push。远端一旦有别的机器推过的提交，本机就会
 * 卡死在两种坏状态之一 ——
 *   1) 本地有提交：push 被拒（`! [rejected] main -> main (fetch first)`）；
 *   2) 本地无提交：@{u} 引用陈旧，rev-list 算出来是 0，于是**谎报**
 *      「本地与远端完全一致」，本地永远拿不到远端的新内容。
 * 面板上没有任何按钮能救，用户只能手工进仓库处理。
 *
 * 策略：
 *  - fetch 失败（断网、TLS 拦截、凭据过期）**不阻断**采集：本地提交本身是
 *    安全的，真推不上去时后面的 push 会如实报错。
 *  - 远端领先、本地无提交 → `merge --ff-only` 快进。
 *  - 两边都有提交（分叉）→ `rebase`，保持线性历史。
 *  - 合并冲突 → `--abort` 回滚到操作前并报 ok:false，**绝不留半合并状态**。
 */
async function syncWithRemote(repoDir, say) {
  if (!fs.existsSync(path.join(repoDir, '.git'))) return { ok: true, merged: 0 };
  const remote = await gitTry(repoDir, ['remote', 'get-url', 'origin']);
  if (!remote.ok) { say('（仓库未配置 origin，跳过拉取远端）'); return { ok: true, merged: 0 }; }

  const fetched = await gitTry(repoDir, ['fetch', 'origin'], { timeout: 180000 });
  if (!fetched.ok) {
    say('[!] 拉取远端失败（不阻断本次同步；若远端有新提交，推送会被拒）：');
    for (const line of fetched.out.split('\n').slice(0, 3)) if (line.trim()) say(`    ${line}`);
    return { ok: true, merged: 0 };
  }

  const behind = await gitTry(repoDir, ['rev-list', '--count', 'HEAD..@{u}']);
  const behindCount = behind.ok ? (Number.parseInt(behind.out.trim(), 10) || 0) : 0;
  if (!behindCount) return { ok: true, merged: 0 };

  const ahead = await gitTry(repoDir, ['rev-list', '--count', '@{u}..HEAD']);
  const aheadCount = ahead.ok ? (Number.parseInt(ahead.out.trim(), 10) || 0) : 0;

  if (!aheadCount) {
    const ff = await gitTry(repoDir, ['merge', '--ff-only', '@{u}'], { timeout: 180000 });
    if (ff.ok) {
      say(`远端领先 ${behindCount} 个提交，已快进合并。`);
      return { ok: true, merged: behindCount };
    }
    say(`[x] 快进合并失败：\n${ff.out}`);
    return { ok: false, merged: 0 };
  }

  say(`远端有 ${behindCount} 个本机没有的提交，本机有 ${aheadCount} 个未推送提交 —— 正在 rebase…`);
  const rb = await gitTry(repoDir, ['rebase', '@{u}'], { timeout: 180000 });
  if (rb.ok) {
    say(`已把本机 ${aheadCount} 个提交重放到远端之上（远端 ${behindCount} 个提交已并入）。`);
    return { ok: true, merged: behindCount };
  }

  await gitTry(repoDir, ['rebase', '--abort']);
  say('[x] 自动合并失败（已回滚，仓库保持合并前的样子）：');
  for (const line of rb.out.split('\n').slice(0, 6)) if (line.trim()) say(`    ${line}`);
  say('需要人工处理：进仓库执行 `git pull --rebase` 解决冲突后，再点同步。');
  return { ok: false, merged: 0 };
}
// ── 动作 ──────────────────────────────────────────────────────────────
async function runAction(home, settings, action, options) {
  const log = [];
  const say = (line) => log.push(line);
  const stamp = new Date().toLocaleString('zh-CN');

  if (action === 'check') {
    const scan = scanForSecrets(home, settings);
    say(`扫描 ${scan.scanned} 个文本文件；从 .credentials.yaml 提取 ${scan.credentialValues} 个密钥值用于精确匹配。`);
    if (!scan.findings.length) say('[OK] 未发现明文密钥特征。');
    else {
      say(`[!] 发现 ${scan.findings.length} 处需人工确认：`);
      for (const f of scan.findings) say(`    ${f.file} → ${f.kind}`);
      say('注意：正则命中不等于真密钥（可能是文档示例或变量名）。');
    }
    if (!fs.existsSync(path.join(home, '.credentials.yaml'))) say('[!] 未找到 .credentials.yaml');
    else say('[OK] .credentials.yaml 在硬黑名单中，永不被搬运。');
    return { ok: !scan.findings.length, log, scan };
  }

  if (!fs.existsSync(settings.repoDir)) {
    return { ok: false, log: [`仓库目录不存在：${settings.repoDir}`, '请先在设置里填入正确的仓库目录，并确保已 git clone。'] };
  }

  if (action === 'pull') {
    // 采集之前先把远端取回来：否则远端一旦有别的机器推过的提交，本机既推不上去，
    // 又会因为 @{u} 引用陈旧而谎报「本地与远端完全一致」。
    const sync = await syncWithRemote(settings.repoDir, say);
    if (!sync.ok) return { ok: false, log, merged: 0 };

    const { copied, skipped } = copyToRepo(home, settings);
    say(`采集 ${copied.length} 个文件 → ${settings.repoDir}`);
    reportSkipped(say, skipped);
    if (!settings.repoDir || !fs.existsSync(path.join(settings.repoDir, '.git'))) {
      say('[!] 目标目录不是 git 仓库，已跳过提交。请先 git init / git clone。');
      return { ok: true, log, copied: copied.length };
    }
    if (options.commit !== false) {
      const c = await commitAll(settings.repoDir, `dsh-sync: pull ${stamp} (${os.hostname()})`, { say });
      if (!c.ok) { say(`[x] ${c.error}`); return { ok: false, log }; }
      say(c.committed ? `已提交 ${c.staged.length} 个变更` : '没有变更，无需提交');
    }

    // 推送与否，看的是「本地是否领先远端」，而不是「本次是否产生了新提交」。
    //
    // 曾经的写法是 `if (c.committed && options.gitPush)`，后果很隐蔽：
    // 推送失败（TLS 拦截、断网、凭据过期）后提交留在本地，用户再点一键同步时
    // 本机已无变更，committed=false，于是**永远不再重试推送**，还回报 ok:true。
    // 属于「静默空操作被报成成功」——必须按领先量判断才能自我修复。
    const ahead = await gitTry(settings.repoDir, ['rev-list', '--count', '@{u}..HEAD']);
    const pending = ahead.ok ? (Number.parseInt(ahead.out.trim(), 10) || 0) : null;

    if (options.gitPush) {
      if (pending === 0) {
        say('没有需要推送的提交 —— 本地与远端完全一致。');
      } else {
        const p = await gitTry(settings.repoDir, ['push']);
        if (!p.ok) { say(`[x] 推送失败：\n${p.out}`); return { ok: false, log }; }
        say(pending === null ? '已推送到远端。' : `已推送 ${pending} 个提交到远端。`);
      }
    } else if (pending > 0) {
      say(`（未推送；本地领先远端 ${pending} 个提交 —— 想推上去就点「一键同步」，它会补推。）`);
    }
    return { ok: true, log, copied: copied.length };
  }

  if (action === 'pushgit') {
    // 应急通道同样要先合并远端，否则一样被 fetch first 顶回来。
    const sync = await syncWithRemote(settings.repoDir, say);
    if (!sync.ok) return { ok: false, log, merged: 0 };

    // 先看有没有东西可推 —— 否则 git push 会「成功但什么都没做」，
    // 用户会以为同步生效了。这里必须把这种情况说清楚。
    const ahead = await gitTry(settings.repoDir, ['rev-list', '--count', '@{u}..HEAD']);
    const pending = ahead.ok ? (Number.parseInt(ahead.out.trim(), 10) || 0) : null;
    if (pending === 0) {
      say('没有需要推送的提交 —— 本地与远端完全一致，所以这次 push 什么都没做（这是正常的）。');
      say('');
      say('注意：push 只负责把「已提交」的改动送上去，它本身不会产生提交。');
      say('如果你刚改过本机配置，请点「一键同步」或「仅采集并提交」——');
      say('只有采集那一步会把 ~/.dsh 的改动写进仓库并生成提交。');
      return { ok: true, log, pushed: 0 };
    }
    const p = await gitTry(settings.repoDir, ['push']);
    say(p.ok ? `已推送 ${pending} 个提交到远端。` : `[x] 推送失败：\n${p.out}`);
    return { ok: p.ok, log, pushed: pending };
  }

  if (action === 'restore') {
    const { copied, backedUp, skipped } = copyToHome(home, settings);
    say(`还原 ${copied.length} 个文件 → ${home}`);
    if (backedUp.length) say(`覆盖前备份 ${backedUp.length} 个文件到 ${path.join(settings.repoDir, '_backup')}`);
    reportSkipped(say, skipped);
    say('');
    say('还需要你手工做两件事：');
    say('  1) dsh plugin --profile web install   （按 package.json 重装插件依赖）');
    say('  2) 重启 DSH。');
    say('（0.2.5 起不再同步 storages/workspace.json —— 那份工作区映射含机器相关绝对路径，');
    say('  换机后本来就该让本机自己生成，所以还原不再覆盖它。）');
    return { ok: true, log, copied: copied.length };
  }

  return { ok: false, log: [`未知动作：${action}`] };
}

// ── 路由 ──────────────────────────────────────────────────────────────
function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function apply(ctx, config) {
  const home = resolveHome();

  ctx.effect(
    () => ctx.webServer.register({
      kind: 'prefix',
      path: API_PREFIX,
      handler: async (req, res) => {
        // 轻量同源护栏：拒绝跨站发起的请求。
        if (String(req.headers['sec-fetch-site'] ?? '') === 'cross-site') {
          sendJson(res, 403, { ok: false, error: 'cross-site request refused' });
          return;
        }
        let url;
        try {
          url = new URL(req.url ?? '/', 'http://localhost');
        } catch {
          sendJson(res, 400, { ok: false, error: 'bad url' });
          return;
        }
        const route = url.pathname.replace(API_PREFIX, '') || '/';
        const settings = resolveSettings(home, config);

        try {
          if (req.method === 'GET' && route === '/status') {
            sendJson(res, 200, { ok: true, ...(await readStatus(home, settings)) });
            return;
          }

          if (req.method === 'POST' && route === '/config') {
            const repoDir = url.searchParams.get('repoDir');
            const patch = {};
            if (repoDir && repoDir.trim()) patch.repoDir = repoDir.trim();
            // includeSessions / includeAttachments 已废弃：会话与附件不再属于同步范围，
            // 这里不再接受这两个开关（旧 config.json 里的残留字段被 resolveSettings 忽略）。
            writeState(home, patch);
            const next = resolveSettings(home, config);
            sendJson(res, 200, { ok: true, ...(await readStatus(home, next)) });
            return;
          }

          if (req.method === 'POST' && route === '/run') {
            const action = url.searchParams.get('action') || '';
            const options = {
              gitPush: url.searchParams.get('gitPush') === '1',
              commit: url.searchParams.get('commit') !== '0',
            };
            const result = await runAction(home, settings, action, options);
            // 记录上次运行是「尽力而为」：状态写不进去也不能吞掉动作结果。
            try {
              writeState(home, {
                lastRun: {
                  action,
                  at: new Date().toISOString(),
                  ok: result.ok,
                  lines: result.log.slice(-40),
                },
              });
            } catch { /* 忽略：不影响动作本身的结论 */ }
            sendJson(res, result.ok ? 200 : 500, { ok: result.ok, ...result });
            return;
          }

          sendJson(res, 404, { ok: false, error: 'not found' });
        } catch (error) {
          sendJson(res, 500, { ok: false, error: String(error?.message ?? error) });
        }
      },
    }),
    'dsh-git-sync: 同源同步 API（状态 / 采集 / 还原 / 体检）',
  );
}

// commitAll / resolveCommitIdentity / githubOwner 都已在各自的定义处导出
// （它们是「本机没有 git 身份」这条真实故障路径的测试接缝）。
export { resolveHome, WHITE_LIST, PROFILE_FILES, activeList, NEVER_COPY, testForbidden };