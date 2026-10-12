/**
 * Skill Lens 插件 host 半（bundle 主入口）。
 *
 * 形态说明：DSH 原生 bundle 插件，client 半经 dsh.plugin.json 的 client.main
 * 注入宿主 conversation.view 槽位；host 半在此注册自有 JSON API 供其调用。
 * 与 better-sidebar 无关：文件系统访问全部由本 host 半用 node:fs 实现。
 * 路由签名对齐 better-sidebar：webServer.register({ kind:'prefix', handler(req, res) })，
 * req/res 为 Node 原生 IncomingMessage/ServerResponse。
 *
 * 安全围栏（host 运行在本地用户进程内，API 仅供本地 WebUI 调用）：
 * 1. 全部接受绝对路径，拒绝空字节/带首尾空白；
 * 2. read/files 限制在宿主 cwd 或已扫描过的根（scan 登记）之下；
 * 3. delete 额外要求：目标目录必须包含 SKILL.md（只删"技能目录"）、
 *    realpath 两级以上深度（不删盘符/卷根）、拒绝 symlink 穿越解析不一致。
 */
import { readFile, readdir, rm, stat, realpath, writeFile, mkdir } from "node:fs/promises";
import { crc32 } from "node:zlib";
import { existsSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Dirent } from "node:fs";
import os from "node:os";
import path from "node:path";

export const inject = ["webServer", "sessions"] as const;

const SKILL_MD = "SKILL.md";
const MAX_DIRS = 20000;
const MAX_READ_BYTES = 2 * 1024 * 1024;

/**
 * 扁平单文件技能：`<root>/<name>.md`（DSH 用户级技能常见形态，例如
 * `$DSH_HOME/skills/tdd.md`）。目录式技能仍以 `<name>/SKILL.md` 识别。
 */
const FLAT_SKILL_EXT = ".md";
/** 扁平技能里不作为技能入口的说明性文件名 */
const FLAT_SKILL_EXCLUDED = new Set(["readme.md", "index.md", "skill.md"]);

// 移植自 skill-lens src/scanner/exclusions.ts（PRD §7.1 默认排除目录）
const DEFAULT_EXCLUDED_DIRS = new Set([
  ".git", ".svn", ".hg", ".Trash", "$RECYCLE.BIN", "System Volume Information",
  "node_modules", "bower_components", "vendor", ".yarn", ".pnp", "Pods",
  "dist", "build", "out", ".next", ".nuxt", ".output", ".svelte-kit", ".turbo",
  ".parcel-cache", "target", "DerivedData",
  "coverage", "__pycache__", ".cache", ".pytest_cache", ".mypy_cache",
  ".ruff_cache", ".tox", ".terraform", ".serverless",
  ".venv", "venv", ".idea", ".vscode", ".gradle",
]);

interface WebServerService {
  register(route: {
    kind: "prefix";
    path: string;
    handler(req: IncomingMessage, res: ServerResponse): Promise<void> | void;
  }): void;
}

/** sessions 服务最小契约（对齐 better-sidebar sessionCwdOf 的用法） */
interface SessionsService {
  get(sessionId: string): { header?: { cwd?: string } } | undefined;
}

interface HostContext {
  webServer: WebServerService;
  sessions?: SessionsService;
}

/**
 * 会话工作区解析（对齐 better-sidebar sessionCwdOf 的链路）：
 * sessions.get(sessionId).header.cwd → process.cwd() 兜底。
 * 宿主进程 cwd 在 Windows 上常是 dsh 的启动/源码目录，不是用户项目，
 * 因此只作为最后兜底。
 */
function sessionCwdOf(ctx: HostContext, sessionId: unknown): string {
  if (typeof sessionId === "string" && sessionId !== "") {
    try {
      const cwd = ctx.sessions?.get?.(sessionId)?.header?.cwd;
      if (typeof cwd === "string" && cwd !== "" && path.isAbsolute(cwd)) return cwd;
    } catch {
      // sessions 服务不可用或会话不存在时走兜底
    }
  }
  return process.cwd();
}

/** 项目级 Skills 根目录：<projectRoot>/.dsh/skills（DSH 项目级 Skills 约定位置） */
function projectSkillsRoot(ctx: HostContext, sessionId: unknown): string {
  return path.join(sessionCwdOf(ctx, sessionId), ".dsh", "skills");
}

/**
 * DSH 全局技能根。
 *
 * 原实现硬编码 `~/.dsh`，在自定义 DSH_HOME 的通道上（本机为 `~/.dsh-beta`）
 * 会指向一个根本不存在的目录，面板因此恒为空。这里改为跟随宿主真实环境：
 * `$DSH_HOME/skills` → `$DSH_HOME` → `~/.dsh/skills` → `~/.dsh`。
 */
function globalSkillsRoot(): string {
  const candidates: string[] = [];
  const home = (process.env.DSH_HOME ?? "").trim();
  if (home !== "" && path.isAbsolute(home)) {
    candidates.push(path.join(home, "skills"), home);
  }
  const fallback = path.join(os.homedir(), ".dsh");
  candidates.push(path.join(fallback, "skills"), fallback);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[candidates.length - 1]!;
}

/**
 * 引用解析的资源根：本机技能常以 `../skill-refs/<file>` 或
 * `$DSH_HOME/skill-refs/<file>` 引用技能目录之外的共享资料。
 * 该目录允许被读取（仅此一层，不放行整个 DSH_HOME）。
 */
function skillResourceRoots(): string[] {
  const roots: string[] = [];
  const home = (process.env.DSH_HOME ?? "").trim();
  if (home !== "" && path.isAbsolute(home)) {
    roots.push(path.join(home, "skill-refs"));
  }
  roots.push(path.join(os.homedir(), ".dsh", "skill-refs"));
  return roots;
}

/** 展开引用里的 `$DSH_HOME` / `${DSH_HOME}` / `~` 前缀 */
function expandHomeVars(target: string): string | null {
  const home = (process.env.DSH_HOME ?? "").trim();
  let rest: string | null = null;
  if (target === "$DSH_HOME" || target === "${DSH_HOME}") rest = "";
  else if (target.startsWith("$DSH_HOME/")) rest = target.slice("$DSH_HOME/".length);
  else if (target.startsWith("${DSH_HOME}/")) rest = target.slice("${DSH_HOME}/".length);
  if (rest !== null) {
    if (home === "" || !path.isAbsolute(home)) return null;
    return path.join(home, rest);
  }
  if (target === "~") return os.homedir();
  if (target.startsWith("~/")) return path.join(os.homedir(), target.slice(2));
  return null;
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function writeError(res: ServerResponse, status: number, message: string): void {
  writeJson(res, status, { ok: false, error: message });
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.trim() === "") return {};
  return JSON.parse(text) as Record<string, unknown>;
}

/** 路径围栏公共段：绝对路径 + 无空字节/空白异常。返回 null 表示非法。 */
function sanitizePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (raw === "" || raw.includes("\0") || raw.trim() !== raw) return null;
  if (!path.isAbsolute(raw)) return null;
  return raw;
}

/** 技能目录名围栏：字母/数字开头，仅含字母数字._-，不接收路径分隔符（防写入任意位置） */
function isValidSkillName(name: unknown): name is string {
  return typeof name === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(name);
}

/** 解析 create/import 的目标根目录：显式 root（测试/覆盖）> project → <projectRoot>/.dsh/skills > global → ~/.dsh */
function resolveTargetRoot(
  ctx: HostContext,
  sessionId: unknown,
  location: unknown,
  explicitRoot: unknown,
): string | null {
  if (typeof explicitRoot === "string" && explicitRoot !== "") {
    return sanitizePath(explicitRoot);
  }
  if (location === "global") return path.join(os.homedir(), ".dsh");
  if (location === "project") return projectSkillsRoot(ctx, sessionId);
  return null;
}

/** 导入文件相对路径围栏：posix 相对路径、无 .. 段、非绝对。返回规范化的相对路径或 null */
function sanitizeImportRel(raw: unknown): string | null {
  if (typeof raw !== "string" || raw === "" || raw.includes("\0")) return null;
  const rel = raw.replace(/\\/g, "/");
  if (rel.startsWith("/") || /^[a-zA-Z]:/.test(rel)) return null; // 绝对路径
  const norm = path.posix.normalize(rel);
  if (norm === ".." || norm.startsWith("../") || path.posix.isAbsolute(norm)) return null;
  return norm;
}

/**
 * 一个被发现技能的位置描述。
 * - `kind: "dir"`：目录式技能，`dir` 是技能目录，入口为其下的 SKILL.md；
 * - `kind: "file"`：扁平式技能，`dir` 就是技能文件（`<root>/<name>.md`）本身。
 * 扁平式把目录换成文件路径，是为了让同一目录下的多个技能各有唯一标识
 * （若仍用所在目录，12 个扁平技能的 dir 会全部相同，选择/删除/元数据全会串）。
 */
export interface DiscoveredSkill {
  dir: string;
  rel: string;
  kind: "dir" | "file";
}

/** 扁平技能入口判定：`<name>.md`，排除 SKILL.md 与说明性文件名 */
function isFlatSkillFile(name: string): boolean {
  if (!name.toLowerCase().endsWith(FLAT_SKILL_EXT)) return false;
  if (name === SKILL_MD) return false;
  return !FLAT_SKILL_EXCLUDED.has(name.toLowerCase());
}

/**
 * 递归发现技能（移植自 skill-lens discover-skills：BFS 工作队列，不跟随 symlink）。
 *
 * 在原「只认 SKILL.md」的基础上增加扁平 `<name>.md` 识别：宿主把
 * `$DSH_HOME/skills/` 下的技能以单文件形态存放时，原实现会一个都扫不到。
 * 已进入某个技能包（祖先目录含 SKILL.md）后不再识别扁平文件，
 * 避免把技能自带的 `references/*.md` 误报成独立技能。
 */
async function discoverSkills(
  rootPath: string,
  onProgress?: (scanned: number, found: number) => void,
): Promise<DiscoveredSkill[]> {
  const found: DiscoveredSkill[] = [];
  const queue: { abs: string; rel: string; insideSkill: boolean }[] = [
    { abs: rootPath, rel: "", insideSkill: false },
  ];
  let scanned = 0;
  let reportCounter = 0;

  while (queue.length > 0) {
    if (scanned >= MAX_DIRS) break;
    const item = queue.shift()!;
    let entries: Dirent[];
    try {
      entries = await readdir(item.abs, { withFileTypes: true });
    } catch {
      continue;
    }
    scanned++;
    const hasSkillMd = entries.some((entry) => entry.isFile() && entry.name === SKILL_MD);
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!DEFAULT_EXCLUDED_DIRS.has(entry.name)) {
          queue.push({
            abs: path.join(item.abs, entry.name),
            rel: item.rel === "" ? entry.name : `${item.rel}/${entry.name}`,
            insideSkill: item.insideSkill || hasSkillMd,
          });
        }
        continue;
      }
      if (!entry.isFile()) continue;
      const rel = item.rel === "" ? entry.name : `${item.rel}/${entry.name}`;
      if (entry.name === SKILL_MD) {
        found.push({ dir: item.abs, rel: item.rel, kind: "dir" });
      } else if (!item.insideSkill && !hasSkillMd && isFlatSkillFile(entry.name)) {
        found.push({ dir: path.join(item.abs, entry.name), rel, kind: "file" });
      }
    }
    // 每 200 个目录上报一次进度，避免过于频繁的写入
    reportCounter++;
    if (onProgress && reportCounter >= 200) {
      reportCounter = 0;
      onProgress(scanned, found.length);
    }
  }

  // 最终上报
  if (onProgress) onProgress(scanned, found.length);

  found.sort((a, b) => a.rel.localeCompare(b.rel));
  return found;
}

/** 目录内文件清单（posix 相对路径；供存在性检查与文件浏览） */
async function listSkillFiles(skillDir: string): Promise<{ files: string[]; dirs: string[] }> {
  const files: string[] = [];
  const dirs: string[] = [];
  const queue = [skillDir];
  let budget = 2000;
  while (queue.length > 0 && budget-- > 0) {
    const dir = queue.shift()!;
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    const relBase = dir === skillDir ? "" : path.relative(skillDir, dir).split(path.sep).join("/");
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const rel = relBase === "" ? entry.name : `${relBase}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!DEFAULT_EXCLUDED_DIRS.has(entry.name)) {
          dirs.push(rel);
          queue.push(path.join(dir, entry.name));
        }
      } else if (entry.isFile()) {
        files.push(rel);
      }
    }
  }
  files.sort();
  return { files, dirs };
}

/** 在资源根内按文件名递归查找（限目录数，避免大目录树把请求拖死） */
async function findByBasename(root: string, base: string): Promise<string | null> {
  const needle = base.toLowerCase();
  const queue: string[] = [root];
  let scanned = 0;
  while (queue.length > 0) {
    if (scanned >= 500) break;
    const dir = queue.shift()!;
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    scanned++;
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!DEFAULT_EXCLUDED_DIRS.has(entry.name)) queue.push(path.join(dir, entry.name));
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase() === needle) return path.join(dir, entry.name);
    }
  }
  return null;
}

/** 资源文件展示名：在 DSH_HOME 之下时用相对路径，否则用绝对路径 */
function labelOfResource(filePath: string): string {
  const home = (process.env.DSH_HOME ?? "").trim();
  if (home !== "" && path.isAbsolute(home)) {
    const rel = path.relative(home, filePath);
    if (rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)) {
      return rel.split(path.sep).join("/");
    }
  }
  return filePath.replace(/\\/g, "/");
}

/**
 * 从技能位置向上找同级的 `skill-refs` 目录。
 *
 * 项目把自己的共享资料放在工作区的 `skill-refs/` 下时（本机 `skills/` 与
 * `skill-refs/` 就是兄弟目录），裸文件名引用只有在这里才找得到，光靠
 * `$DSH_HOME/skill-refs` 无法覆盖项目级布局。
 */
function siblingResourceRoots(baseDir: string): string[] {
  const roots: string[] = [];
  let current = baseDir;
  for (let depth = 0; depth < 3; depth++) {
    const parent = path.dirname(current);
    if (parent === current) break;
    const candidate = path.join(parent, "skill-refs");
    if (existsSync(candidate)) roots.push(candidate);
    current = parent;
  }
  return roots;
}

/**
 * 把一条技能引用解析到磁盘真实文件。
 * 依次尝试：`$DSH_HOME`/`~` 展开 → 绝对路径 → 相对技能位置（含上一层）
 * → 资源根内按裸文件名兜底（技能常写 `templates.md` 而文件在 skill-refs 下）。
 */
async function resolveReference(
  target: string,
  baseDirs: string[],
  resourceRoots: string[],
): Promise<string | null> {
  const raw = (target.split("#")[0] ?? "").split("?")[0]!.trim();
  if (raw === "") return null;

  const expanded = expandHomeVars(raw);
  const tries: string[] = [];
  if (expanded !== null) {
    tries.push(expanded);
  } else if (path.isAbsolute(raw)) {
    tries.push(raw);
  } else {
    for (const base of baseDirs) tries.push(path.resolve(base, raw));
  }
  for (const candidate of tries) {
    const info = await stat(candidate).catch(() => null);
    if (info?.isFile()) return candidate;
  }

  // 裸文件名兜底：只对不含路径分隔符的目标做资源根搜索
  const isBareName = expanded === null && !path.isAbsolute(raw) && !raw.includes("/") && !raw.includes("\\");
  if (isBareName) {
    for (const root of resourceRoots) {
      const direct = path.join(root, raw);
      const directInfo = await stat(direct).catch(() => null);
      if (directInfo?.isFile()) return direct;
      const found = await findByBasename(root, raw);
      if (found !== null) return found;
    }
  }
  return null;
}

/** read/files 的根围栏：路径必须位于宿主进程 cwd 或任一已扫描根之下。 */
const allowedRoots = new Set<string>([process.cwd()]);

/** a 与 b 相同，或 a 位于 b 之内（用于多根去重与围栏判断） */
function isSameOrContained(a: string, b: string): boolean {
  if (a === b) return true;
  const rel = path.relative(b, a);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function isUnderAllowedRoot(resolved: string): boolean {
  for (const root of allowedRoots) {
    if (isSameOrContained(resolved, root)) return true;
  }
  return false;
}

// ---------- 纯 Node.js ZIP 创建（STORE 模式，无压缩） ----------

interface ZipEntry {
  name: string;   // 文件路径（posix）
  data: Buffer;
}

function dosTime(d: Date): number {
  return ((d.getSeconds() >> 1)) | (d.getMinutes() << 5) | (d.getHours() << 11);
}

function dosDate(d: Date): number {
  return (d.getDate()) | ((d.getMonth() + 1) << 5) | ((d.getFullYear() - 1980) << 9);
}

function buildZip(entries: ZipEntry[]): Buffer {
  const chunks: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data) >>> 0;
    const now = new Date();
    const dt = dosTime(now);
    const dd = dosDate(now);

    // Local file header (30 + name)
    const lh = Buffer.alloc(30 + nameBuf.length);
    lh.writeUInt32LE(0x04034b50, 0);  // signature
    lh.writeUInt16LE(20, 4);           // version needed
    lh.writeUInt16LE(0, 6);            // flags
    lh.writeUInt16LE(0, 8);            // compression: STORE
    lh.writeUInt16LE(dt, 10);          // mod time
    lh.writeUInt16LE(dd, 12);          // mod date
    lh.writeUInt32LE(crc, 14);         // crc32
    lh.writeUInt32LE(entry.data.length, 18); // compressed size
    lh.writeUInt32LE(entry.data.length, 22); // uncompressed size
    lh.writeUInt16LE(nameBuf.length, 26);    // name length
    lh.writeUInt16LE(0, 28);           // extra length
    nameBuf.copy(lh, 30);
    chunks.push(lh, entry.data);

    // Central directory header (46 + name)
    const ch = Buffer.alloc(46 + nameBuf.length);
    ch.writeUInt32LE(0x02014b50, 0);   // signature
    ch.writeUInt16LE(20, 4);            // version made by
    ch.writeUInt16LE(20, 6);            // version needed
    ch.writeUInt16LE(0, 8);             // flags
    ch.writeUInt16LE(0, 10);            // compression: STORE
    ch.writeUInt16LE(dt, 12);           // mod time
    ch.writeUInt16LE(dd, 14);           // mod date
    ch.writeUInt32LE(crc, 16);          // crc32
    ch.writeUInt32LE(entry.data.length, 20);  // compressed size
    ch.writeUInt32LE(entry.data.length, 24);  // uncompressed size
    ch.writeUInt16LE(nameBuf.length, 28);     // name length
    ch.writeUInt16LE(0, 30);            // extra length
    ch.writeUInt16LE(0, 32);            // comment length
    ch.writeUInt16LE(0, 34);            // disk number start
    ch.writeUInt16LE(0, 36);            // internal attrs
    ch.writeUInt32LE(0, 38);            // external attrs
    ch.writeUInt32LE(offset, 42);       // local header offset
    nameBuf.copy(ch, 46);
    centralHeaders.push(ch);

    offset += lh.length + entry.data.length;
  }

  const centralDirOffset = offset;
  const centralDirSize = centralHeaders.reduce((s, b) => s + b.length, 0);

  // End of central directory (22)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);            // disk number
  eocd.writeUInt16LE(0, 6);            // disk with central dir
  eocd.writeUInt16LE(entries.length, 8);   // entries on this disk
  eocd.writeUInt16LE(entries.length, 10);  // total entries
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);           // comment length

  return Buffer.concat([...chunks, ...centralHeaders, eocd]);
}

/** 递归收集目录下所有文件，返回 { relativePath, buffer }[] */
async function collectDirFiles(dirPath: string, prefix: string): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];
  const items = await readdir(dirPath, { withFileTypes: true });
  for (const item of items) {
    const fullPath = `${dirPath}/${item.name}`;
    const relName = prefix === "" ? item.name : `${prefix}/${item.name}`;
    if (item.isDirectory()) {
      const sub = await collectDirFiles(fullPath, relName);
      entries.push(...sub);
    } else if (item.isFile()) {
      const data = await readFile(fullPath);
      entries.push({ name: relName, data });
    }
  }
  return entries;
}

export function apply(ctx: HostContext): void {
  ctx.webServer.register({
    kind: "prefix",
    path: "/skill-lens/api",
    async handler(req, res) {
      const url = new URL(req.url ?? "/", "http://dsh.internal");
      if (req.method !== "POST") {
        writeError(res, 405, "method not allowed");
        return;
      }
      const action = url.pathname.startsWith("/skill-lens/api/")
        ? url.pathname.slice("/skill-lens/api/".length)
        : "";
      if (action === "" || action.includes("/")) {
        writeError(res, 404, "unknown skill-lens API action");
        return;
      }

      let body: Record<string, unknown>;
      try {
        body = await readJsonBody(req);
      } catch {
        writeError(res, 400, "invalid JSON body");
        return;
      }

      try {
        // ---------- scan-stream（SSE 实时进度） ----------
        if (action === "scan-stream") {
          const explicit = typeof body.root === "string" && body.root !== "" ? body.root : null;
          const globalRoot = globalSkillsRoot();
          const defaultRoots = [projectSkillsRoot(ctx, body.sessionId), globalRoot];
          const rawRoots = explicit !== null ? [explicit] : defaultRoots;

          const sanitized: string[] = [];
          for (const raw of rawRoots) {
            const root = sanitizePath(raw);
            if (!root) {
              writeError(res, 400, "invalid root");
              return;
            }
            sanitized.push(root);
          }

          const resolved: string[] = [];
          for (const root of sanitized) {
            const info = await stat(root).catch(() => null);
            if (!info?.isDirectory()) continue;
            const real = await realpath(root);
            if (!resolved.some((existing) => isSameOrContained(real, existing))) {
              resolved.push(real);
            }
          }
          if (resolved.length === 0) {
            writeError(res, 404, "no scannable root exists");
            return;
          }
          for (const root of resolved) allowedRoots.add(root);

          // SSE 响应头
          res.writeHead(200, {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache",
            "connection": "keep-alive",
          });

          const sendEvent = (event: string, data: unknown): void => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          };

          try {
            const skills: { dir: string; root: string; rel: string; kind: "dir" | "file" }[] = [];
            for (const root of resolved) {
              for (const f of await discoverSkills(root, (scanned, found) => {
                sendEvent("progress", { scanned, found });
              })) {
                skills.push({ dir: f.dir, root, rel: f.rel, kind: f.kind });
              }
            }
            const orderOf = new Map(resolved.map((r, i) => [r, i]));
            skills.sort((a, b) => orderOf.get(a.root)! - orderOf.get(a.root)! || a.rel.localeCompare(b.rel));
            sendEvent("done", {
              ok: true,
              roots: resolved,
              globalRoot: await realpath(globalRoot).catch(() => globalRoot),
              skills,
            });
          } catch (err) {
            sendEvent("error", { ok: false, error: (err as Error).message });
          }
          res.end();
          return;
        }

        // ---------- scan ----------
        if (action === "scan") {
          // 默认双根：会话工作区下的 .dsh/skills（项目级 Skills 约定位置，不存在则跳过）
          // + 用户主目录下的 .dsh（DSH 全局 Skills 位置）。
          // body.root 仍可用于测试/显式覆盖。
          const explicit = typeof body.root === "string" && body.root !== "" ? body.root : null;
          const globalRoot = globalSkillsRoot();
          const defaultRoots = [projectSkillsRoot(ctx, body.sessionId), globalRoot];
          const rawRoots = explicit !== null ? [explicit] : defaultRoots;

          const sanitized: string[] = [];
          for (const raw of rawRoots) {
            const root = sanitizePath(raw);
            if (!root) {
              writeError(res, 400, "invalid root");
              return;
            }
            sanitized.push(root);
          }

          // realpath 解析 + 包含去重：外层根已覆盖内层根时只扫外层
          const resolved: string[] = [];
          for (const root of sanitized) {
            const info = await stat(root).catch(() => null);
            if (!info?.isDirectory()) continue;
            const real = await realpath(root);
            if (!resolved.some((existing) => isSameOrContained(real, existing))) {
              resolved.push(real);
            }
          }
          if (resolved.length === 0) {
            writeError(res, 404, "no scannable root exists");
            return;
          }
          for (const root of resolved) allowedRoots.add(root);

          const skills: { dir: string; root: string; rel: string; kind: "dir" | "file" }[] = [];
          for (const root of resolved) {
            for (const f of await discoverSkills(root)) {
              skills.push({ dir: f.dir, root, rel: f.rel, kind: f.kind });
            }
          }
          // 项目根（resolved 靠前）的技能排前面，同根内按相对路径排序
          const orderOf = new Map(resolved.map((r, i) => [r, i]));
          skills.sort((a, b) => orderOf.get(a.root)! - orderOf.get(b.root)! || a.rel.localeCompare(b.rel));
          writeJson(res, 200, {
            ok: true,
            roots: resolved,
            globalRoot: await realpath(globalRoot).catch(() => globalRoot),
            skills,
          });
          return;
        }

        // ---------- files（技能目录清单） ----------
        if (action === "files") {
          const dir = sanitizePath(body.dir);
          if (!dir) {
            writeError(res, 400, "invalid dir");
            return;
          }
          const resolved = await realpath(dir).catch(() => null);
          if (!resolved) {
            writeError(res, 404, "dir does not exist");
            return;
          }
          if (!isUnderAllowedRoot(resolved)) {
            writeError(res, 400, "dir is outside scanned workspace roots");
            return;
          }
          const info = await stat(resolved).catch(() => null);
          if (!info) {
            writeError(res, 404, "path does not exist");
            return;
          }
          if (info.isFile()) {
            // 扁平式技能：技能本身就是这个文件
            writeJson(res, 200, { ok: true, dir: resolved, files: [path.basename(resolved)], dirs: [] });
            return;
          }
          if (!info.isDirectory()) {
            writeError(res, 400, "path is neither a skill file nor a skill directory");
            return;
          }
          const hasSkillMd = await stat(path.join(resolved, SKILL_MD)).then(() => true, () => false);
          if (!hasSkillMd) {
            writeError(res, 400, `not a skill directory (missing ${SKILL_MD})`);
            return;
          }
          const { files, dirs } = await listSkillFiles(resolved);
          writeJson(res, 200, { ok: true, dir: resolved, files, dirs });
          return;
        }

        // ---------- resolve-refs（把技能引用解析到技能目录之外的共享资源） ----------
        if (action === "resolve-refs") {
          const rawDir = sanitizePath(body.dir);
          if (!rawDir) {
            writeError(res, 400, "invalid dir");
            return;
          }
          const resolvedDir = await realpath(rawDir).catch(() => null);
          if (!resolvedDir) {
            writeError(res, 404, "skill path does not exist");
            return;
          }
          if (!isUnderAllowedRoot(resolvedDir)) {
            writeError(res, 400, "skill path is outside scanned workspace roots");
            return;
          }
          const dirInfo = await stat(resolvedDir).catch(() => null);
          if (!dirInfo) {
            writeError(res, 404, "skill path does not exist");
            return;
          }
          // 解析基准：技能自身所在目录，以及其上一层
          // （技能常以 `../skill-refs/<file>` 引用与技能根平级的共享资料）
          const baseDir = dirInfo.isFile() ? path.dirname(resolvedDir) : resolvedDir;
          const baseDirs = [baseDir, path.dirname(baseDir)];
          // 技能目录内的文件**不是**共享资源：它们由技能自身的文件清单负责，
          // 若在这里重复返回，客户端会拿到一个本该按「文档/脚本/资产」分类的节点，
          // 于是它既算本地又算引用资源。（扁平技能只此一个文件，故只排它自己。）
          // 两侧都取 realpath 后再比：resolvedDir 已是 realpath，命中路径不是，
          // 而 Windows 上大小写与 8.3 短名都会让裸字符串比较失手。
          const isLocalHit = async (hit: string): Promise<boolean> => {
            const real = await realpath(hit).catch(() => hit);
            return dirInfo.isFile() ? real === resolvedDir : isSameOrContained(real, resolvedDir);
          };
          // 资源根：技能附近的同级 skill-refs（项目布局）在前，DSH_HOME 的在后
          const resourceRoots = [...siblingResourceRoots(baseDir), ...skillResourceRoots()];
          const refs = Array.isArray(body.refs) ? body.refs.slice(0, 400) : [];
          const resolvedRefs: { target: string; path: string; label: string }[] = [];
          const seen = new Set<string>();
          for (const raw of refs) {
            const item = raw as { kind?: unknown; target?: unknown } | null;
            if (item?.kind !== "relative-path" || typeof item.target !== "string") continue;
            if (seen.has(item.target)) continue;
            seen.add(item.target);
            const hit = await resolveReference(item.target, baseDirs, resourceRoots);
            if (hit === null || (await isLocalHit(hit))) continue;
            resolvedRefs.push({ target: item.target, path: hit, label: labelOfResource(hit) });
          }
          // 只放行解析到的文件所在目录，不整体放行 DSH_HOME
          for (const item of resolvedRefs) {
            allowedRoots.add(path.dirname(item.path));
          }
          writeJson(res, 200, { ok: true, resolved: resolvedRefs });
          return;
        }

        // ---------- read ----------
        if (action === "read") {
          const file = sanitizePath(body.path);
          if (!file) {
            writeError(res, 400, "invalid path");
            return;
          }
          const resolved = await realpath(file).catch(() => null);
          if (!resolved) {
            writeError(res, 404, "file does not exist");
            return;
          }
          const info = await stat(resolved).catch(() => null);
          if (!info?.isFile()) {
            writeError(res, 400, "not a file");
            return;
          }
          if (info.size > MAX_READ_BYTES) {
            writeError(res, 400, "file too large (>2MB)");
            return;
          }
          if (!isUnderAllowedRoot(resolved)) {
            writeError(res, 400, "path is outside scanned workspace roots");
            return;
          }
          const content = await readFile(resolved, "utf8");
          writeJson(res, 200, { ok: true, path: resolved, content });
          return;
        }

        // ---------- write ----------
        if (action === "write") {
          const file = sanitizePath(body.path);
          if (!file) {
            writeError(res, 400, "invalid path");
            return;
          }
          if (typeof body.content !== "string") {
            writeError(res, 400, "invalid content");
            return;
          }
          if (body.content.length > MAX_READ_BYTES) {
            writeError(res, 400, "content too large (>2MB)");
            return;
          }
          const resolved = await realpath(file).catch(() => null);
          if (!resolved) {
            writeError(res, 404, "file does not exist");
            return;
          }
          const info = await stat(resolved).catch(() => null);
          if (!info?.isFile()) {
            writeError(res, 400, "not a file");
            return;
          }
          if (!isUnderAllowedRoot(resolved)) {
            writeError(res, 400, "path is outside scanned workspace roots");
            return;
          }
          await writeFile(resolved, body.content, "utf8");
          writeJson(res, 200, { ok: true, path: resolved });
          return;
        }

        // ---------- delete ----------
        if (action === "delete") {
          const dir = sanitizePath(body.dir);
          if (!dir) {
            writeError(res, 400, "invalid dir");
            return;
          }
          const resolved = await realpath(dir).catch(() => null);
          if (!resolved) {
            writeError(res, 404, "dir does not exist");
            return;
          }
          if (resolved !== path.normalize(dir)) {
            writeError(res, 400, "path contains symlink traversal");
            return;
          }
          const parsed = path.parse(resolved);
          const depth = parsed.dir === parsed.root
            ? 1
            : parsed.dir.split(path.sep).filter(Boolean).length + 1;
          if (depth < 2) {
            writeError(res, 400, "refusing to delete a filesystem root");
            return;
          }
          const info = await stat(resolved).catch(() => null);
          if (info?.isFile()) {
            // 扁平式技能：只删这一个技能文件，不碰目录里的其他技能
            if (!isFlatSkillFile(path.basename(resolved))) {
              writeError(res, 400, "refusing to delete: not a skill file");
              return;
            }
            if (!isUnderAllowedRoot(resolved)) {
              writeError(res, 400, "path is outside scanned workspace roots");
              return;
            }
            try {
              await rm(resolved, { force: false });
            } catch (err) {
              writeError(res, 500, `delete failed: ${(err as Error).message}`);
              return;
            }
            writeJson(res, 200, { ok: true, dir: resolved });
            return;
          }
          const hasSkillMd = await stat(path.join(resolved, SKILL_MD)).then(() => true, () => false);
          if (!hasSkillMd) {
            writeError(res, 400, `refusing to delete: directory does not contain ${SKILL_MD}`);
            return;
          }
          try {
            await rm(resolved, { recursive: true, force: false });
          } catch (err) {
            writeError(res, 500, `delete failed: ${(err as Error).message}`);
            return;
          }
          writeJson(res, 200, { ok: true, dir: resolved });
          return;
        }

        // ---------- skill-meta（批量获取技能元数据：description + 创建时间） ----------
        if (action === "skill-meta") {
          const dirs = Array.isArray(body.dirs) ? body.dirs : [];
          if (dirs.length === 0) {
            writeError(res, 400, "dirs array is required");
            return;
          }
          if (dirs.length > 200) {
            writeError(res, 400, "单次最多 200 个");
            return;
          }
          const results: { dir: string; description: string; birthtime: string | null }[] = [];
          for (const raw of dirs) {
            const dir = sanitizePath(raw);
            if (!dir) {
              results.push({ dir: String(raw), description: "", birthtime: null });
              continue;
            }
            const resolved = await realpath(dir).catch(() => null);
            if (!resolved || !isUnderAllowedRoot(resolved)) {
              results.push({ dir: String(raw), description: "", birthtime: null });
              continue;
            }
            try {
              const st = await stat(resolved);
              const entryPath = st.isFile() ? resolved : path.join(resolved, SKILL_MD);
              const content = await readFile(entryPath, "utf-8");
              let description = "";
              const lines = content.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
              if (lines[0]?.trim() === "---") {
                for (let i = 1; i < lines.length; i++) {
                  if (lines[i].trim() === "---") break;
                  const m = lines[i].match(/^description:\s*(.+)/);
                  if (m) description = m[1].trim();
                }
              }
              results.push({ dir: resolved, description, birthtime: st.birthtime?.toISOString() ?? null });
            } catch {
              results.push({ dir: resolved, description: "", birthtime: null });
            }
          }
          writeJson(res, 200, { ok: true, results });
          return;
        }

        // ---------- create-skill（新建技能：模板 SKILL.md） ----------
        if (action === "create-skill") {
          if (!isValidSkillName(body.name)) {
            writeError(res, 400, "invalid skill name（字母/数字开头，仅含字母数字._-）");
            return;
          }
          const root = resolveTargetRoot(ctx, body.sessionId, body.location, body.root);
          if (!root) {
            writeError(res, 400, "location must be 'project' or 'global'");
            return;
          }
          const target = path.join(root, body.name);
          const exists = await stat(target).then(() => true, () => false);
          if (exists) {
            writeError(res, 409, `同名技能目录已存在：${body.name}`);
            return;
          }
          try {
            await mkdir(target, { recursive: true });
            const template = `---\nname: ${body.name}\ndescription: \n---\n\n# ${body.name}\n\n在此描述你的技能...\n`;
            await writeFile(path.join(target, SKILL_MD), template, "utf8");
            allowedRoots.add(await realpath(root).catch(() => root));
            writeJson(res, 200, { ok: true, dir: target });
          } catch (err) {
            writeError(res, 500, `create failed: ${(err as Error).message}`);
          }
          return;
        }

        // ---------- import-skill（导入技能：客户端读取/解压后传文件列表） ----------
        if (action === "import-skill") {
          if (!isValidSkillName(body.name)) {
            writeError(res, 400, "invalid skill name（字母/数字开头，仅含字母数字._-）");
            return;
          }
          const root = resolveTargetRoot(ctx, body.sessionId, body.location, body.root);
          if (!root) {
            writeError(res, 400, "location must be 'project' or 'global'");
            return;
          }
          const rawFiles = Array.isArray(body.files) ? body.files : [];
          if (rawFiles.length === 0) {
            writeError(res, 400, "files 不能为空");
            return;
          }
          if (rawFiles.length > 500) {
            writeError(res, 400, "文件数过多（单次最多 500 个）");
            return;
          }
          const files: { rel: string; data: Buffer }[] = [];
          let totalBytes = 0;
          for (const f of rawFiles) {
            const item = f as Record<string, unknown>;
            const rel = sanitizeImportRel(item.path);
            if (!rel || typeof item.content !== "string") {
              writeError(res, 400, `invalid file entry: ${String(item.path)}`);
              return;
            }
            const data = item.encoding === "base64"
              ? Buffer.from(item.content, "base64")
              : Buffer.from(item.content, "utf8");
            if (data.length > MAX_READ_BYTES) {
              writeError(res, 400, `file too large (>2MB): ${rel}`);
              return;
            }
            totalBytes += data.length;
            files.push({ rel, data });
          }
          if (totalBytes > 20 * 1024 * 1024) {
            writeError(res, 400, "总内容超过 20MB");
            return;
          }
          if (!files.some((f) => f.rel.toUpperCase() === SKILL_MD.toUpperCase())) {
            writeError(res, 400, `导入内容必须包含 ${SKILL_MD}`);
            return;
          }
          const target = path.join(root, body.name);
          const exists = await stat(target).then(() => true, () => false);
          if (exists) {
            writeError(res, 409, `同名技能目录已存在：${body.name}`);
            return;
          }
          try {
            await mkdir(target, { recursive: true });
            for (const f of files) {
              const abs = path.join(target, ...f.rel.split("/"));
              await mkdir(path.dirname(abs), { recursive: true });
              await writeFile(abs, f.data);
            }
            allowedRoots.add(await realpath(root).catch(() => root));
            writeJson(res, 200, { ok: true, dir: target });
          } catch (err) {
            writeError(res, 500, `import failed: ${(err as Error).message}`);
          }
          return;
        }

        // ---------- batch-delete ----------
        if (action === "batch-delete") {
          const dirs = Array.isArray(body.dirs) ? body.dirs : [];
          if (dirs.length === 0) {
            writeError(res, 400, "dirs array is required");
            return;
          }
          const results: { dir: string; ok: boolean; error?: string }[] = [];
          for (const raw of dirs) {
            const dir = sanitizePath(raw);
            if (!dir) {
              results.push({ dir: String(raw), ok: false, error: "invalid path" });
              continue;
            }
            const resolved = await realpath(dir).catch(() => null);
            if (!resolved) {
              results.push({ dir: dir, ok: false, error: "dir does not exist" });
              continue;
            }
            if (resolved !== path.normalize(dir)) {
              results.push({ dir: dir, ok: false, error: "symlink traversal" });
              continue;
            }
            const depth = path.parse(resolved).dir === path.parse(resolved).root
              ? 1
              : path.parse(resolved).dir.split(path.sep).filter(Boolean).length + 1;
            if (depth < 2) {
              results.push({ dir: dir, ok: false, error: "refusing to delete root" });
              continue;
            }
            const info = await stat(resolved).catch(() => null);
            if (info?.isFile()) {
              // 扁平式技能：只删文件本身
              if (!isFlatSkillFile(path.basename(resolved)) || !isUnderAllowedRoot(resolved)) {
                results.push({ dir: dir, ok: false, error: "refusing to delete: not a skill file" });
                continue;
              }
              try {
                await rm(resolved, { force: false });
                results.push({ dir: resolved, ok: true });
              } catch (err) {
                results.push({ dir: resolved, ok: false, error: (err as Error).message });
              }
              continue;
            }
            const hasSkillMd = await stat(path.join(resolved, SKILL_MD)).then(() => true, () => false);
            if (!hasSkillMd) {
              results.push({ dir: dir, ok: false, error: `missing ${SKILL_MD}` });
              continue;
            }
            try {
              await rm(resolved, { recursive: true, force: false });
              results.push({ dir: resolved, ok: true });
            } catch (err) {
              results.push({ dir: resolved, ok: false, error: (err as Error).message });
            }
          }
          writeJson(res, 200, { ok: true, results });
          return;
        }

        // ---------- batch-export（ZIP 下载） ----------
        if (action === "batch-export") {
          const dirs = Array.isArray(body.dirs) ? body.dirs : [];
          if (dirs.length === 0) {
            writeError(res, 400, "dirs array is required");
            return;
          }
          const resolvedDirs: string[] = [];
          for (const raw of dirs) {
            const dir = sanitizePath(raw);
            if (!dir) continue;
            const real = await realpath(dir).catch(() => null);
            if (!real) continue;
            if (!isUnderAllowedRoot(real)) continue;
            resolvedDirs.push(real);
          }
          if (resolvedDirs.length === 0) {
            writeError(res, 400, "no valid skill directories");
            return;
          }
          res.writeHead(200, {
            "content-type": "application/zip",
            "content-disposition": 'attachment; filename="skills.zip"',
          });
          try {
            const allEntries: ZipEntry[] = [];
            for (const dir of resolvedDirs) {
              const info = await stat(dir).catch(() => null);
              if (info?.isFile()) {
                // 扁平式技能：ZIP 内直接以技能文件名呈现
                allEntries.push({ name: path.basename(dir), data: await readFile(dir) });
                continue;
              }
              const name = path.basename(dir);
              const entries = await collectDirFiles(dir, name);
              allEntries.push(...entries);
            }
            const zip = buildZip(allEntries);
            res.end(zip);
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: (err as Error).message }));
          }
          return;
        }

        writeError(res, 404, `unknown action: ${action}`);
      } catch (err) {
        writeError(res, 500, `internal error: ${(err as Error).message}`);
      }
    },
  });
}
