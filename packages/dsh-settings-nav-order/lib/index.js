/**
 * @fish-under-sea/dsh-settings-nav-order —— 宿主半边：把浏览器偏好落成一份可同步的文件。
 *
 * 浏览器半边把「设置导航顺序」的顺序 / 隐藏项存在 localStorage 里，那是「这台机器
 * 上这个浏览器」的显示偏好，本身不跟着任何配置文件走 —— 换机就复原不了。
 *
 * 这里给出唯一的通道：同一份偏好落成 `$DSH_HOME/dsh-settings-nav-order/state.json`。
 * 浏览器半边在保存时提交快照、启动时用文件回填 localStorage；dsh-git-sync 的白名单
 * 收录这条相对路径，于是「设置导航顺序」跟着配置仓跨机复原。
 *
 * 为什么落盘放在本插件、而不是让 dsh-git-sync 直接去读别人的 localStorage：
 * 偏好归本插件管，同步插件只搬文件。反过来做会把两个插件的职责缠在一起。
 *
 * 设计约束（与 dsh-git-sync 宿主半边同一套）：
 *  - 零 npm 依赖，只用 node 内置模块（宿主不导出 Config schema，见 cordis 的
 *    `if (!runtime.Config) return config`）；
 *  - 只读写这一个固定路径，不接受调用方指定路径 —— 否则这就是一个任意写接口；
 *  - 形状守卫：只接受 { enabled, order, hidden }，坏数据一律拒收，不写进文件；
 *  - 不因为宿主半边出错而影响浏览器里已经生效的顺序。
 *
 * 路由（同源，挂在 webServer 上）：
 *   GET  /dsh-settings-nav-order/api/state → { ok, state, exists, file }
 *   POST /dsh-settings-nav-order/api/state → 用请求体（JSON）覆盖该文件
 *
 * @module @fish-under-sea/dsh-settings-nav-order
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const name = 'dsh-settings-nav-order';
// webServer 用来挂同源 API 路由。
export const inject = ['webServer'];

const API_PREFIX = '/dsh-settings-nav-order/api';

/** 偏好文件相对 DSH home 的路径 —— dsh-git-sync 的白名单按这条相对路径收录。 */
const STATE_DIR = 'dsh-settings-nav-order';
const STATE_FILE = 'state.json';

/** 请求体上限：一份顺序偏好只有几百字节，64 KB 已经宽到不可能误伤。 */
const MAX_BODY_BYTES = 64 * 1024;

/** DSH home：与 @deepseek-ai/dsh-home-paths 的解析口径一致（同 dsh-git-sync）。 */
export function resolveHome() {
  const configured = process.env.DSH_HOME;
  if (configured && configured.trim()) return path.resolve(configured.trim());
  return path.join(os.homedir(), '.dsh');
}

/** 偏好文件的绝对路径。 */
export function statePath(home) {
  return path.join(home, STATE_DIR, STATE_FILE);
}

/**
 * 形状守卫 + 规范化：只接受 { enabled, order, hidden } 这一种形状，其余字段丢弃。
 *
 * 写进文件的字段与顺序因此永远一致 —— 这份文件会被 dsh-git-sync 采集进配置仓，
 * 形状稳定，git 里的 diff 才稳定。
 *
 * 返回 null 表示「不是一份可用的偏好」：调用方据此拒收，而不是把垃圾写进文件。
 * 口径与浏览器半边的 loadConfig 一致（`enabled` 只有显式的 false 才算停用，
 * 坏行按空数组处理）。
 */
export function normalizeState(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const rows = (input) => {
    if (!Array.isArray(input)) return [];
    return input
      .filter((row) => row !== null && typeof row === 'object' && typeof row.name === 'string')
      .map((row) => ({ name: row.name, index: Number.isInteger(row.index) ? row.index : 0 }));
  };
  return { enabled: value.enabled !== false, order: rows(value.order), hidden: rows(value.hidden) };
}

/**
 * 读偏好文件。
 *
 * 文件不存在、读不动、内容不是 JSON、形状不对 —— 一律当作「没有快照」，并把原因
 * 带回给调用方（GET 用它区分「没配过」与「文件坏了」）。浏览器半边拿到 state=null
 * 时不会动本地偏好，所以坏文件不会把用户的顺序清掉。
 */
export function readState(home) {
  const file = statePath(home);
  if (!fs.existsSync(file)) return { state: null, exists: false, file };
  try {
    const state = normalizeState(JSON.parse(fs.readFileSync(file, 'utf8')));
    if (state === null) return { state: null, exists: true, file, error: '文件内容不是一份可用的偏好' };
    return { state, exists: true, file };
  } catch (error) {
    return { state: null, exists: true, file, error: String(error?.message ?? error) };
  }
}

/**
 * 原子写：先写同目录的临时文件，再改名顶上（不直接覆盖写）。
 *
 * 为什么必须原子：这份文件会被 dsh-git-sync 采集进配置仓，而宿主进程可能在写入
 * 途中被杀（升级、断电）。半截 JSON 会被原样提交上去，换机还原后浏览器读到坏数据。
 * 改名是原子的 —— 最坏情况是保住上一版，不会留下半成品。
 *
 * 顺带处理 Windows 的只读目标：改名顶掉一个只读文件会 EPERM / EACCES，这时清掉
 * 只读位再来一次。dsh-git-sync 踩过同一个坑（`copyFileSync` 会把源文件的只读属性
 * 带到目标，于是「第一次成功、之后每次失败」）。
 */
export function writeState(home, state) {
  const file = statePath(home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // 临时名带 pid：**不需要**再区分并发请求 —— 本函数全程同步，Node 单线程下两个
  // 请求不可能在「写临时文件 → 改名」之间交错（实测：两个 POST 同时发起也各自
  // 完整走完，最终内容＝后写的那份）。带 pid 只是让崩溃残留一眼能看出是哪个进程
  // 留下的；那种残留也无害：它不在 dsh-git-sync 的白名单里（白名单只收录
  // state.json，是精确文件路径，不扫目录），所以既进不了配置仓、也不会被当成
  // 同步差异。它只是本机一个小文件，且同一次运行的下一次写入会直接覆盖它。
  const tmp = `${file}.tmp-${process.pid}`;
  const text = JSON.stringify(state);
  fs.writeFileSync(tmp, text, 'utf8');
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    if (error?.code !== 'EPERM' && error?.code !== 'EACCES') {
      try { fs.rmSync(tmp, { force: true }); } catch { /* 清理失败不是主错误 */ }
      throw error;
    }
    // 只读目标：改名顶掉一个只读文件在 Windows 上是 ERROR_ACCESS_DENIED。
    // **先清只读位再改名，绝不「先删掉再改名」** —— 后者一旦第二次改名再失败
    // （占用、瞬时 I/O 错），用户原来的偏好就真的没了；清位失败时宁可这次写入
    // 报错（浏览器半边会显示「未同步」并在下次打开设置页重推），也不赌一把。
    try { fs.chmodSync(file, 0o666); } catch { /* 清不掉就交给下面的重试报错 */ }
    try {
      fs.renameSync(tmp, file);
    } catch (again) {
      try { fs.rmSync(tmp, { force: true }); } catch { /* 忽略 */ }
      throw again;
    }
  }
  try { fs.chmodSync(file, 0o666); } catch { /* 非致命：仅影响下次覆盖 */ }
  return { file, bytes: Buffer.byteLength(text, 'utf8') };
}

/** 读请求体（带上限）；超限时以 code=E_TOO_LARGE 拒绝，由调用方回 413。 */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let overflow = false;
    // 只结算一次：'end' 之后 'close' 还会跟着来（正常完成也会触发 close），
    // 没有这个标记就会在正常路径上被当成「请求中断」而 reject。
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { overflow = true; chunks.length = 0; return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (overflow) finish(reject, Object.assign(new Error('请求体过大'), { code: 'E_TOO_LARGE' }));
      else finish(resolve, Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (error) => finish(reject, error));
    // 浏览器关标签页 / 断线时不能让 handler 一直挂着：挂在那儿的 promise 永不
    // 结算，响应也永远不发出去。'aborted' 是旧事件、'close' 是新事件，都听。
    const aborted = () => finish(reject, Object.assign(new Error('请求中断'), { code: 'E_ABORTED' }));
    req.on('aborted', aborted);
    req.on('close', aborted);
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

/**
 * 挂上偏好文件通道。宿主半边不订阅任何事件，也不需要用户配置：文件路径固定，
 * 参数全部由浏览器半边在每次保存时提交。
 */
export function apply(ctx) {
  const home = resolveHome();
  // 失败必须留下痕迹：浏览器半边对同步失败是静默重试的（偏好本身不依赖网络），
  // 所以宿主这一侧要是也不吭声，用户只会看到「顺序总是复原不了」却无从查起。
  // 用框架的 logger（与 agent-teams 同一套），拿不到就退化成不记。
  const warn = (message) => {
    try {
      ctx?.logger?.warn?.(message);
    } catch { /* 记日志本身不该影响处理请求 */ }
  };

  ctx.effect(
    () => ctx.webServer.register({
      kind: 'prefix',
      path: API_PREFIX,
      handler: async (req, res) => {
        // 轻量同源护栏：拒绝跨站发起的请求（与 dsh-git-sync 同一套）。
        if (String(req.headers?.['sec-fetch-site'] ?? '') === 'cross-site') {
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

        try {
          if (req.method === 'GET' && route === '/state') {
            const { state, exists, file, error } = readState(home);
            if (error) warn(`dsh-settings-nav-order: 偏好文件读不出来，按「没有快照」处理（${file}）：${error}`);
            sendJson(res, 200, { ok: true, state, exists, file, ...(error ? { error } : {}) });
            return;
          }

          if (req.method === 'POST' && route === '/state') {
            const body = await readBody(req, MAX_BODY_BYTES);
            let parsed;
            try {
              parsed = JSON.parse(body);
            } catch {
              sendJson(res, 400, { ok: false, error: '请求体不是 JSON' });
              return;
            }
            const state = normalizeState(parsed);
            if (state === null) {
              sendJson(res, 400, { ok: false, error: '请求体不是一份可用的偏好' });
              return;
            }
            try {
              const saved = writeState(home, state);
              sendJson(res, 200, { ok: true, file: saved.file, bytes: saved.bytes });
            } catch (error) {
              warn(`dsh-settings-nav-order: 写入偏好文件失败（${statePath(home)}）：${String(error?.message ?? error)}`);
              sendJson(res, 500, { ok: false, error: String(error?.message ?? error) });
            }
            return;
          }

          sendJson(res, 404, { ok: false, error: 'not found' });
        } catch (error) {
          if (error?.code === 'E_TOO_LARGE') {
            sendJson(res, 413, { ok: false, error: '请求体过大' });
            return;
          }
          // 请求被中断时对端多半已经走了，这次写入按「没发生」处理：文件保持上一版。
          if (error?.code === 'E_ABORTED') {
            sendJson(res, 400, { ok: false, error: '请求中断，本次未写入' });
            return;
          }
          sendJson(res, 500, { ok: false, error: String(error?.message ?? error) });
        }
      },
    }),
    'dsh-settings-nav-order: 偏好文件通道（读 / 写 dsh-settings-nav-order/state.json）',
  );
}

export { API_PREFIX, STATE_DIR, STATE_FILE, MAX_BODY_BYTES };