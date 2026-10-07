#!/usr/bin/env node
/**
 * DSH 视觉伴侣（visual companion）—— 单文件、零依赖、Node `^22.19.0 || >=24.0.0`（与 package.json 的 engines 一致）
 *
 * 用途：头脑风暴时把原型 / 线框 / 并排对比渲染到浏览器（DSH 里用 sidebar_open 开在右侧栏），
 *      用户在页面上点选 A/B/C，点击事件落到 events.jsonl，模型下一轮读它。
 *
 * 用法：
 *   node visual-companion.mjs --dir <根目录> [--port 0] [--host 127.0.0.1] [--idle-minutes 240]
 *   --dir 下自动建 screen/（放 HTML 屏）与 state/（events.jsonl、server-info、server-stopped）
 *
 * 端点（全部要求 ?key=<会话密钥>，且带 CORS 头以支持沙箱 iframe）：
 *   GET  /            → 渲染 screen/ 里最新的 .html（片段自动套框架；完整文档只注入辅助脚本）
 *   GET  /version     → {"latest":"layout-v2.html","mtime":...}（页面每秒轮询，变了就刷新）
 *   GET  /health      → {"ok":true,...}（模型用它确认服务还活着）
 *   POST /event       → 追加一行 JSON 到 state/events.jsonl（simple request，无预检）
 *   GET  /shutdown    → 优雅退出，写 state/server-stopped
 *
 * 启动后 stdout 打印一行 JSON（同时写到 state/server-info）：url / port / key / screenDir / stateDir / pid。
 * 空闲 --idle-minutes（默认 240）无屏幕变更且无事件则自动退出。
 */
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile, appendFile } from "node:fs/promises";
import { join, resolve, basename } from "node:path";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

const root = resolve(arg("dir", ""));
if (root === "") {
  console.error("需要 --dir <根目录>");
  process.exit(2);
}
const port = Number(arg("port", "0"));
const host = arg("host", "127.0.0.1");
const idleMinutes = Number(arg("idle-minutes", "240"));
/** 目标会话（可选）：随点击一起写进 pending.json，唤醒插件据此投递。 */
const sessionId = arg("session", "");
const screenDir = join(root, "screen");
const stateDir = join(root, "state");
const eventsFile = join(stateDir, "events.jsonl");
const pendingFile = join(stateDir, "pending.json");
const infoFile = join(stateDir, "server-info");
const stoppedFile = join(stateDir, "server-stopped");
const key = randomBytes(9).toString("hex");

await mkdir(screenDir, { recursive: true });
await mkdir(stateDir, { recursive: true });

let lastTouch = Date.now();
let shuttingDown = false;

const FRAME = `<!DOCTYPE html>
<html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>视觉伴侣</title><style>
:root{--bg:#fbfbfc;--fg:#1b1d21;--muted:#6b7280;--line:#e3e5e9;--card:#fff;--accent:#3b6ef6;--sel:#e8f0ff}
@media (prefers-color-scheme:dark){:root{--bg:#17181b;--fg:#e7e8ea;--muted:#9aa0a8;--line:#2c2f35;--card:#1f2126;--accent:#6f97ff;--sel:#22304a}}
*{box-sizing:border-box}body{margin:0;padding:18px 20px;background:var(--bg);color:var(--fg);
font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue","Microsoft YaHei",sans-serif}
h2{font-size:19px;margin:0 0 4px}h3{font-size:15px;margin:0 0 2px}.subtitle{color:var(--muted);margin:0 0 14px}
.label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.section{margin-bottom:16px}.options{display:flex;flex-direction:column;gap:10px}
.option{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--card);cursor:pointer}
.option:hover{border-color:var(--accent)}.option.selected{background:var(--sel);border-color:var(--accent)}
.option .letter{font-weight:700;color:var(--accent);min-width:16px}.option .content{min-width:0}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.card{border:1px solid var(--line);border-radius:10px;background:var(--card);overflow:hidden;cursor:pointer}
.card.selected{border-color:var(--accent);box-shadow:0 0 0 2px var(--sel)}.card-image{padding:14px;border-bottom:1px solid var(--line)}
.card-body{padding:10px 12px}.mockup{border:1px solid var(--line);border-radius:10px;background:var(--card);overflow:hidden}
.mockup-header{padding:7px 12px;border-bottom:1px solid var(--line);color:var(--muted);font-size:12px}
.mockup-body{padding:14px}.split{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pros-cons{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pros,.cons{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--card)}
.pros h4,.cons h4{margin:0 0 6px;font-size:13px}.pros ul,.cons ul{margin:0;padding-left:18px}
.mock-nav{padding:9px 12px;border:1px dashed var(--line);border-radius:8px;color:var(--muted);margin-bottom:10px}
.mock-sidebar,.mock-content{border:1px dashed var(--line);border-radius:8px;padding:12px;color:var(--muted);margin:4px}
.mock-sidebar{width:120px;flex:none}.mock-content{flex:auto}
.mock-button{display:inline-block;padding:7px 12px;border-radius:8px;background:var(--accent);color:#fff;border:0;font:inherit;margin:4px 0}
.mock-input{display:block;width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);margin:6px 0}
.placeholder{border:1px dashed var(--line);border-radius:8px;padding:22px;text-align:center;color:var(--muted);margin:6px 0}
footer{position:sticky;bottom:0;margin-top:16px;padding:10px 0;background:var(--bg);border-top:1px solid var(--line);
display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;font-size:12px;color:var(--muted)}
footer .left{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
footer #picked{color:var(--fg);font-weight:600}
footer #note{margin:0;max-width:300px;padding:6px 8px}
footer .mock-button{margin:0}
footer .mock-button[disabled]{opacity:.5;cursor:default}
</style></head><body>
<main id="c">__CONTENT__</main>
<footer id="bar">
<div class="left"><span class="label">已选</span><span id="picked">未选择</span>
<input id="note" class="mock-input" placeholder="补充说明（可选）" oninput="renderBar()"></div>
<button id="submit" class="mock-button" onclick="submitChoice()">提交给助手</button>
<span id="st">已连接</span>
</footer>
<script>
var KEY="__KEY__", last=null, picked={};
/* 点选只改本地状态：不请求、不唤醒；只有「提交给助手」才唤醒一次。 */
function toggleSelect(el){var box=el.closest(".options,.cards");var multi=box&&box.hasAttribute("data-multiselect");
var choice=el.getAttribute("data-choice")||"";
var text=(el.textContent||"").replace(/\s+/g," ").trim().slice(0,200);
if(!multi&&box){box.querySelectorAll(".option,.card").forEach(function(n){n.classList.remove("selected")});}
el.classList.toggle("selected");
if(el.classList.contains("selected")){picked[choice]=text;}else{delete picked[choice];}
renderBar();return false;}
function renderBar(){var keys=Object.keys(picked);var note=(document.getElementById("note").value||"").trim();
document.getElementById("picked").textContent=keys.length===0?"未选择":keys.map(function(k){return k.toUpperCase()}).join("、");
var b=document.getElementById("submit");b.disabled=(keys.length===0&&note==="");
b.textContent=keys.length===0?"提交给助手":"提交给助手（"+keys.length+" 项）";}
function submitChoice(){var keys=Object.keys(picked);var note=(document.getElementById("note").value||"").trim();
if(keys.length===0&&note===""){return false;}
var payload={type:"submit",selections:keys.map(function(k){return {choice:k,text:picked[k]}}),note:note,ts:Date.now()};
var b=document.getElementById("submit");b.disabled=true;b.textContent="已提交，等待助手…";
document.getElementById("st").textContent="已提交";
try{fetch("/event?key="+KEY,{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify(payload)});}catch(e){}
return false;}
if(document.querySelector(".option,.card")===null){document.getElementById("bar").style.display="none";}
renderBar();
setInterval(function(){if(!last){fetch("/version?key="+KEY,{cache:"no-store"}).then(function(r){return r.json()})
.then(function(j){last=j.latest;}).catch(function(){document.getElementById("st").textContent="已断开";});return;}
fetch("/version?key="+KEY,{cache:"no-store"}).then(function(r){return r.json()}).then(function(j){
if(j.latest!==last){location.reload();}last=j.latest;document.getElementById("st").textContent="已连接";})
.catch(function(){document.getElementById("st").textContent="已断开";});},1000);
</script></body></html>`;

const WAITING = `<div style="display:flex;align-items:center;justify-content:center;min-height:60vh;flex-direction:column">
<h2>在终端中继续…</h2><p class="subtitle">下一个需要看图的问题会推送到这里</p></div>`;

async function latestScreen() {
  let files;
  try { files = (await readdir(screenDir)).filter((n) => n.toLowerCase().endsWith(".html")); } catch { return null; }
  if (files.length === 0) return null;
  let best = null;
  for (const f of files) {
    const s = await stat(join(screenDir, f)).catch(() => null);
    if (s && (best === null || s.mtimeMs > best.mtimeMs)) best = { name: f, mtimeMs: s.mtimeMs, size: s.size };
  }
  return best;
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function send(res, code, type, body) {
  cors(res);
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

async function renderScreen() {
  const latest = await latestScreen();
  if (latest === null) return { name: null, html: FRAME.replace("__CONTENT__", WAITING).replace("__KEY__", key) };
  const raw = await readFile(join(screenDir, latest.name), "utf8");
  const full = /^\s*(<!DOCTYPE|<html)/i.test(raw);
  const html = full
    ? raw.replace(/<head([^>]*)>/i, `<head$1><script>var KEY="${key}";</script>`)
    : FRAME.replace("__CONTENT__", raw).replace("__KEY__", key);
  return { name: latest.name, html };
}

async function countLines(file) {
  try { const t = await readFile(file, "utf8"); return t.trim() === "" ? 0 : t.trim().split("\n").length; } catch { return 0; }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  if (req.method === "OPTIONS") return send(res, 204, "text/plain", "");
  if (url.searchParams.get("key") !== key) return send(res, 403, "text/plain", "forbidden");
  lastTouch = Date.now();
  try {
    if (req.method === "GET" && url.pathname === "/") {
      const { html } = await renderScreen();
      return send(res, 200, "text/html; charset=utf-8", html);
    }
    if (req.method === "GET" && url.pathname === "/version") {
      const latest = await latestScreen();
      return send(res, 200, "application/json", JSON.stringify({ latest: latest?.name ?? null, mtime: latest?.mtimeMs ?? 0 }));
    }
    if (req.method === "GET" && url.pathname === "/health") {
      const latest = await latestScreen();
      return send(res, 200, "application/json", JSON.stringify({
        ok: true, pid: process.pid, uptimeSec: Math.round(process.uptime()),
        latest: latest?.name ?? null, events: await countLines(eventsFile), idleSec: Math.round((Date.now() - lastTouch) / 1000),
      }));
    }
    if (req.method === "POST" && url.pathname === "/event") {
      let body = "";
      for await (const chunk of req) body += chunk;
      let parsed;
      try { parsed = JSON.parse(body); } catch { return send(res, 400, "text/plain", "bad json"); }
      // 文本来自页面卡片，可能带换行/缩进：压成单行，注入消息才干净。
      const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
      const record = { ...parsed, at: new Date().toISOString(), ...(sessionId === "" ? {} : { sessionId }) };
      if (parsed.note !== undefined) record.note = clean(parsed.note);
      if (Array.isArray(parsed.selections)) {
        record.selections = parsed.selections.map((s) => ({ choice: clean(s?.choice), text: clean(s?.text) }));
      } else if (parsed.text !== undefined) {
        record.text = clean(parsed.text);
      }
      await appendFile(eventsFile, `${JSON.stringify(record)}\n`, "utf8");
      // 只有「提交」才写 pending.json（唤醒插件观察它）：点选过程不唤醒。
      if (record.type === "submit") {
        // 兼容字段：老版唤醒插件读 choice/text，新版读 selections/note。
        const legacy = { ...record };
        if (legacy.choice === undefined) legacy.choice = (record.selections ?? []).map((s) => s.choice).join(",");
        if (legacy.text === undefined) legacy.text = (record.selections ?? []).map((s) => s.text).join(" / ") || record.note || "";
        await writeFile(pendingFile, JSON.stringify(legacy), "utf8");
      }
      return send(res, 200, "application/json", JSON.stringify({ ok: true }));
    }
    if (url.pathname === "/shutdown") {
      await writeFile(stoppedFile, JSON.stringify({ at: new Date().toISOString(), reason: "shutdown" }), "utf8");
      send(res, 200, "application/json", JSON.stringify({ ok: true, stopping: true }));
      shuttingDown = true;
      setTimeout(() => process.exit(0), 50).unref?.();
      return;
    }
    return send(res, 404, "text/plain", "not found");
  } catch (error) {
    return send(res, 500, "text/plain", String(error?.message ?? error));
  }
});

server.listen(port, host, async () => {
  const actual = server.address().port;
  const info = {
    type: "server-started",
    url: `http://${host}:${actual}/?key=${key}`,
    port: actual, host, key,
    screenDir, stateDir, eventsFile, pendingFile,
    session: sessionId === "" ? null : sessionId,
    idleMinutes, pid: process.pid, startedAt: new Date().toISOString(),
  };
  await writeFile(infoFile, JSON.stringify(info, null, 2), "utf8");
  console.log(JSON.stringify(info));
});

setInterval(() => {
  if (shuttingDown) return;
  if ((Date.now() - lastTouch) / 60000 >= idleMinutes) {
    writeFile(stoppedFile, JSON.stringify({ at: new Date().toISOString(), reason: "idle" }), "utf8")
      .finally(() => process.exit(0));
  }
}, 30_000).unref?.();