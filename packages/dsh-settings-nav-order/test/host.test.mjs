/**
 * dsh-settings-nav-order 的宿主半边（lib/index.js）测试：偏好文件通道。
 *
 * 宿主半边只有一个职责 —— 把浏览器偏好落成 $DSH_HOME/dsh-settings-nav-order/state.json
 * 并能读回来。所以这里不起真服务器，而是把 ctx.webServer 的注册抓下来，用假的
 * req / res 直接调处理函数；DSH_HOME 指到临时目录，全程不碰真实 home。
 *
 * 运行：node test/host.test.mjs
 * （不要用 `node --test test/`：测试运行器会派生子进程并捕获管道输出，在受限沙箱
 *   里会以 EPERM 失败。）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as host from '../lib/index.js';

const API = host.API_PREFIX;
const STATE_URL = `${API}/state`;

/** 建一个临时 home；每个用例一个，互不干扰。 */
function makeHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-nav-order-host-'));
}

/** 装载宿主半边：返回抓到的路由与调处理函数用的 call()。`extras` 用来注入 logger。 */
function loadHost(home, extras = {}) {
  const routes = [];
  const effects = [];
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  try {
    host.apply({
      effect: (fn, label) => {
        effects.push(String(label ?? ''));
        return fn();
      },
      webServer: {
        register: (route) => {
          routes.push(route);
          return () => {};
        },
      },
      ...extras,
    });
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
  }
  assert.equal(routes.length, 1, '宿主半边应只注册一条路由');
  return { route: routes[0], effects };
}

/** 假 logger：把 warn 收到数组里，用来断言「失败不是静默的」。 */
function collectWarnings() {
  const warnings = [];
  return { warnings, logger: { warn: (message) => warnings.push(String(message)) } };
}

/** 假请求：先把监听器收下来，等 call() 再推数据（真实 http 也是这样往后推的）。 */
function makeReq({ method = 'GET', url = STATE_URL, headers = {} } = {}) {
  const listeners = new Map();
  return {
    method,
    url,
    headers,
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(handler);
      return this;
    },
    emit(event, payload) {
      for (const handler of listeners.get(event) ?? []) handler(payload);
    },
  };
}

function makeRes() {
  return {
    statusCode: 0,
    headers: {},
    chunks: [],
    setHeader(key, value) {
      this.headers[String(key).toLowerCase()] = value;
    },
    end(chunk) {
      if (chunk !== undefined && chunk !== null) this.chunks.push(String(chunk));
    },
    body() {
      return this.chunks.join('');
    },
    json() {
      return JSON.parse(this.body());
    },
  };
}

/**
 * 调一次 API。
 * `readBody` 在第一个 await 之前就把 data / end 监听器挂好了，所以这里可以
 * 「先拿到 handler 的 promise，再推数据」——与真实 http 的时序一致。
 */
async function call(route, { method = 'GET', url = STATE_URL, body = null, headers = {}, raw = false } = {}) {
  const res = makeRes();
  const req = makeReq({ method, url, headers });
  const pending = route.handler(req, res);
  const payload = raw ? body : body === null ? null : JSON.stringify(body);
  if (payload !== null) req.emit('data', Buffer.from(payload, 'utf8'));
  req.emit('end');
  await pending;
  return res;
}

const SAMPLE_STATE = { enabled: true, order: [{ name: '模型', index: 0 }], hidden: [{ name: '账户', index: 0 }] };

test('apply 只挂一条同源路由，且效果标签点名了 state.json', () => {
  const home = makeHome();
  const { route, effects } = loadHost(home);
  assert.equal(route.kind, 'prefix');
  assert.equal(route.path, API);
  assert.equal(typeof route.handler, 'function');
  assert.ok(effects.length === 1 && effects[0].includes('state.json'), `效果标签应点名文件：${effects[0]}`);
  fs.rmSync(home, { recursive: true, force: true });
});

test('POST 写入 state.json：目录不存在时自动创建', async () => {
  const home = makeHome();
  const { route } = loadHost(home);
  const file = host.statePath(home);
  assert.ok(!fs.existsSync(path.dirname(file)), '前置条件：目录还不存在');

  const res = await call(route, { method: 'POST', body: SAMPLE_STATE });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
  assert.ok(fs.existsSync(file), `state.json 应被创建：${file}`);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), SAMPLE_STATE);
  fs.rmSync(home, { recursive: true, force: true });
});

test('POST 之后再 GET，读回同一份偏好（跨机复原读的就是这条路径）', async () => {
  const home = makeHome();
  const { route } = loadHost(home);

  await call(route, { method: 'POST', body: SAMPLE_STATE });
  const res = await call(route, { method: 'GET' });
  assert.equal(res.statusCode, 200);
  const data = res.json();
  assert.equal(data.ok, true);
  assert.equal(data.exists, true);
  assert.deepEqual(data.state, SAMPLE_STATE);
  assert.equal(data.file, host.statePath(home));
  assert.equal(data.error, undefined, '正常读取不应带 error');
  fs.rmSync(home, { recursive: true, force: true });
});

test('文件不存在时 GET 返回 state=null 且 exists=false（不是报错）', async () => {
  const home = makeHome();
  const { route } = loadHost(home);

  const res = await call(route, { method: 'GET' });
  assert.equal(res.statusCode, 200);
  const data = res.json();
  assert.equal(data.ok, true);
  assert.equal(data.state, null);
  assert.equal(data.exists, false);
  fs.rmSync(home, { recursive: true, force: true });
});

test('写入的是规范形状：多余字段丢弃、字段顺序稳定（git diff 才稳定）', async () => {
  const home = makeHome();
  const { route } = loadHost(home);

  await call(route, {
    method: 'POST',
    body: { hidden: [{ name: '账户', index: 0 }], 未来字段: 1, order: [{ name: '模型', index: 0 }], enabled: true },
  });
  const raw = fs.readFileSync(host.statePath(home), 'utf8');
  assert.equal(raw, JSON.stringify({ enabled: true, order: [{ name: '模型', index: 0 }], hidden: [{ name: '账户', index: 0 }] }));
  fs.rmSync(home, { recursive: true, force: true });
});

test('坏请求体一律拒收，且不把文件写坏', async () => {
  const home = makeHome();
  const { route } = loadHost(home);
  const file = host.statePath(home);

  const notJson = await call(route, { method: 'POST', raw: true, body: '{ 这不是 JSON' });
  assert.equal(notJson.statusCode, 400);

  for (const bad of ['[]', 'null', '"字符串"', '12']) {
    const res = await call(route, { method: 'POST', raw: true, body: bad });
    assert.equal(res.statusCode, 400, `形状不对的请求体应被拒：${bad}`);
  }
  assert.ok(!fs.existsSync(file), '被拒的请求不应留下文件');

  // 拒收之后再发一份好的，仍应正常工作（没被前一次搞坏）。
  const good = await call(route, { method: 'POST', body: SAMPLE_STATE });
  assert.equal(good.statusCode, 200);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), SAMPLE_STATE);
  fs.rmSync(home, { recursive: true, force: true });
});

test('请求体超过 64 KB 时回 413，不写文件（整块与分片两种推法）', async () => {
  const home = makeHome();
  const { route } = loadHost(home);
  const huge = `{"enabled":true,"order":[],"hidden":[],"padding":"${'x'.repeat(host.MAX_BODY_BYTES + 1024)}"}`;

  // ① 一次性推整块
  const once = await call(route, { method: 'POST', raw: true, body: huge });
  assert.equal(once.statusCode, 413);
  assert.ok(!fs.existsSync(host.statePath(home)));

  /** 按固定大小分片推一个请求体（真实网络就是分片到达的）。 */
  const callChunked = async (text, chunkSize) => {
    const res = makeRes();
    const req = makeReq({ method: 'POST' });
    const pending = route.handler(req, res);
    const buf = Buffer.from(text, 'utf8');
    for (let i = 0; i < buf.length; i += chunkSize) req.emit('data', buf.subarray(i, i + chunkSize));
    req.emit('end');
    await pending;
    return res;
  };

  // ② 分多块推：超限判定必须在最后一块之后仍然成立
  const split = await callChunked(huge, 8192);
  assert.equal(split.statusCode, 413, `分片推送也应 413：${split.body().slice(0, 120)}`);
  assert.ok(!fs.existsSync(host.statePath(home)), '超限的分片请求同样不该落盘');

  // ③ 分片但没超限：内容必须被完整拼起来（别把分片丢掉）
  const ok = await callChunked(JSON.stringify(SAMPLE_STATE), 7);
  assert.equal(ok.statusCode, 200, `分片但不超限应正常写入：${ok.body().slice(0, 120)}`);
  assert.deepEqual(JSON.parse(fs.readFileSync(host.statePath(home), 'utf8')), SAMPLE_STATE);
  fs.rmSync(home, { recursive: true, force: true });
});

test('跨站请求被拒（GET / POST 都是 403）', async () => {
  const home = makeHome();
  const { route } = loadHost(home);

  const get = await call(route, { headers: { 'sec-fetch-site': 'cross-site' } });
  assert.equal(get.statusCode, 403);
  const post = await call(route, { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' }, body: SAMPLE_STATE });
  assert.equal(post.statusCode, 403);
  assert.ok(!fs.existsSync(host.statePath(home)), '被拒的跨站写不应落盘');

  // 同源（same-origin / same-site / 缺省）都要正常放行。
  for (const site of ['same-origin', 'same-site', undefined]) {
    const ok = await call(route, { headers: site ? { 'sec-fetch-site': site } : {} });
    assert.equal(ok.statusCode, 200, `sec-fetch-site=${site} 应放行`);
  }
  fs.rmSync(home, { recursive: true, force: true });
});

test('未知路由回 404，不误写文件', async () => {
  const home = makeHome();
  const { route } = loadHost(home);

  const res = await call(route, { url: `${API}/nope` });
  assert.equal(res.statusCode, 404);
  const wrongMethod = await call(route, { method: 'DELETE' });
  assert.equal(wrongMethod.statusCode, 404);
  assert.ok(!fs.existsSync(host.statePath(home)));
  fs.rmSync(home, { recursive: true, force: true });
});

test('文件坏掉（半截 JSON）时 GET 当作没有快照，并带上原因；不抛错', async () => {
  const home = makeHome();
  const { warnings, logger } = collectWarnings();
  const { route } = loadHost(home, { logger });
  const file = host.statePath(home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{"enabled":tru', 'utf8');

  const res = await call(route, { method: 'GET' });
  assert.equal(res.statusCode, 200);
  const data = res.json();
  assert.equal(data.ok, true);
  assert.equal(data.state, null, '坏文件不能当成一份偏好送给浏览器');
  assert.equal(data.exists, true);
  assert.ok(typeof data.error === 'string' && data.error.length > 0, '应带上原因供面板排查');
  assert.equal(warnings.length, 1, `坏文件应在宿主日志里留一条 warn：${JSON.stringify(warnings)}`);
  assert.ok(warnings[0].includes('dsh-settings-nav-order') && warnings[0].includes('state.json'), warnings[0]);

  // 形状对但内容不是偏好（例如手改成数组）也算坏文件。
  fs.writeFileSync(file, '[1,2,3]', 'utf8');
  const again = await call(route, { method: 'GET' });
  assert.equal(again.json().state, null);
  assert.ok(String(again.json().error).includes('可用'));
  assert.equal(warnings.length, 2, '第二次坏读也要留痕迹');
  fs.rmSync(home, { recursive: true, force: true });
});

test('写盘失败回 500，并在宿主日志里留一条 warn（不是静默失败）', async () => {
  const home = makeHome();
  const { warnings, logger } = collectWarnings();
  const { route } = loadHost(home, { logger });
  // 用同名文件占住本该是目录的位置：writeState 的 mkdirSync 必然失败。
  fs.writeFileSync(path.join(home, host.STATE_DIR), '这里是个文件，不是目录', 'utf8');

  const res = await call(route, { method: 'POST', body: SAMPLE_STATE });
  assert.equal(res.statusCode, 500);
  assert.equal(res.json().ok, false);
  assert.ok(String(res.json().error).length > 0, '应回具体原因');
  assert.equal(warnings.length, 1, `写盘失败应留 warn：${JSON.stringify(warnings)}`);
  assert.ok(warnings[0].includes('写入偏好文件失败') && warnings[0].includes('state.json'), warnings[0]);

  // 没有 logger（老宿主 / 单测）也不能因为记日志而崩。
  const bare = loadHost(makeHome());
  const ok = await call(bare.route, { method: 'GET' });
  assert.equal(ok.statusCode, 200);
  fs.rmSync(home, { recursive: true, force: true });
});

test('写入是原子的：目录里不留 .tmp-* 残留', async () => {
  const home = makeHome();
  const { route } = loadHost(home);

  await call(route, { method: 'POST', body: SAMPLE_STATE });
  await call(route, { method: 'POST', body: { ...SAMPLE_STATE, enabled: false } });
  const files = fs.readdirSync(path.join(home, host.STATE_DIR));
  assert.deepEqual(files, [host.STATE_FILE], `目录里应只有 state.json：${JSON.stringify(files)}`);
  assert.equal(JSON.parse(fs.readFileSync(host.statePath(home), 'utf8')).enabled, false, '第二次写入应覆盖');
  fs.rmSync(home, { recursive: true, force: true });
});

test('两个请求同时发起也都成功，且不留临时文件（钉住「写盘全程同步」这个保证）', async () => {
  const home = makeHome();
  const { route } = loadHost(home);
  const a = { enabled: true, order: [{ name: '模型', index: 0 }], hidden: [] };
  const b = { enabled: false, order: [{ name: '账户', index: 0 }], hidden: [] };

  // writeState 全程同步，Node 单线程下两个请求不可能在「写临时文件 → 改名」之间
  // 交错，所以这里两次都该成功、最终内容＝后写的那份。这条用例的真正价值是把
  // 「同步」这个前提钉住：日后若有人把它改成异步，两个请求就会共用同一个临时
  // 文件而互相吃掉（改名撞 ENOENT，甚至先把正式文件删掉）。
  const [resA, resB] = await Promise.all([
    call(route, { method: 'POST', body: a }),
    call(route, { method: 'POST', body: b }),
  ]);

  assert.equal(resA.statusCode, 200, `第一个请求应成功：${resA.body()}`);
  assert.equal(resB.statusCode, 200, `第二个请求应成功：${resB.body()}`);
  const file = host.statePath(home);
  assert.ok(fs.existsSync(file), 'state.json 必须存在（不能被并发写弄丢）');
  const written = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(
    JSON.stringify(written) === JSON.stringify(a) || JSON.stringify(written) === JSON.stringify(b),
    `最终内容应是其中一次的完整快照：${JSON.stringify(written)}`,
  );
  assert.deepEqual(fs.readdirSync(path.join(home, host.STATE_DIR)), [host.STATE_FILE], '不留临时文件');
  fs.rmSync(home, { recursive: true, force: true });
});

test('请求被中断时 handler 立即结算（不留悬挂的 promise），且不写文件', async () => {
  const home = makeHome();
  const { route } = loadHost(home);
  const body = JSON.stringify(SAMPLE_STATE);

  // 'aborted' 是旧事件、'close' 是新事件：两者都要能结算。
  for (const event of ['aborted', 'close']) {
    const res = makeRes();
    const req = makeReq({ method: 'POST' });
    const pending = route.handler(req, res);
    req.emit('data', Buffer.from(body, 'utf8'));
    req.emit(event); // 浏览器关标签页 / 断线，永远等不到 'end'

    // 用 Promise.race 而不是直接 await：真悬挂时这个用例会挂住整个测试进程，
    // 那本身就是「永不结算」的现场，不如在这里超时失败。
    const settled = await Promise.race([
      pending.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 500)),
    ]);
    assert.equal(settled, true, `${event}：中断的请求必须结算，不能挂着`);
    assert.equal(res.statusCode, 400, `${event}：中断应回 400，实际 ${res.statusCode} ${res.body()}`);
  }
  assert.ok(!fs.existsSync(host.statePath(home)), '中断的请求不该写文件');

  // 正常完成时 'close' 也会跟着 'end' 到来，不能被误判成中断（否则每次保存都失败）。
  const ok = await call(route, { method: 'POST', body: SAMPLE_STATE });
  assert.equal(ok.statusCode, 200, '正常路径不能被 close 事件误伤');
  assert.deepEqual(JSON.parse(fs.readFileSync(host.statePath(home), 'utf8')), SAMPLE_STATE);
  fs.rmSync(home, { recursive: true, force: true });
});

test('只读的旧文件也能被覆盖（Windows 只读目标这个坑）', async () => {
  const home = makeHome();
  const { route } = loadHost(home);
  const file = host.statePath(home);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{"enabled":false,"order":[],"hidden":[]}', 'utf8');
  fs.chmodSync(file, 0o444);
  assert.equal(fs.statSync(file).mode & 0o200, 0, '前置条件：目标确实是只读');

  // 这条用例保证的是「只读目标最终被更新成新内容、并恢复可写」，**不保证**一定
  // 走过 chmod 回退分支：NTFS 上 rename 有时能直接顶掉只读文件（POSIX 语义下更是
  // 必然成功）。所以别把它当成「回退分支已被覆盖」的证据；回退分支的价值在于
  // 它**不删原文件**（先删后改名一旦第二次失败，用户原来的偏好就真没了）。
  const res = await call(route, { method: 'POST', body: SAMPLE_STATE });
  assert.equal(res.statusCode, 200, '只读目标不应让写入失败');
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), SAMPLE_STATE);
  assert.notEqual(fs.statSync(file).mode & 0o200, 0, '覆盖后不应再是只读（避免下次再撞）');
  fs.rmSync(home, { recursive: true, force: true });
});

test('normalizeState：形状守卫与浏览器半边同一口径', () => {
  assert.equal(host.normalizeState(null), null);
  assert.equal(host.normalizeState('x'), null);
  assert.equal(host.normalizeState([1]), null, '数组不是一份偏好');

  assert.deepEqual(host.normalizeState({}), { enabled: true, order: [], hidden: [] }, '缺字段＝默认');
  assert.equal(host.normalizeState({ enabled: false }).enabled, false);
  assert.equal(host.normalizeState({ enabled: 'yes' }).enabled, true, '只有显式 false 才算停用');

  assert.deepEqual(
    host.normalizeState({ order: [{ name: '模型', index: 2 }, null, { name: 7 }, { name: '账户' }] }).order,
    [{ name: '模型', index: 2 }, { name: '账户', index: 0 }],
    '坏行丢弃、缺 index 补 0',
  );
  assert.deepEqual(host.normalizeState({ order: 'not-an-array' }).order, [], '不是数组就当空');
});

test('resolveHome 认 DSH_HOME，缺省落在 ~/.dsh', () => {
  const previous = process.env.DSH_HOME;
  try {
    process.env.DSH_HOME = 'C:/tmp/some-home';
    assert.equal(host.resolveHome(), path.resolve('C:/tmp/some-home'));
    delete process.env.DSH_HOME;
    assert.equal(host.resolveHome(), path.join(os.homedir(), '.dsh'));
    process.env.DSH_HOME = '   ';
    assert.equal(host.resolveHome(), path.join(os.homedir(), '.dsh'), '空白值等同于没配');
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
  }
});