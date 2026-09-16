/**
 * 宿主半边（lib/index.js）的集成测试：用假的 cordis ctx 接线，
 * 验证「数轮次 → 到点刷新」「提供方生成」「Web API」三条主线。
 *
 * 运行：node test/host.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { PROVIDER_ID } from '../lib/core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOME = path.join(HERE, '.tmp-home');

// 插件按 DSH_HOME 落状态文件；测试里指到插件目录内的临时目录，绝不碰真实 home。
process.env.DSH_HOME = HOME;
const { apply, inject, name } = await import('../lib/index.js');

/** 合格的人类消息事件。 */
function human(seq, text) {
  return { seq, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text }] } };
}

/** 假的会话对象：只需要插件真正用到的几个面。 */
function makeSession(id, header = {}) {
  const log = [];
  return {
    id,
    header,
    ownEvents: () => log,
    snapshotEvents: () => log,
    requestHeader: () => ({ config: { provider: 'deepseek-official', model: 'deepseek-flash' } }),
    feed: (event) => log.push(event),
  };
}

/** 搭一个假 ctx，并暴露插件注册进去的东西供断言。 */
function makeCtx(sessions) {
  const listeners = new Map();
  const titles = new Map();
  const api = {
    provider: undefined,
    webHandler: undefined,
    refreshes: [],
    streamCalls: [],
    warnings: [],
    errors: [],
    /**
     * 默认的假模型输出；单个用例可替换。
     *
     * 注意 `finish.reason` 必须是 DSH 真实协议里的**对象**（`{ kind }`）：
     * 早期测试替身喂的是字符串 `'stop'`，正好掩盖了"把对象当字符串用"的缺陷，
     * 结果真实会话第 3 轮自动命名全部报「结束原因异常（[object Object]）」。
     */
    streamScript: () => [
      { type: 'block-start', index: 0, blockType: 'text' },
      { type: 'text-delta', index: 0, text: '"插件自动命名"' },
      { type: 'finish', reason: { kind: 'stop' } },
    ],
  };

  const ctx = {
    effect: (fn) => fn(),
    on: (eventName, handler) => {
      listeners.set(eventName, [...(listeners.get(eventName) ?? []), handler]);
      return () => {};
    },
    logger: {
      info: () => {},
      warn: (message) => api.warnings.push(String(message)),
      error: (message) => api.errors.push(String(message)),
    },
    sessionTitle: {
      register: (provider) => {
        api.provider = provider;
        return async () => {};
      },
      get: (session) => titles.get(session.id),
      refresh: async (session) => {
        api.refreshes.push(session.id);
        const snapshot = { title: `标题-${api.refreshes.length}`, messageSeqs: [1], source: { kind: 'provider', provider: PROVIDER_ID } };
        titles.set(session.id, snapshot);
        return snapshot;
      },
    },
    sessions: {
      get: (id) => sessions.get(id),
      list: () => [...sessions.values()],
    },
    llm: {
      stream: (options) => {
        api.streamCalls.push(options);
        return (async function* stream() {
          for (const chunk of api.streamScript(options)) yield chunk;
        })();
      },
    },
    webServer: {
      register: (options) => {
        api.webHandler = options.handler;
        return () => {};
      },
    },
  };

  return { ctx, api, titles, listeners };
}

/** 走一次完整的"用户发言"事件。 */
async function speak(ctx, api, session, text) {
  const event = human(session.snapshotEvents().length, text);
  session.feed(event);
  for (const handler of api.listeners ?? []) handler(session, event);
  await new Promise((resolve) => setTimeout(resolve, 5));
}

/** 便捷：从 listeners 里取会话事件处理器。 */
function attach(ctx, api, listeners, session, text) {
  const event = human(session.snapshotEvents().length, text);
  session.feed(event);
  for (const handler of listeners.get('session/event') ?? []) handler(session, event);
}

/** 等异步的 setTimeout(0) 触发排空。 */
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

test.before(() => {
  fs.rmSync(HOME, { recursive: true, force: true });
});
test.after(() => {
  fs.rmSync(HOME, { recursive: true, force: true });
});

test('宿主半边导出名与依赖声明正确', () => {
  assert.equal(name, 'dsh-session-title-refresh');
  for (const service of ['sessionTitle', 'llm', 'sessions', 'webServer']) {
    assert.ok(inject.includes(service), `inject 应包含 ${service}`);
  }
});

test('注册的提供方 id 与节奏：first-prompt（第 1 轮照样出标题）', () => {
  const sessions = new Map();
  const { ctx, api } = makeCtx(sessions);
  apply(ctx, {});
  assert.equal(api.provider.id, PROVIDER_ID);
  assert.equal(api.provider.automatic, 'first-prompt');
  assert.equal(typeof api.provider.generate, 'function');
  assert.equal(typeof api.webHandler, 'function');
});

test('轮次调度：第 3 轮首刷，之后第 8 轮再刷，中间不刷', async () => {
  const sessions = new Map();
  const { ctx, api, listeners } = makeCtx(sessions);
  apply(ctx, {});
  const session = makeSession('session-a');
  sessions.set(session.id, session);

  const speak = (text) => {
    const event = human(session.snapshotEvents().length, text);
    session.feed(event);
    for (const handler of listeners.get('session/event') ?? []) handler(session, event);
  };

  speak('round 1');
  await tick();
  speak('round 2');
  await tick();
  assert.equal(api.refreshes.length, 0, '第 2 轮不该触发');

  speak('round 3');
  await tick();
  assert.deepEqual(api.refreshes, ['session-a'], '第 3 轮应触发一次');

  for (const round of [4, 5, 6, 7]) {
    speak(`round ${round}`);
    await tick();
  }
  assert.equal(api.refreshes.length, 1, '第 4-7 轮不该触发');

  speak('round 8');
  await tick();
  assert.equal(api.refreshes.length, 2, '第 8 轮应再触发一次');
});

test('子代理会话从不被自动命名', async () => {
  const sessions = new Map();
  const { ctx, api, listeners } = makeCtx(sessions);
  apply(ctx, {});
  const child = makeSession('session-child', { origin: 'subagent', delegationDepth: 1, parentSession: 'session-a' });
  sessions.set(child.id, child);
  for (let round = 1; round <= 9; round += 1) {
    const event = human(round, `round ${round}`);
    child.feed(event);
    for (const handler of listeners.get('session/event') ?? []) handler(child, event);
  }
  await tick();
  assert.deepEqual(api.refreshes, []);
});

test('人工重命名后停止自动刷新（可配置开关打开时继续）', async () => {
  const sessions = new Map();
  const { ctx, api, titles, listeners } = makeCtx(sessions);
  apply(ctx, {});
  const session = makeSession('session-manual');
  sessions.set(session.id, session);
  titles.set(session.id, { title: '我自己起的名字', source: { kind: 'user' } });

  for (let round = 1; round <= 8; round += 1) {
    const event = human(round, `round ${round}`);
    session.feed(event);
    for (const handler of listeners.get('session/event') ?? []) handler(session, event);
    await tick();
  }
  assert.deepEqual(api.refreshes, [], '人工标题应被尊重');

  // 打开「人工重命名后仍继续刷新」后，同一个会话应恢复自动刷新
  const home = path.join(HOME, 'dsh-session-title-refresh');
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({ keepRefreshingAfterManualRename: true }), 'utf8');
  const sessions2 = new Map();
  const second = makeCtx(sessions2);
  apply(second.ctx, {});
  const resumed = makeSession('session-manual-2');
  sessions2.set(resumed.id, resumed);
  second.titles.set(resumed.id, { title: '我自己起的名字', source: { kind: 'user' } });
  for (let round = 1; round <= 3; round += 1) {
    const event = human(round, `round ${round}`);
    resumed.feed(event);
    for (const handler of second.listeners.get('session/event') ?? []) handler(resumed, event);
  }
  await tick();
  assert.deepEqual(second.api.refreshes, ['session-manual-2']);
  fs.rmSync(path.join(home, 'config.json'), { force: true });
});

test('提供方：取样首条+最近若干条、用会话当前路由、清洗模型输出', async () => {
  const sessions = new Map();
  const { ctx, api } = makeCtx(sessions);
  apply(ctx, {});
  const session = makeSession('session-gen');
  sessions.set(session.id, session);

  const messages = Array.from({ length: 12 }, (_, index) => ({ seq: index * 2, text: `第 ${index} 轮的人类发言` }));
  const result = await api.provider.generate({
    session,
    messages,
    route: { provider: 'deepseek-official', model: 'deepseek-flash' },
    signal: new AbortController().signal,
  });

  assert.equal(result.title, '插件自动命名', '引号被清洗掉');
  assert.equal(result.model.provider, 'deepseek-official');
  // 取样窗口默认 8：首条 + 最近 7 条
  assert.deepEqual(result.messageSeqs, [0, 10, 12, 14, 16, 18, 20, 22]);
  assert.ok(result.messageSeqs.every((seq) => seq < messages.length * 2));

  const call = api.streamCalls.at(-1);
  assert.equal(call.provider, 'deepseek-official');
  assert.equal(call.model, 'deepseek-flash');
  assert.equal(call.purpose, 'session-title');
  assert.equal(call.sessionId, 'session-gen');
  assert.match(call.system, /overall direction/);
  assert.match(call.messages[0].content[0].text, /JSON array/);
  assert.equal(call.messages[0].source.kind, 'plugin');
  assert.equal(call.messages[0].role, 'user');
});

test('提供方：没有可用路由时抛错（保留旧标题）', async () => {
  const sessions = new Map();
  const { ctx, api } = makeCtx(sessions);
  apply(ctx, {});
  const session = makeSession('session-noroute');
  // 会话还没记录过主请求路由（新会话的第一轮）时，生成必须直接失败。
  session.requestHeader = () => undefined;
  await assert.rejects(
    () =>
      api.provider.generate({
        session,
        messages: [{ seq: 0, text: '你好' }],
        route: undefined,
        signal: new AbortController().signal,
      }),
    /路由/,
  );
});

test('提供方：工具调用或超长结束原因都判为失败', async () => {
  const sessions = new Map();
  const { ctx, api } = makeCtx(sessions);
  apply(ctx, {});
  const session = makeSession('session-bad');
  const request = { session, messages: [{ seq: 0, text: '你好' }], route: { provider: 'p', model: 'm' }, signal: new AbortController().signal };

  api.streamScript = () => [
    { type: 'block-start', index: 0, blockType: 'tool-call' },
    { type: 'finish', reason: { kind: 'tool-calls' } },
  ];
  await assert.rejects(() => api.provider.generate(request), /text only|tool/);

  api.streamScript = () => [
    { type: 'text-delta', index: 0, text: '半截' },
    { type: 'finish', reason: { kind: 'max-tokens' } },
  ];
  await assert.rejects(() => api.provider.generate(request), /max-tokens/);

  api.streamScript = () => [{ type: 'finish', reason: { kind: 'stop' } }];
  await assert.rejects(() => api.provider.generate(request), /没有产出文本/);
});

test('提供方：模型报错时给出具体原因，而不是 [object Object]', async () => {
  const sessions = new Map();
  const { ctx, api } = makeCtx(sessions);
  apply(ctx, {});
  const session = makeSession('session-err');
  const request = { session, messages: [{ seq: 0, text: '你好' }], route: { provider: 'p', model: 'm' }, signal: new AbortController().signal };

  // 回归：真实适配器报错时 reason 是 { kind: 'error', failure: {...} }，
  // 曾经被 String() 成 "[object Object]"，用户看到的报错完全没有信息量。
  api.streamScript = () => [
    { type: 'finish', reason: { kind: 'error', failure: { message: '连接被重置', code: 'ECONNRESET' } } },
  ];
  await assert.rejects(() => api.provider.generate(request), (error) => {
    assert.match(error.message, /error/, '应当带上 kind');
    assert.match(error.message, /连接被重置/, '应当带上具体失败原因');
    assert.match(error.message, /ECONNRESET/, '应当带上失败码');
    assert.doesNotMatch(error.message, /\[object Object\]/, '不允许再出现 [object Object]');
    return true;
  });

  api.streamScript = () => [{ type: 'finish', reason: { kind: 'aborted', failure: { message: '上游取消' } } }];
  await assert.rejects(() => api.provider.generate(request), /上游取消/);
});

test('提供方：已取消的信号不会被忽略', async () => {
  const sessions = new Map();
  const { ctx, api } = makeCtx(sessions);
  apply(ctx, {});
  const session = makeSession('session-abort');
  const controller = new AbortController();
  controller.abort(new Error('superseded'));
  await assert.rejects(
    () => api.provider.generate({ session, messages: [{ seq: 0, text: '你好' }], route: { provider: 'p', model: 'm' }, signal: controller.signal }),
    /superseded/,
  );
});

test('刷新失败只记日志，不影响其它会话', async () => {
  const sessions = new Map();
  const { ctx, api, listeners } = makeCtx(sessions);
  api.refreshImpl = async () => {
    throw new Error('boom');
  };
  apply(ctx, {});
  // 让 refresh 抛错
  ctx.sessionTitle.refresh = async () => {
    throw new Error('boom');
  };
  const session = makeSession('session-fail');
  sessions.set(session.id, session);
  for (let round = 1; round <= 3; round += 1) {
    const event = human(round, `round ${round}`);
    session.feed(event);
    for (const handler of listeners.get('session/event') ?? []) handler(session, event);
  }
  await tick();
  assert.equal(api.warnings.length, 1);
  assert.match(api.warnings[0], /boom/);
});

test('Web API：/status 报告配置、活动会话与记录；/config 落盘；/refresh 手动刷新', async () => {
  const sessions = new Map();
  const { ctx, api, titles } = makeCtx(sessions);
  apply(ctx, {});
  const session = makeSession('session-api');
  sessions.set(session.id, session);
  session.feed(human(0, '第一轮'));
  session.feed(human(1, '第二轮'));
  titles.set(session.id, { title: '当前标题', source: { kind: 'provider', provider: PROVIDER_ID } });
  // /status 列的是插件已经接管过的会话；没接管过的先出现在 /sessions 里。
  const listed = await callApi(api, 'GET', '/sessions');
  assert.equal(listed.sessionList.length, 1);

  const status = await callApi(api, 'GET', '/status');
  assert.equal(status.ok, true);
  assert.equal(status.config.firstRound, 3);
  assert.equal(status.config.interval, 5);
  assert.equal(status.config.maxFirstRound, 10);
  assert.equal(status.config.maxInterval, 20);
  assert.match(status.schedule, /第 3 轮首次总结/);
  assert.deepEqual(status.presets.map((preset) => preset.id), ['conservative', 'balanced', 'aggressive']);
  assert.equal(status.sessionList.length, 1);
  assert.equal(status.sessionList[0].rounds, 2);
  assert.equal(status.sessionList[0].nextDue, 3);
  assert.equal(status.sessionList[0].title, '当前标题');

  // 上限可以调到 30，于是「首轮 6」是有效值而不是被夹回默认上限
  const saved = await callApi(api, 'POST', '/config', { maxFirstRound: 30, firstRound: 6, interval: 9, enabled: true });
  assert.equal(saved.ok, true);
  assert.equal(saved.config.maxFirstRound, 30);
  assert.equal(saved.config.firstRound, 6);
  assert.equal(saved.config.interval, 9);
  assert.equal(saved.sessionList[0].nextDue, 6, '规则变化后触发点按新规则重排');
  const onDisk = JSON.parse(fs.readFileSync(path.join(HOME, 'dsh-session-title-refresh', 'config.json'), 'utf8'));
  assert.equal(onDisk.firstRound, 6);
  assert.equal(onDisk.maxFirstRound, 30);

  // 超过上限的区间被夹到 maxInterval
  const clamped = await callApi(api, 'POST', '/config', { interval: 999 });
  assert.equal(clamped.config.interval, 20);

  const refreshed = await callApi(api, 'POST', '/refresh', { sessionId: 'session-api' });
  assert.equal(refreshed.ok, true);
  assert.deepEqual(refreshed.refreshed.map((item) => item.sessionId), ['session-api']);

  const all = await callApi(api, 'POST', '/refresh', {});
  assert.equal(all.ok, true);

  // 恢复默认，避免影响后续用例
  await callApi(api, 'POST', '/config', { firstRound: 3, interval: 5, maxFirstRound: 10, maxInterval: 20 });
  fs.rmSync(path.join(HOME, 'dsh-session-title-refresh', 'config.json'), { force: true });
});

test('Web API：跨站请求被拒、未知路由 404', async () => {
  const sessions = new Map();
  const { ctx, api } = makeCtx(sessions);
  apply(ctx, {});
  const crossSite = await callApi(api, 'GET', '/status', undefined, { 'sec-fetch-site': 'cross-site' });
  assert.equal(crossSite.ok, false);
  const missing = await callApi(api, 'GET', '/nope');
  assert.equal(missing.ok, false);
});

test('可观测性：状态带插件版本，记录带产生它的版本', async () => {
  const sessions = new Map();
  const { ctx, api } = makeCtx(sessions);
  apply(ctx, {});
  const status = await callApi(api, 'GET', '/status');
  assert.match(String(status.version), /^\d+\.\d+\.\d+$/, '状态里要有插件版本，便于确认跑的是哪一版');
  assert.ok(String(status.historyPath).endsWith('history.json'), '状态里要给出记录文件路径');

  const session = makeSession('session-version');
  sessions.set(session.id, session);
  session.feed(human(0, '一'));
  const refreshed = await callApi(api, 'POST', '/refresh', { sessionId: 'session-version' });
  assert.equal(refreshed.log[0].version, status.version, '每条记录都要标记版本，才知道是不是修复版产生的');
});

test('可观测性：命名记录落盘，DSH 重启后仍能看到重启前的记录', async () => {
  const isolated = path.join(HERE, '.tmp-home-history');
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = isolated;
  fs.rmSync(isolated, { recursive: true, force: true });
  try {
    const sessions = new Map();
    const session = makeSession('session-persist');
    sessions.set(session.id, session);
    session.feed(human(0, '第一轮'));

    const first = makeCtx(sessions);
    apply(first.ctx, {});
    const refreshed = await callApi(first.api, 'POST', '/refresh', { sessionId: 'session-persist' });
    assert.equal(refreshed.log[0].sessionId, 'session-persist');
    const file = path.join(isolated, 'dsh-session-title-refresh', 'history.json');
    assert.ok(fs.existsSync(file), 'history.json 应当被写出');
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8'))[0].sessionId, 'session-persist');

    // 模拟 DSH 重启：同一个 home 上重新装载插件
    const second = makeCtx(new Map([[session.id, session]]));
    apply(second.ctx, {});
    const after = await callApi(second.api, 'GET', '/status');
    assert.ok(
      after.log.some((record) => record.sessionId === 'session-persist'),
      '重启后应当还能看到重启前的记录（否则用户无法判断修复是否生效）',
    );
  } finally {
    process.env.DSH_HOME = previous;
    fs.rmSync(isolated, { recursive: true, force: true });
  }
});

test('手动刷新：失败记录真实轮次；无人类消息时记为跳过而非裸成功', async () => {
  const sessions = new Map();
  const { ctx, api } = makeCtx(sessions);
  apply(ctx, {});
  const session = makeSession('session-manual-round');
  sessions.set(session.id, session);
  for (let round = 1; round <= 4; round += 1) session.feed(human(round, `第 ${round} 轮`));

  // 失败：轮次必须是真实值（用户看到的「第 0 轮」没有任何信息量）
  ctx.sessionTitle.refresh = async () => {
    throw new Error('上游超时');
  };
  const failed = await callApi(api, 'POST', '/refresh', { sessionId: 'session-manual-round' });
  assert.equal(failed.failed.length, 1);
  assert.equal(failed.log[0].ok, false);
  assert.equal(failed.log[0].round, 4, '失败记录也应带真实轮次');
  assert.match(failed.log[0].error, /上游超时/);

  // 无人类消息：refresh 解析为 undefined 时说清是「跳过」，不能显示成「成功但没标题」
  const empty = makeSession('session-no-message');
  sessions.set(empty.id, empty);
  ctx.sessionTitle.refresh = async () => undefined;
  const skipped = await callApi(api, 'POST', '/refresh', { sessionId: 'session-no-message' });
  assert.equal(skipped.ok, true);
  assert.equal(skipped.refreshed[0].skipped, true);
  assert.match(skipped.refreshed[0].reason, /人类消息/);
  assert.equal(skipped.log[0].skipped, true);
  assert.match(skipped.log[0].reason, /人类消息/);
});

/** 造一个假 req/res 对，直接把插件的 HTTP 处理器当函数调。 */
async function callApi(api, method, route, body, headers = {}) {
  const url = `http://localhost/dsh-session-title-refresh/api${route}`;
  const req = method === 'POST' ? Readable.from([JSON.stringify(body ?? {})]) : Readable.from([]);
  req.method = method;
  req.url = url;
  req.headers = { host: 'localhost', 'content-type': 'application/json', ...headers };
  let payload;
  const res = {
    statusCode: 200,
    setHeader: () => {},
    end: (text) => {
      payload = JSON.parse(text);
    },
  };
  await api.webHandler(req, res);
  return payload;
}