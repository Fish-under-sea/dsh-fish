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

/**
 * 白名单：相对 DSH home 的路径。换机后需要复原的就在这里面。
 * 与 sync-kit/dsh-sync.ps1 的清单保持一致。
 */
const WHITE_LIST = [
  'settings.yaml',                    // 全局设置：主题/模型/provider/皮肤/桌宠
  'pet.json',
  'skin-center-active.json',
  'storages/workspace.json',          // 工作区 ↔ 会话映射（内含绝对路径）
  '.agent-presets',                   // agent 预设
  'skills',                           // Skill 目录（~/.dsh/skills）
  'task-board/ledger-v2.json',
  'task-board/scheduler-v2.json',
  'dsh-session-archive',
  'dsh-usage',
  'profiles/web/package.json',        // 装了什么插件
  'profiles/web/cordis.patch.yml',    // 每个插件是否启用（disabled 行）
  'profiles/web/cordis.patch.yml.bak-plugin-manager',
  'profiles/web/pnpm-lock.yaml',      // 精确版本，保证可复现
  'profiles/web/pnpm-workspace.yaml',
];

/** 会话与附件体积大、二进制，默认关闭，由 UI 开关决定。 */
const OPTIONAL_LIST = ['sessions', 'attachments'];

/**
 * 永不搬运：路径的任一段命中即拒绝。
 * 这是第一道闸，也是唯一一道「不依赖内容判断」的闸。
 */
const NEVER_COPY = new Set([
  '.credentials.yaml', 'credentials.yaml', 'credentials.json',
  '.env', 'node_modules', '.pnpm', '.git', 'session_projcache',
  '.anonymous-user-id', '.dshw-size.json', '.dshw-usage.json',
  'cordis.yml', 'workspace-local-paths.json',
]);

const SECRET_NAME_RE = /(^|[\\/])(\.credentials|\.env|credentials\.|.*\.pem$|.*\.key$|.*\.bak)/i;

/**
 * 允许同步的 `*.bak*` 例外。
 *
 * 默认规则是「任何含 .bak 的路径一律拒绝」——那是防呆，不是安全需要。
 * 但 `cordis.patch.yml.bak-plugin-manager` 是插件管理器写的配置备份，
 * 换机复原时它有用，所以按**精确整路径**放行。
 *
 * 只放行这一个字面量，任何其它 .bak 仍然一律拒绝。
 */
const BAK_ALLOW = new Set(['profiles/web/cordis.patch.yml.bak-plugin-manager']);

function testForbidden(relPath) {
  // 先看例外，且必须是精确整路径匹配（不做前缀/后缀放宽）。
  const norm = String(relPath).split(/[\\/]/).join('/');
  if (BAK_ALLOW.has(norm)) return false;

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
    includeSessions: state.includeSessions ?? cfg.includeSessions ?? true,
    includeAttachments: state.includeAttachments ?? cfg.includeAttachments ?? true,
    lastRun: state.lastRun ?? null,
  };
}

function activeList(settings) {
  const list = [...WHITE_LIST];
  if (settings.includeSessions) list.push('sessions');
  if (settings.includeAttachments) list.push('attachments');
  return list;
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
  for (const rel of activeList(settings)) {
    if (testForbidden(rel)) continue;
    for (const src of collectFiles(home, rel)) {
      const relFile = path.relative(home, src);
      if (!relFile || relFile.startsWith('..') || testForbidden(relFile)) continue;
      const dst = path.join(settings.repoDir, relFile);
      try {
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        copyFile(src, dst);
        copied.push(relFile);
      } catch (error) {
        skipped.push({ path: relFile, error: String(error?.message ?? error) });
      }
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
  for (const rel of activeList(settings)) {
    if (testForbidden(rel)) continue;
    for (const src of collectFiles(settings.repoDir, rel)) {
      const relFile = path.relative(settings.repoDir, src);
      if (!relFile || relFile.startsWith('..') || testForbidden(relFile)) continue;
      const dst = path.join(home, relFile);
      if (fs.existsSync(dst)) {
        fs.mkdirSync(backupDir, { recursive: true });
        const bk = path.join(backupDir, `${relFile.replace(/[\\/]/g, '__')}.pre-sync`);
        try { copyFileRobust(dst, bk); backedUp.push(bk); } catch { /* 备份失败不阻断 */ }
      }
      try {
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        copyFileRobust(src, dst);
        copied.push(relFile);
      } catch (error) {
        skipped.push({ path: relFile, error: String(error?.message ?? error) });
      }
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
async function commitAll(repoDir, message) {
  await git(repoDir, ['add', '-A']);
  const staged = (await git(repoDir, ['diff', '--cached', '--name-only']))
    .split('\n').map((s) => s.trim()).filter(Boolean);

  const suspicious = staged.filter((f) => SECRET_NAME_RE.test(f));
  if (suspicious.length) {
    await gitTry(repoDir, ['reset']);
    return { ok: false, staged, error: `暂存区出现疑似密钥文件，已中止提交：${suspicious.join(', ')}` };
  }
  if (!staged.length) return { ok: true, staged, committed: false };

  await git(repoDir, ['commit', '-m', message]);
  return { ok: true, staged, committed: true };
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
  for (const rel of activeList(settings)) {
    for (const f of collectFiles(home, rel)) {
      // 只扫文本类，跳过 zstd 二进制（纯文本扫描无法解释压缩内容）
      if (/\.(jsonl\.zstd|zst|gz|zip|png|jpe?g|webp|gif|pdf|tgz)$/i.test(f)) continue;
      targets.push(f);
    }
  }
  const creds = extractCredentialValues(home);
  for (const f of targets) {
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const rel = path.relative(home, f);
    for (const value of creds) {
      if (text.includes(value)) findings.push({ file: rel, kind: '精确命中 .credentials.yaml 中的密钥值' });
    }
    for (const [re, label] of SECRET_PATTERNS) {
      const m = text.match(re);
      if (m?.length) findings.push({ file: rel, kind: `${label} ×${m.length}` });
    }
  }
  return { scanned: targets.length, credentialValues: creds.length, findings };
}

// ── 本机 ↔ 仓库 差异 ──────────────────────────────────────────────────
const normRel = (p) => p.split(path.sep).join('/');

/** 两个文件内容是否一致（先比大小，再比字节）。 */
function sameFile(a, b) {
  try {
    if (fs.statSync(a).size !== fs.statSync(b).size) return false;
    return fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
}

/** 收集白名单范围内某一侧的全部文件，键为统一的相对路径。 */
function collectSide(root, settings) {
  const map = new Map();
  for (const rel of activeList(settings)) {
    if (testForbidden(rel)) continue;
    for (const abs of collectFiles(root, rel)) {
      const r = path.relative(root, abs);
      if (!r || r.startsWith('..') || testForbidden(r)) continue;
      map.set(normRel(r), abs);
    }
  }
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
  const homeSet = collectSide(home, settings);
  const repoSet = collectSide(settings.repoDir, settings);
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
    includeSessions: settings.includeSessions,
    includeAttachments: settings.includeAttachments,
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

  for (const rel of activeList(settings)) {
    for (const f of collectFiles(settings.repoDir, rel)) {
      status.files += 1;
      try { status.sizeKB += fs.statSync(f).size / 1024; } catch { /* 忽略 */ }
    }
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
    const { copied, skipped } = copyToRepo(home, settings);
    say(`采集 ${copied.length} 个文件 → ${settings.repoDir}`);
    reportSkipped(say, skipped);
    if (!settings.repoDir || !fs.existsSync(path.join(settings.repoDir, '.git'))) {
      say('[!] 目标目录不是 git 仓库，已跳过提交。请先 git init / git clone。');
      return { ok: true, log, copied: copied.length };
    }
    if (options.commit !== false) {
      const c = await commitAll(settings.repoDir, `dsh-sync: pull ${stamp} (${os.hostname()})`);
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
    say('  2) 检查 storages/workspace.json 里的绝对路径是否匹配本机，然后重启 DSH。');
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
            for (const key of ['includeSessions', 'includeAttachments']) {
              const v = url.searchParams.get(key);
              if (v === '1') patch[key] = true;
              if (v === '0') patch[key] = false;
            }
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

export { resolveHome, WHITE_LIST, NEVER_COPY, testForbidden };