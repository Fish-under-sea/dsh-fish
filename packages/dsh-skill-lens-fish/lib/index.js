// src/index.ts
import { readFile, readdir, rm, stat, realpath, writeFile, mkdir } from "node:fs/promises";
import { crc32 } from "node:zlib";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
var inject = ["webServer", "sessions"];
var SKILL_MD = "SKILL.md";
var MAX_DIRS = 2e4;
var MAX_READ_BYTES = 2 * 1024 * 1024;
var FLAT_SKILL_EXT = ".md";
var FLAT_SKILL_EXCLUDED = /* @__PURE__ */ new Set(["readme.md", "index.md", "skill.md"]);
var DEFAULT_EXCLUDED_DIRS = /* @__PURE__ */ new Set([
  ".git",
  ".svn",
  ".hg",
  ".Trash",
  "$RECYCLE.BIN",
  "System Volume Information",
  "node_modules",
  "bower_components",
  "vendor",
  ".yarn",
  ".pnp",
  "Pods",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".output",
  ".svelte-kit",
  ".turbo",
  ".parcel-cache",
  "target",
  "DerivedData",
  "coverage",
  "__pycache__",
  ".cache",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".tox",
  ".terraform",
  ".serverless",
  ".venv",
  "venv",
  ".idea",
  ".vscode",
  ".gradle"
]);
function sessionCwdOf(ctx, sessionId) {
  if (typeof sessionId === "string" && sessionId !== "") {
    try {
      const cwd = ctx.sessions?.get?.(sessionId)?.header?.cwd;
      if (typeof cwd === "string" && cwd !== "" && path.isAbsolute(cwd)) return cwd;
    } catch {
    }
  }
  return process.cwd();
}
function projectSkillsRoot(ctx, sessionId) {
  return path.join(sessionCwdOf(ctx, sessionId), ".dsh", "skills");
}
function globalSkillsRoot() {
  const candidates = [];
  const home = (process.env.DSH_HOME ?? "").trim();
  if (home !== "" && path.isAbsolute(home)) {
    candidates.push(path.join(home, "skills"), home);
  }
  const fallback = path.join(os.homedir(), ".dsh");
  candidates.push(path.join(fallback, "skills"), fallback);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[candidates.length - 1];
}
function skillResourceRoots() {
  const roots = [];
  const home = (process.env.DSH_HOME ?? "").trim();
  if (home !== "" && path.isAbsolute(home)) {
    roots.push(path.join(home, "skill-refs"));
  }
  roots.push(path.join(os.homedir(), ".dsh", "skill-refs"));
  return roots;
}
function expandHomeVars(target) {
  const home = (process.env.DSH_HOME ?? "").trim();
  let rest = null;
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
function writeJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
function writeError(res, status, message) {
  writeJson(res, status, { ok: false, error: message });
}
async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.trim() === "") return {};
  return JSON.parse(text);
}
function sanitizePath(raw) {
  if (typeof raw !== "string") return null;
  if (raw === "" || raw.includes("\0") || raw.trim() !== raw) return null;
  if (!path.isAbsolute(raw)) return null;
  return raw;
}
function isValidSkillName(name) {
  return typeof name === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(name);
}
function resolveTargetRoot(ctx, sessionId, location, explicitRoot) {
  if (typeof explicitRoot === "string" && explicitRoot !== "") {
    return sanitizePath(explicitRoot);
  }
  if (location === "global") return path.join(os.homedir(), ".dsh");
  if (location === "project") return projectSkillsRoot(ctx, sessionId);
  return null;
}
function sanitizeImportRel(raw) {
  if (typeof raw !== "string" || raw === "" || raw.includes("\0")) return null;
  const rel = raw.replace(/\\/g, "/");
  if (rel.startsWith("/") || /^[a-zA-Z]:/.test(rel)) return null;
  const norm = path.posix.normalize(rel);
  if (norm === ".." || norm.startsWith("../") || path.posix.isAbsolute(norm)) return null;
  return norm;
}
function isFlatSkillFile(name) {
  if (!name.toLowerCase().endsWith(FLAT_SKILL_EXT)) return false;
  if (name === SKILL_MD) return false;
  return !FLAT_SKILL_EXCLUDED.has(name.toLowerCase());
}
async function discoverSkills(rootPath, onProgress) {
  const found = [];
  const queue = [
    { abs: rootPath, rel: "", insideSkill: false }
  ];
  let scanned = 0;
  let reportCounter = 0;
  while (queue.length > 0) {
    if (scanned >= MAX_DIRS) break;
    const item = queue.shift();
    let entries;
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
            insideSkill: item.insideSkill || hasSkillMd
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
    reportCounter++;
    if (onProgress && reportCounter >= 200) {
      reportCounter = 0;
      onProgress(scanned, found.length);
    }
  }
  if (onProgress) onProgress(scanned, found.length);
  found.sort((a, b) => a.rel.localeCompare(b.rel));
  return found;
}
async function listSkillFiles(skillDir) {
  const files = [];
  const dirs = [];
  const queue = [skillDir];
  let budget = 2e3;
  while (queue.length > 0 && budget-- > 0) {
    const dir = queue.shift();
    let entries;
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
async function findByBasename(root, base) {
  const needle = base.toLowerCase();
  const queue = [root];
  let scanned = 0;
  while (queue.length > 0) {
    if (scanned >= 500) break;
    const dir = queue.shift();
    let entries;
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
function labelOfResource(filePath) {
  const home = (process.env.DSH_HOME ?? "").trim();
  if (home !== "" && path.isAbsolute(home)) {
    const rel = path.relative(home, filePath);
    if (rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)) {
      return rel.split(path.sep).join("/");
    }
  }
  return filePath.replace(/\\/g, "/");
}
function siblingResourceRoots(baseDir) {
  const roots = [];
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
async function resolveReference(target, baseDirs, resourceRoots) {
  const raw = (target.split("#")[0] ?? "").split("?")[0].trim();
  if (raw === "") return null;
  const expanded = expandHomeVars(raw);
  const tries = [];
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
var allowedRoots = /* @__PURE__ */ new Set([process.cwd()]);
function isSameOrContained(a, b) {
  if (a === b) return true;
  const rel = path.relative(b, a);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}
function isUnderAllowedRoot(resolved) {
  for (const root of allowedRoots) {
    if (isSameOrContained(resolved, root)) return true;
  }
  return false;
}
function dosTime(d) {
  return d.getSeconds() >> 1 | d.getMinutes() << 5 | d.getHours() << 11;
}
function dosDate(d) {
  return d.getDate() | d.getMonth() + 1 << 5 | d.getFullYear() - 1980 << 9;
}
function buildZip(entries) {
  const chunks = [];
  const centralHeaders = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data) >>> 0;
    const now = /* @__PURE__ */ new Date();
    const dt = dosTime(now);
    const dd = dosDate(now);
    const lh = Buffer.alloc(30 + nameBuf.length);
    lh.writeUInt32LE(67324752, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(dt, 10);
    lh.writeUInt16LE(dd, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(entry.data.length, 18);
    lh.writeUInt32LE(entry.data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    nameBuf.copy(lh, 30);
    chunks.push(lh, entry.data);
    const ch = Buffer.alloc(46 + nameBuf.length);
    ch.writeUInt32LE(33639248, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(dt, 12);
    ch.writeUInt16LE(dd, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(entry.data.length, 20);
    ch.writeUInt32LE(entry.data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    nameBuf.copy(ch, 46);
    centralHeaders.push(ch);
    offset += lh.length + entry.data.length;
  }
  const centralDirOffset = offset;
  const centralDirSize = centralHeaders.reduce((s, b) => s + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(101010256, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, ...centralHeaders, eocd]);
}
async function collectDirFiles(dirPath, prefix) {
  const entries = [];
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
function apply(ctx) {
  ctx.webServer.register({
    kind: "prefix",
    path: "/skill-lens/api",
    async handler(req, res) {
      const url = new URL(req.url ?? "/", "http://dsh.internal");
      if (req.method !== "POST") {
        writeError(res, 405, "method not allowed");
        return;
      }
      const action = url.pathname.startsWith("/skill-lens/api/") ? url.pathname.slice("/skill-lens/api/".length) : "";
      if (action === "" || action.includes("/")) {
        writeError(res, 404, "unknown skill-lens API action");
        return;
      }
      let body;
      try {
        body = await readJsonBody(req);
      } catch {
        writeError(res, 400, "invalid JSON body");
        return;
      }
      try {
        if (action === "scan-stream") {
          const explicit = typeof body.root === "string" && body.root !== "" ? body.root : null;
          const globalRoot = globalSkillsRoot();
          const defaultRoots = [projectSkillsRoot(ctx, body.sessionId), globalRoot];
          const rawRoots = explicit !== null ? [explicit] : defaultRoots;
          const sanitized = [];
          for (const raw of rawRoots) {
            const root = sanitizePath(raw);
            if (!root) {
              writeError(res, 400, "invalid root");
              return;
            }
            sanitized.push(root);
          }
          const resolved = [];
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
          res.writeHead(200, {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache",
            "connection": "keep-alive"
          });
          const sendEvent = (event, data) => {
            res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
          };
          try {
            const skills = [];
            for (const root of resolved) {
              for (const f of await discoverSkills(root, (scanned, found) => {
                sendEvent("progress", { scanned, found });
              })) {
                skills.push({ dir: f.dir, root, rel: f.rel, kind: f.kind });
              }
            }
            const orderOf = new Map(resolved.map((r, i) => [r, i]));
            skills.sort((a, b) => orderOf.get(a.root) - orderOf.get(a.root) || a.rel.localeCompare(b.rel));
            sendEvent("done", {
              ok: true,
              roots: resolved,
              globalRoot: await realpath(globalRoot).catch(() => globalRoot),
              skills
            });
          } catch (err) {
            sendEvent("error", { ok: false, error: err.message });
          }
          res.end();
          return;
        }
        if (action === "scan") {
          const explicit = typeof body.root === "string" && body.root !== "" ? body.root : null;
          const globalRoot = globalSkillsRoot();
          const defaultRoots = [projectSkillsRoot(ctx, body.sessionId), globalRoot];
          const rawRoots = explicit !== null ? [explicit] : defaultRoots;
          const sanitized = [];
          for (const raw of rawRoots) {
            const root = sanitizePath(raw);
            if (!root) {
              writeError(res, 400, "invalid root");
              return;
            }
            sanitized.push(root);
          }
          const resolved = [];
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
          const skills = [];
          for (const root of resolved) {
            for (const f of await discoverSkills(root)) {
              skills.push({ dir: f.dir, root, rel: f.rel, kind: f.kind });
            }
          }
          const orderOf = new Map(resolved.map((r, i) => [r, i]));
          skills.sort((a, b) => orderOf.get(a.root) - orderOf.get(b.root) || a.rel.localeCompare(b.rel));
          writeJson(res, 200, {
            ok: true,
            roots: resolved,
            globalRoot: await realpath(globalRoot).catch(() => globalRoot),
            skills
          });
          return;
        }
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
          const baseDir = dirInfo.isFile() ? path.dirname(resolvedDir) : resolvedDir;
          const baseDirs = [baseDir, path.dirname(baseDir)];
          const isLocalHit = async (hit) => {
            const real = await realpath(hit).catch(() => hit);
            return dirInfo.isFile() ? real === resolvedDir : isSameOrContained(real, resolvedDir);
          };
          const resourceRoots = [...siblingResourceRoots(baseDir), ...skillResourceRoots()];
          const refs = Array.isArray(body.refs) ? body.refs.slice(0, 400) : [];
          const resolvedRefs = [];
          const seen = /* @__PURE__ */ new Set();
          for (const raw of refs) {
            const item = raw;
            if (item?.kind !== "relative-path" || typeof item.target !== "string") continue;
            if (seen.has(item.target)) continue;
            seen.add(item.target);
            const hit = await resolveReference(item.target, baseDirs, resourceRoots);
            if (hit === null || await isLocalHit(hit)) continue;
            resolvedRefs.push({ target: item.target, path: hit, label: labelOfResource(hit) });
          }
          for (const item of resolvedRefs) {
            allowedRoots.add(path.dirname(item.path));
          }
          writeJson(res, 200, { ok: true, resolved: resolvedRefs });
          return;
        }
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
          const depth = parsed.dir === parsed.root ? 1 : parsed.dir.split(path.sep).filter(Boolean).length + 1;
          if (depth < 2) {
            writeError(res, 400, "refusing to delete a filesystem root");
            return;
          }
          const info = await stat(resolved).catch(() => null);
          if (info?.isFile()) {
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
              writeError(res, 500, `delete failed: ${err.message}`);
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
            writeError(res, 500, `delete failed: ${err.message}`);
            return;
          }
          writeJson(res, 200, { ok: true, dir: resolved });
          return;
        }
        if (action === "skill-meta") {
          const dirs = Array.isArray(body.dirs) ? body.dirs : [];
          if (dirs.length === 0) {
            writeError(res, 400, "dirs array is required");
            return;
          }
          if (dirs.length > 200) {
            writeError(res, 400, "\u5355\u6B21\u6700\u591A 200 \u4E2A");
            return;
          }
          const results = [];
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
        if (action === "create-skill") {
          if (!isValidSkillName(body.name)) {
            writeError(res, 400, "invalid skill name\uFF08\u5B57\u6BCD/\u6570\u5B57\u5F00\u5934\uFF0C\u4EC5\u542B\u5B57\u6BCD\u6570\u5B57._-\uFF09");
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
            writeError(res, 409, `\u540C\u540D\u6280\u80FD\u76EE\u5F55\u5DF2\u5B58\u5728\uFF1A${body.name}`);
            return;
          }
          try {
            await mkdir(target, { recursive: true });
            const template = `---
name: ${body.name}
description: 
---

# ${body.name}

\u5728\u6B64\u63CF\u8FF0\u4F60\u7684\u6280\u80FD...
`;
            await writeFile(path.join(target, SKILL_MD), template, "utf8");
            allowedRoots.add(await realpath(root).catch(() => root));
            writeJson(res, 200, { ok: true, dir: target });
          } catch (err) {
            writeError(res, 500, `create failed: ${err.message}`);
          }
          return;
        }
        if (action === "import-skill") {
          if (!isValidSkillName(body.name)) {
            writeError(res, 400, "invalid skill name\uFF08\u5B57\u6BCD/\u6570\u5B57\u5F00\u5934\uFF0C\u4EC5\u542B\u5B57\u6BCD\u6570\u5B57._-\uFF09");
            return;
          }
          const root = resolveTargetRoot(ctx, body.sessionId, body.location, body.root);
          if (!root) {
            writeError(res, 400, "location must be 'project' or 'global'");
            return;
          }
          const rawFiles = Array.isArray(body.files) ? body.files : [];
          if (rawFiles.length === 0) {
            writeError(res, 400, "files \u4E0D\u80FD\u4E3A\u7A7A");
            return;
          }
          if (rawFiles.length > 500) {
            writeError(res, 400, "\u6587\u4EF6\u6570\u8FC7\u591A\uFF08\u5355\u6B21\u6700\u591A 500 \u4E2A\uFF09");
            return;
          }
          const files = [];
          let totalBytes = 0;
          for (const f of rawFiles) {
            const item = f;
            const rel = sanitizeImportRel(item.path);
            if (!rel || typeof item.content !== "string") {
              writeError(res, 400, `invalid file entry: ${String(item.path)}`);
              return;
            }
            const data = item.encoding === "base64" ? Buffer.from(item.content, "base64") : Buffer.from(item.content, "utf8");
            if (data.length > MAX_READ_BYTES) {
              writeError(res, 400, `file too large (>2MB): ${rel}`);
              return;
            }
            totalBytes += data.length;
            files.push({ rel, data });
          }
          if (totalBytes > 20 * 1024 * 1024) {
            writeError(res, 400, "\u603B\u5185\u5BB9\u8D85\u8FC7 20MB");
            return;
          }
          if (!files.some((f) => f.rel.toUpperCase() === SKILL_MD.toUpperCase())) {
            writeError(res, 400, `\u5BFC\u5165\u5185\u5BB9\u5FC5\u987B\u5305\u542B ${SKILL_MD}`);
            return;
          }
          const target = path.join(root, body.name);
          const exists = await stat(target).then(() => true, () => false);
          if (exists) {
            writeError(res, 409, `\u540C\u540D\u6280\u80FD\u76EE\u5F55\u5DF2\u5B58\u5728\uFF1A${body.name}`);
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
            writeError(res, 500, `import failed: ${err.message}`);
          }
          return;
        }
        if (action === "batch-delete") {
          const dirs = Array.isArray(body.dirs) ? body.dirs : [];
          if (dirs.length === 0) {
            writeError(res, 400, "dirs array is required");
            return;
          }
          const results = [];
          for (const raw of dirs) {
            const dir = sanitizePath(raw);
            if (!dir) {
              results.push({ dir: String(raw), ok: false, error: "invalid path" });
              continue;
            }
            const resolved = await realpath(dir).catch(() => null);
            if (!resolved) {
              results.push({ dir, ok: false, error: "dir does not exist" });
              continue;
            }
            if (resolved !== path.normalize(dir)) {
              results.push({ dir, ok: false, error: "symlink traversal" });
              continue;
            }
            const depth = path.parse(resolved).dir === path.parse(resolved).root ? 1 : path.parse(resolved).dir.split(path.sep).filter(Boolean).length + 1;
            if (depth < 2) {
              results.push({ dir, ok: false, error: "refusing to delete root" });
              continue;
            }
            const info = await stat(resolved).catch(() => null);
            if (info?.isFile()) {
              if (!isFlatSkillFile(path.basename(resolved)) || !isUnderAllowedRoot(resolved)) {
                results.push({ dir, ok: false, error: "refusing to delete: not a skill file" });
                continue;
              }
              try {
                await rm(resolved, { force: false });
                results.push({ dir: resolved, ok: true });
              } catch (err) {
                results.push({ dir: resolved, ok: false, error: err.message });
              }
              continue;
            }
            const hasSkillMd = await stat(path.join(resolved, SKILL_MD)).then(() => true, () => false);
            if (!hasSkillMd) {
              results.push({ dir, ok: false, error: `missing ${SKILL_MD}` });
              continue;
            }
            try {
              await rm(resolved, { recursive: true, force: false });
              results.push({ dir: resolved, ok: true });
            } catch (err) {
              results.push({ dir: resolved, ok: false, error: err.message });
            }
          }
          writeJson(res, 200, { ok: true, results });
          return;
        }
        if (action === "batch-export") {
          const dirs = Array.isArray(body.dirs) ? body.dirs : [];
          if (dirs.length === 0) {
            writeError(res, 400, "dirs array is required");
            return;
          }
          const resolvedDirs = [];
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
            "content-disposition": 'attachment; filename="skills.zip"'
          });
          try {
            const allEntries = [];
            for (const dir of resolvedDirs) {
              const info = await stat(dir).catch(() => null);
              if (info?.isFile()) {
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
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
          return;
        }
        writeError(res, 404, `unknown action: ${action}`);
      } catch (err) {
        writeError(res, 500, `internal error: ${err.message}`);
      }
    }
  });
}
export {
  apply,
  inject
};
