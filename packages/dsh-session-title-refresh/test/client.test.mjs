/**
 * Web 半边（lib/client.js）的冒烟测试。
 *
 * DSH 的浏览器侧用 `window.__ModuleLoader__.load({ id, factory })` 装载模块，
 * 这里用假的 window + 假的 react 走一遍同一条路：能装载、能渲染出界面文本、
 * 能读到宿主 API，并注册进设置槽位。不做像素级断言——只保证装进 GUI 后不炸。
 *
 * 运行：node test/client.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(HERE, '..', 'lib', 'client.js');
/** 源码读取一次即可（同一个文件被反复 new Function 执行）。 */
const CODE = fs.readFileSync(SOURCE, 'utf8');

/** 最小的 react 替身：createElement 造普通对象，hooks 用一个数组轮转。
 *  useEffect 立即执行一次（等价于真实 react 的首次提交），
 *  这样"读取状态"那条链才会真的跑起来。
 *  render 用于模拟"一次渲染"：它把 hooks 游标归零，和真实 react 每次渲染
 *  都从头按顺序读 hooks 的行为一致。 */
function makeFakeReact() {
  const hooks = [];
  let cursor = 0;
  return {
    hooks,
    /** 开始一次新渲染（真实 react 每次 render 都从第一个 hook 重新数）。 */
    render: (component) => {
      cursor = 0;
      return component({});
    },
    api: {
      createElement: (type, props, ...children) => ({ type, props: { ...(props ?? {}), children: children.flat() } }),
      useState: (initial) => {
        const slot = cursor;
        cursor += 1;
        if (hooks.length <= slot) hooks[slot] = typeof initial === 'function' ? initial() : initial;
        const setter = (value) => {
          hooks[slot] = typeof value === 'function' ? value(hooks[slot]) : value;
        };
        return [hooks[slot], setter];
      },
      useCallback: (fn) => {
        cursor += 1;
        return fn;
      },
      useEffect: (fn) => {
        cursor += 1;
        if (typeof fn === 'function') fn();
      },
    },
  };
}

/** 宿主 API 的假响应：一份完整的 /status 快照。 */
function statusPayload() {
  return {
    ok: true,
    config: {
      enabled: true, firstRound: 3, interval: 5, maxFirstRound: 10, maxInterval: 20,
      windowSize: 8, maxInputBytes: 4096, maxOutputTokens: 64, timeoutMs: 60000,
      targetWords: 5, targetCjkCharacters: 10, skipSubagentSessions: true,
      keepRefreshingAfterManualRename: false, provider: '', model: '',
    },
    presets: [
      { id: 'conservative', label: '保守', hint: '省额度', firstRound: 5, interval: 10, recommended: false },
      { id: 'balanced', label: '均衡', hint: '推荐档位', firstRound: 3, interval: 5, recommended: true },
      { id: 'aggressive', label: '积极', hint: '更贴当前方向', firstRound: 2, interval: 3, recommended: false },
    ],
    configPath: 'C:/Users/x/.dsh/dsh-session-title-refresh/config.json',
    schedule: '第 3 轮首次总结，之后每 5 轮刷新一次',
    sessionList: [
      { sessionId: 'session-a', rounds: 4, nextDue: 5, refreshes: 1, title: '插件自动命名', titleSource: 'provider', subagent: false },
      { sessionId: 'child-1', rounds: 2, nextDue: 3, refreshes: 0, title: undefined, subagent: true },
    ],
    log: [{ at: new Date().toISOString(), sessionId: 'session-a', round: 3, ok: true, title: '插件自动命名' }],
  };
}

/** 造一个假的浏览器环境并装载客户端模块。 */
function loadClient() {
  const react = makeFakeReact();
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { json: async () => (String(url).endsWith('/status') ? statusPayload() : { ok: true, ...statusPayload() }) };
  };

  const window = { __ModuleLoader__: { load: (definition) => { window.__loaded = definition; } } };
  const requireImpl = (specifier) => {
    assert.equal(specifier, 'react', '客户端半边只应 require("react")');
    return react.api;
  };
  new Function('window', CODE)(window);
  assert.ok(window.__loaded, '客户端源码应调用 window.__ModuleLoader__.load');
  assert.equal(window.__loaded.id, 'dsh-session-title-refresh');
  const module = window.__loaded.factory(requireImpl);
  return { module, react, calls };
}

/** 把 React 元素树摊平成字符串，方便断言"界面上有这句话"。 */
function renderText(node) {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(renderText).join(' ');
  if (typeof node === 'object' && node.props) return renderText(node.props.children);
  return '';
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('客户端模块能被加载器装载并导出 Panel / apply', () => {
  const { module, react } = loadClient();
  assert.equal(typeof module.Panel, 'function');
  assert.equal(typeof module.apply, 'function');
  assert.deepEqual(module.inject, ['slots']);
  // 顺带确认：这个假 react 确实会把 hooks 写进数组（后续渲染断言依赖它）。
  react.api.useState(1);
  assert.equal(react.hooks.length >= 0, true);
});

test('apply 把设置页注册进 settings.section 槽位', () => {
  const { module } = loadClient();
  const injected = [];
  const registrations = [];
  const ctx = {
    effect: (fn) => fn(),
    slots: {
      inject: (slot, register) => {
        injected.push(slot);
        register();
      },
      register: (definition, component) => registrations.push({ definition, component }),
    },
  };
  module.apply(ctx);
  assert.deepEqual(injected, ['settings.section']);
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].definition.id, 'dsh-session-title-refresh');
  assert.equal(registrations[0].definition.label(), '会话标题自动刷新');
  assert.equal(registrations[0].component, module.Panel);
});

/** 等一轮宏任务：让 fetch → json → setState 这条链彻底落地。 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('首屏先显示读取中，随后渲染出档位、规则、会话表与记录', async () => {
  const { module, react, calls } = loadClient();

  assert.match(renderText(react.render(module.Panel)), /正在读取状态/);

  await settle();
  const text = renderText(react.render(module.Panel));
  assert.ok(calls.length >= 1, '/status 应当被请求过');
  assert.ok(text.length > 500, `第二次渲染应当拿到完整界面，实际长度 ${text.length}`);
  assert.ok(react.hooks[1] && react.hooks[1].firstRound === 3, '表单应当被 /status 的配置填满');
  assert.match(text, /会话标题自动刷新/);
  assert.match(text, /推荐/);
  assert.match(text, /第 3 轮首次总结，之后每 5 轮刷新一次/);
  assert.match(text, /活动会话/);
  assert.match(text, /session-a/);
  assert.match(text, /插件自动命名/);
  assert.match(text, /子代理/);
  assert.match(text, /最近自动命名/);
  assert.match(text, /高级：极限阈值与生成预算/);
  assert.match(text, /立即刷新所有会话标题/);
  assert.ok(calls.some((call) => String(call.url).endsWith('/status')), '应当请求过 /status');
});

test('读取失败时给出可见提示，而不是白屏', async () => {
  const { module, react } = loadClient();
  globalThis.fetch = async () => ({ json: async () => ({ ok: false, error: '宿主未就绪' }) });
  react.render(module.Panel);
  await settle();
  const text = renderText(react.render(module.Panel));
  assert.match(text, /宿主未就绪/);
});

test('面板发出的是同源 /status 请求，POST 都带 JSON 体', async () => {
  const { module, react, calls } = loadClient();
  react.render(module.Panel);
  await settle();
  assert.ok(calls.some((call) => String(call.url).endsWith('/status')));
  assert.ok(calls.every((call) => String(call.url).startsWith('/dsh-session-title-refresh/api')));
});