import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeState } from '../lib/index.js';

const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
const order = ['agent-teams', 'companion', 'acp', 'acp-cache'];
const names = ['help', 'acp', 'we-pet-pet', 'acp-cache', 'agent-teams', 'companion'];
const sourceRows = () => names.map((name) => Object.freeze({ name, description: `${name} description`, section: 'commands', hint: 'hint' }));

/** 走发布产物的 apply、配置通道和设置页；计时器由测试显式推进。 */
function load({ rows = sourceRows(), ready = true, language = 'zh-CN', candidates } = {}) {
  const store = new Map();
  const timers = new Map();
  const disposers = [];
  const hooks = [];
  let cursor = 0;
  let locale = language;
  let serviceReady = ready;
  let id = 0;
  let definition;
  const icons = Object.fromEntries(['IconUsersOutlineRegular', 'IconPanelLeftOutlineRegular', 'IconCompactOutlineRegular', 'IconDataOutlineRegular'].map((name) => [name, () => null]));
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat() } }),
    useState(initial) {
      const slot = cursor++;
      if (hooks.length <= slot) hooks[slot] = typeof initial === 'function' ? initial() : initial;
      return [hooks[slot], (next) => { hooks[slot] = typeof next === 'function' ? next(hooks[slot]) : next; }];
    },
    useEffect: () => {},
  };
  const document = {
    body: { appendChild() {} }, querySelector: () => null,
    getElementById: () => null, createElement: () => ({}),
  };
  const window = {
    __ModuleLoader__: { load: (value) => { definition = value; } },
    localStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
    setTimeout(fn) { timers.set(++id, fn); return id; },
    clearTimeout(key) { timers.delete(key); }, console: { warn() {} },
  };
  new Function('window', 'document', code)(window, document);
  const module = definition.factory((name) => {
    if (name === 'react') return react;
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return icons;
    throw new Error(`未预期的依赖：${name}`);
  });
  const original = candidates ?? (async function () { assert.equal(this, ui); return rows; });
  const ui = Object.create({ candidates: original });
  const ctx = {
    effect(fn) { const dispose = fn(); if (typeof dispose === 'function') disposers.push(dispose); },
    slots: { inject: () => () => {}, register: () => () => {} },
    get(name) {
      if (name === 'commandUi') return serviceReady ? ui : undefined;
      if (name === 'locale') return { getSnapshot: () => ({ active: locale }) };
      return undefined;
    },
  };
  module.apply(ctx);
  return {
    module, ui, store, window, document, icons, original, timers,
    render() { cursor = 0; return module.SettingsNavPanel(); },
    setLocale(value) { locale = value; }, ready() { serviceReady = true; },
    dispose() { disposers.toReversed().forEach((fn) => fn()); },
  };
}

function flatten(node) {
  if (node == null || node === false) return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node !== 'object') return [String(node)];
  if (typeof node.type === 'function') return flatten(node.type(node.props));
  return [node, ...flatten(node.props.children)];
}
function find(tree, className) {
  return flatten(tree).filter((node) => typeof node === 'object' && String(node.props.className ?? '').split(/\s+/).includes(className));
}
const req = { query: '', position: 'leading' };

test('发布产物挂载后，四条命令有中文标题和图标；默认只交换四项槽位', async () => {
  const originalRows = sourceRows();
  const { ui, icons } = load({ rows: originalRows });
  const result = await ui.candidates({ sessionId: 'sample' }, req);
  assert.deepEqual(result.map((row) => row.name), ['help', 'agent-teams', 'we-pet-pet', 'companion', 'acp', 'acp-cache']);
  assert.deepEqual(result.filter((row) => order.includes(row.name)).map((row) => row.label), ['智能体团队', '视觉伴侣', '上下文压缩', '缓存统计']);
  assert.equal(result[1].icon, icons.IconUsersOutlineRegular);
  assert.equal(result.find((row) => row.name === 'acp').description, '查看 bili 上下文压缩状态');
  assert.equal(result.find((row) => row.name === 'acp-cache').description, '查看提示词缓存统计（与 acp_cache 工具报告一致）');
  assert.equal(result[1].hint, 'hint');
  assert.equal(result[0], originalRows[0]);
  assert.ok(originalRows.every((row) => row.label === undefined), '不得改写宿主候选对象');
});

test('搜索时保留宿主相关性排序，参数和调用上下文原样传递', async () => {
  const session = { sessionId: 'sample' };
  const request = { query: 'ac', signal: new AbortController().signal };
  let fixture;
  fixture = load({ candidates: async function (actualSession, actualRequest) {
    assert.equal(this, fixture.ui);
    assert.equal(actualSession, session);
    assert.equal(actualRequest, request);
    return sourceRows();
  } });
  const result = await fixture.ui.candidates(session, request);
  assert.deepEqual(result.map((row) => row.name), names);
  assert.equal(result[1].label, '上下文压缩');
});

test('已由宿主提供图标的候选保持原样，语言切换在下一次候选请求生效', async () => {
  const official = Object.freeze({ name: 'agent-teams', label: '官方团队', icon: () => null, section: 'commands' });
  const fixture = load({ rows: [official, { name: 'acp' }] });
  let result = await fixture.ui.candidates({}, req);
  assert.equal(result[0], official);
  fixture.setLocale('en-US');
  result = await fixture.ui.candidates({}, req);
  assert.equal(result[1].label, 'Context Compression');
  assert.equal(result[1].description, 'Show bili context-compression status');
});

test('保存的命令顺序即时生效，停用命令管理后恢复宿主候选', async () => {
  const fixture = load();
  const commands = { enabled: true, order: ['acp-cache', 'acp', 'companion', 'agent-teams'] };
  fixture.module.saveConfig({ enabled: false, order: [{ name: '模型', index: 0 }], hidden: [], commands });
  assert.deepEqual(fixture.module.loadConfig().commands, commands);
  const result = await fixture.ui.candidates({}, req);
  assert.deepEqual(result.filter((row) => order.includes(row.name)).map((row) => row.name), commands.order);
  fixture.module.saveConfig({ ...fixture.module.loadConfig(), commands: { ...commands, enabled: false } });
  const disabled = await fixture.ui.candidates({}, req);
  assert.deepEqual(disabled.map((row) => row.name), names);
  assert.ok(disabled.every((row) => row.icon === undefined));
});

test('设置页提供四项顺序编辑，保存与恢复默认不覆盖设置导航偏好', () => {
  const fixture = load();
  const nav = { enabled: false, order: [{ name: '模型', index: 0 }], hidden: [{ name: '账户', index: 0 }] };
  fixture.module.saveConfig(nav);
  let tree = fixture.render();
  assert.ok(flatten(tree).includes('斜杠菜单顺序'));
  const down = find(tree, 'sno-command-down');
  assert.equal(down.length, 4);
  down[0].props.onClick();
  tree = fixture.render();
  find(tree, 'sno-command-save')[0].props.onClick();
  assert.deepEqual(fixture.module.loadConfig(), { ...nav, commands: { enabled: true, order: ['companion', 'agent-teams', 'acp', 'acp-cache'] } });
  find(fixture.render(), 'sno-command-reset')[0].props.onClick();
  assert.deepEqual(fixture.module.loadConfig(), { ...nav, commands: { enabled: true, order } });
});

test('命令配置经宿主文件存取、浏览器重载和远端恢复后保留', async () => {
  const commands = { enabled: true, order: ['acp-cache', 'agent-teams', 'companion', 'acp'] };
  const saved = { enabled: true, order: [{ name: '模型', index: 0 }], hidden: [], commands };
  assert.deepEqual(normalizeState(saved), saved, '宿主不能过滤掉命令配置');
  const first = load();
  first.module.saveConfig(saved);
  let remote;
  first.window.fetch = async (_url, options) => {
    remote = normalizeState(JSON.parse(options.body));
    return { ok: true, json: async () => ({ ok: true }) };
  };
  assert.equal(await first.module.pushState(), true);
  const reloaded = load();
  reloaded.store.set(reloaded.module.STORE_KEY, first.store.get(first.module.STORE_KEY));
  assert.deepEqual(reloaded.module.loadConfig().commands, commands);
  const restored = load();
  restored.window.fetch = async () => ({ ok: true, json: async () => ({ ok: true, state: remote }) });
  assert.equal(await restored.module.reconcile(restored.document), true);
  const result = await restored.ui.candidates({}, req);
  assert.deepEqual(result.filter((row) => order.includes(row.name)).map((row) => row.name), commands.order);
});

test('命令配置去重并补齐缺失默认项，旧版导航偏好仍保持原形状', () => {
  const fixture = load();
  const old = { enabled: false, order: [{ name: '模型', index: 0 }], hidden: [] };
  fixture.module.saveConfig(old);
  assert.deepEqual(fixture.module.loadConfig(), old);
  assert.deepEqual(normalizeState(old), old);
  const saved = { ...old, commands: { enabled: false, order: ['acp', null, 'acp', 'removed'] } };
  const expected = { enabled: false, order: ['acp', 'agent-teams', 'companion', 'acp-cache'] };
  fixture.module.saveConfig(saved);
  assert.deepEqual(fixture.module.loadConfig().commands, expected);
  assert.deepEqual(normalizeState(saved).commands, expected);
});

test('可选命令服务延迟到达后装饰，卸载清除轮询并恢复原方法', async () => {
  const fixture = load({ ready: false });
  assert.equal(fixture.timers.size, 1);
  fixture.ready();
  const [key, attempt] = [...fixture.timers][0];
  fixture.timers.delete(key);
  attempt();
  assert.notEqual(fixture.ui.candidates, fixture.original);
  fixture.dispose();
  assert.equal(Object.hasOwn(fixture.ui, 'candidates'), false);
  assert.equal(fixture.ui.candidates, fixture.original);
  const waiting = load({ ready: false });
  waiting.dispose();
  assert.equal(waiting.timers.size, 0);
});

test('卸载时不覆盖其他插件的包装，已卸载包装不再装饰在途请求', async () => {
  let resolve;
  const fixture = load({ candidates: () => new Promise((done) => { resolve = done; }) });
  const pending = fixture.ui.candidates({}, req);
  const oldWrapper = fixture.ui.candidates;
  const later = async (...args) => oldWrapper.apply(fixture.ui, args);
  fixture.ui.candidates = later;
  fixture.dispose();
  resolve(sourceRows());
  const result = await pending;
  assert.equal(fixture.ui.candidates, later);
  assert.ok(result.every((row) => row.label === undefined));
});

test('宿主候选异常原样传播，排序不跨越 section', async () => {
  const error = new Error('host failure');
  const failing = load({ candidates: async () => { throw error; } });
  await assert.rejects(failing.ui.candidates({}, req), (actual) => actual === error);
  const fixture = load({ rows: [{ name: 'acp', section: 'a' }, { name: 'help', section: 'b' }, { name: 'agent-teams', section: 'b' }] });
  assert.deepEqual((await fixture.ui.candidates({}, req)).map((row) => row.name), ['acp', 'help', 'agent-teams']);
});
