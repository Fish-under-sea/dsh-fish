import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeState } from '../lib/index.js';

const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
const order = ['agent-teams', 'companion', 'acp', 'acp-cache'];
const names = ['help', 'acp', 'we-pet-pet', 'acp-cache', 'agent-teams', 'companion'];
const sourceRows = () => names.map((name) => Object.freeze({ name, description: `${name} description`, section: 'commands', hint: 'hint' }));

/** 走发布产物的 apply、配置通道和设置页；计时器由测试显式推进。 */
function load({ rows = sourceRows(), ready = true, language = 'zh-CN', candidates, store = new Map() } = {}) {
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

test('发布产物挂载后，四条命令有中文标题和图标；配置外的行按宿主顺序排在分区末尾', async () => {
  const originalRows = sourceRows();
  const { ui, icons } = load({ rows: originalRows });
  const result = await ui.candidates({ sessionId: 'sample' }, req);
  assert.deepEqual(result.map((row) => row.name),
    ['agent-teams', 'companion', 'acp', 'acp-cache', 'help', 'we-pet-pet'],
    '默认顺序只覆盖出厂四条，其余行保持宿主相对顺序追加在末尾');
  assert.deepEqual(result.filter((row) => order.includes(row.name)).map((row) => row.label), ['智能体团队', '视觉伴侣', '上下文压缩', '缓存统计']);
  assert.equal(result[0].icon, icons.IconUsersOutlineRegular);
  assert.equal(result.find((row) => row.name === 'acp').description, '查看 bili 上下文压缩状态');
  assert.equal(result.find((row) => row.name === 'acp-cache').description, '查看提示词缓存统计（与 acp_cache 工具报告一致）');
  assert.equal(result[1].hint, 'hint');
  assert.equal(result.find((row) => row.name === 'help'), originalRows[0], '没被装饰的行原样返回');
  assert.equal(result.find((row) => row.name === 'we-pet-pet'), originalRows[2], '没被装饰的行原样返回');
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

test('命令配置去重、保留未知命令名并补齐出厂四条，旧版导航偏好仍保持原形状', () => {
  const fixture = load();
  const old = { enabled: false, order: [{ name: '模型', index: 0 }], hidden: [] };
  fixture.module.saveConfig(old);
  assert.deepEqual(fixture.module.loadConfig(), old);
  assert.deepEqual(normalizeState(old), old);
  const saved = { ...old, commands: { enabled: false, order: ['acp', null, 'acp', 'removed'] } };
  fixture.module.saveConfig(saved);
  // 客户端不再按固定白名单裁剪：'removed' 是「这次宿主没返回的名字」，插件重新装上
  // 时用户给它的位置还要用，所以保留在配置里（应用顺序时匹配不到行＝忽略）。
  assert.deepEqual(fixture.module.loadConfig().commands, {
    enabled: false, order: ['acp', 'removed', 'agent-teams', 'companion', 'acp-cache'],
  });
  // 宿主半边（本任务不允许改）仍按旧白名单落盘，这是跨机同步的已知边界。
  assert.deepEqual(normalizeState(saved).commands,
    { enabled: false, order: ['acp', 'agent-teams', 'companion', 'acp-cache'] });
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
  assert.deepEqual((await fixture.ui.candidates({}, req)).map((row) => row.name), ['acp', 'agent-teams', 'help'],
    '每行留在自己的分区里：a 分区的 acp 仍在 b 分区之前，b 分区内配置项在前、新项在后');
});

// ----------------------------- 2.0.0：开始页命令菜单全量排序（任意行，不限于旧四条）

/** 截图里那一列命令的代表集：三个分区，名字与标签刻意不同 —— 识别只能靠 name。 */
const MENU = [
  { name: 'file', label: '文件', section: 'core' },
  { name: 'review', label: '代码审查和变更', section: 'core' },
  { name: 'terminal', label: '新建终端', section: 'core' },
  { name: 'git', label: 'Git', section: 'tools' },
  { name: 'browser', label: '浏览器', section: 'tools' },
  { name: 'agent-teams', label: '智能体团队', section: 'plugins' },
  { name: 'companion', label: '视觉伴侣', section: 'plugins' },
  { name: 'acp', label: '上下文压缩', section: 'plugins' },
  { name: 'acp-cache', label: '缓存统计', section: 'plugins' },
];
const menuNames = () => MENU.map((row) => row.name);
const menuRows = () => MENU.map((row) => Object.freeze({ ...row, description: `${row.name} description` }));

/** 存一份命令配置；导航部分保持「没有自定义顺序」，断言时不会互相干扰。 */
function saveCommandOrder(fixture, commandOrder) {
  fixture.module.saveConfig({
    enabled: true,
    order: [],
    hidden: [],
    commands: { enabled: true, order: commandOrder },
  });
}

test('任意行都能按保存顺序重排，且不跨分区标题', async () => {
  const fixture = load({ rows: menuRows() });
  const saved = ['terminal', 'review', 'file', 'browser', 'git', 'acp-cache', 'companion', 'agent-teams', 'acp'];
  saveCommandOrder(fixture, saved);
  assert.deepEqual((await fixture.ui.candidates({}, req)).map((row) => row.name), saved);
});

test('宿主把分区交错输出时也不跨边界：每个分区的行只填回自己的位置', async () => {
  const fixture = load({
    rows: [
      { name: 'file', section: 'core' },
      { name: 'git', section: 'tools' },
      { name: 'review', section: 'core' },
    ],
  });
  saveCommandOrder(fixture, ['review', 'file', 'git']);
  assert.deepEqual((await fixture.ui.candidates({}, req)).map((row) => row.name), ['review', 'git', 'file'],
    'core 的两行交换位置，但不越过中间那行 tools 命令');
});

test('配置里没有的新行保持原相对顺序、追加在所属分区末尾；已移除的行忽略', async () => {
  const fixture = load({ rows: menuRows() });
  saveCommandOrder(fixture, ['removed-command', 'terminal', 'file', 'browser']);
  assert.deepEqual((await fixture.ui.candidates({}, req)).map((row) => row.name), [
    'terminal', 'file', 'review',
    'browser', 'git',
    'agent-teams', 'companion', 'acp', 'acp-cache',
  ]);
});

test('搜索态保持宿主原顺序，配置里的顺序不参与排序', async () => {
  const fixture = load({ rows: menuRows() });
  saveCommandOrder(fixture, ['acp', 'file', 'git', 'browser', 'terminal', 'review', 'agent-teams', 'companion', 'acp-cache']);
  const searched = await fixture.ui.candidates({}, { query: 'g' });
  assert.deepEqual(searched.map((row) => row.name), menuNames(), '搜索时保留宿主相关性排序');
  assert.equal(searched.find((row) => row.name === 'acp').label, '上下文压缩', '搜索态仍然补展示装饰');
  // 没有 query 字段（非搜索）时照常重排 —— 按分区取各自配置里的相对次序。
  assert.deepEqual((await fixture.ui.candidates({})).map((row) => row.name), [
    'file', 'terminal', 'review',
    'git', 'browser',
    'acp', 'agent-teams', 'companion', 'acp-cache',
  ]);
});

test('搜索结果的子集不会被当成「全部命令」缓存下来', async () => {
  const fixture = load({ rows: [MENU[0], MENU[3]] });
  await fixture.ui.candidates({}, { query: 'fi' });
  const rows = fixture.module.commandEditorRows(fixture.module.normalizeCommands().order);
  assert.deepEqual(rows.map((row) => row.name), order, '面板里只有已保存的四条，不拿搜索结果冒充全部命令');
});

test('保存的全量顺序经 localStorage 重载后仍然生效（重启恢复）', async () => {
  const first = load({ rows: menuRows() });
  const saved = ['terminal', 'file', 'review', 'browser', 'git', 'acp-cache', 'agent-teams', 'companion', 'acp'];
  saveCommandOrder(first, saved);
  const second = load({ rows: menuRows(), store: first.store });
  assert.deepEqual((await second.ui.candidates({}, req)).map((row) => row.name), saved);
});

test('宿主文件只装得下旧四条时，启动对账不会截断其余行的顺序', async () => {
  const saved = ['terminal', 'file', 'review', 'browser', 'git', 'acp-cache', 'agent-teams', 'companion', 'acp'];
  const first = load({ rows: menuRows() });
  saveCommandOrder(first, saved);
  let hostState = null;
  first.window.fetch = async (_url, options) => {
    if (options?.method === 'POST') {
      // 宿主半边的白名单会丢掉新命令：只留下旧四条（本任务不改 lib/index.js）。
      hostState = normalizeState(JSON.parse(options.body));
      return { ok: true, json: async () => ({ ok: true }) };
    }
    return { ok: true, json: async () => ({ ok: true, state: hostState }) };
  };
  assert.equal(await first.module.pushState(), true);
  assert.equal(hostState.commands.order.length, order.length, '前置条件：宿主只存得下旧四条');

  // 同一台机器重启：本地没动过，宿主回的是被裁剪过的那份 —— 不能照着它截断本地。
  const second = load({ rows: menuRows(), store: first.store });
  let posts = 0;
  second.window.fetch = async (_url, options) => {
    if (options?.method === 'POST') posts += 1;
    return { ok: true, json: async () => ({ ok: true, state: hostState }) };
  };
  assert.equal(await second.module.reconcile(second.document), false, '合并结果与本地逐字相同，不该重写');
  assert.equal(posts, 0, '同一台机器重启不该产生写请求');
  assert.deepEqual(second.module.loadConfig().commands.order, saved);
  assert.deepEqual((await second.ui.candidates({}, req)).map((row) => row.name), saved);
});

test('另一台机器改了旧四条的次序：合并只调整这四条，其余行留在原位', async () => {
  const local = ['terminal', 'file', 'review', 'browser', 'git', 'acp-cache', 'agent-teams', 'companion', 'acp'];
  const fixture = load({ rows: menuRows() });
  saveCommandOrder(fixture, local);
  fixture.store.set(fixture.module.SYNCED_KEY, fixture.store.get(fixture.module.STORE_KEY));
  const remote = {
    enabled: true,
    order: [],
    hidden: [],
    commands: { enabled: true, order: ['agent-teams', 'companion', 'acp', 'acp-cache'] },
  };
  fixture.window.fetch = async () => ({ ok: true, json: async () => ({ ok: true, state: remote }) });
  assert.equal(await fixture.module.reconcile(fixture.document), true, '远端调整了旧四条，应合并采用');
  assert.deepEqual(fixture.module.loadConfig().commands.order, [
    'terminal', 'file', 'review', 'browser', 'git',
    'agent-teams', 'companion', 'acp', 'acp-cache',
  ]);
});

test('旧版宿主文件没有 commands 字段时，本地命令偏好不被清空', async () => {
  const saved = menuNames();
  const fixture = load({ rows: menuRows() });
  saveCommandOrder(fixture, saved);
  fixture.store.set(fixture.module.SYNCED_KEY, fixture.store.get(fixture.module.STORE_KEY));
  const oldHost = { enabled: true, order: [{ name: '模型', index: 0 }], hidden: [] };
  fixture.window.fetch = async () => ({ ok: true, json: async () => ({ ok: true, state: oldHost }) });
  await fixture.module.reconcile(fixture.document);
  assert.deepEqual(fixture.module.loadConfig().commands.order, saved);
});

test('命令行列缓存跨会话保留：没打开命令菜单也能列出全部命令', async () => {
  const first = load({ rows: menuRows() });
  await first.ui.candidates({}, req);
  const cache = JSON.parse(first.store.get(first.module.COMMAND_ROWS_KEY));
  assert.equal(cache.rows.length, MENU.length, '捕获到的命令行应写进派生缓存');

  const second = load({ rows: menuRows(), store: first.store });
  const rows = second.module.commandEditorRows(second.module.normalizeCommands().order);
  assert.deepEqual(rows.map((row) => row.name),
    ['file', 'review', 'terminal', 'git', 'browser', 'agent-teams', 'companion', 'acp', 'acp-cache']);
  assert.equal(rows[0].label, '文件', '面板沿用宿主标题，认不出中文名时退回 name');
});

test('识别用宿主给的 name，不随标签文字变化', async () => {
  const first = load({
    rows: [{ name: 'git', label: 'Git', section: 'tools' }, { name: 'browser', label: '浏览器', section: 'tools' }],
  });
  saveCommandOrder(first, ['browser', 'git']);
  const second = load({
    rows: [{ name: 'git', label: 'Version Control', section: 'tools' }, { name: 'browser', label: 'Browser', section: 'tools' }],
    store: first.store,
  });
  const result = await second.ui.candidates({}, req);
  assert.deepEqual(result.map((row) => row.name), ['browser', 'git']);
  assert.equal(result[0].label, 'Browser', '非出厂命令沿用宿主当前标签，不写死中文');
});

test('设置页列出捕获到的全部命令：分区内可调序，保存后下一次候选即生效', async () => {
  const fixture = load({ rows: menuRows() });
  await fixture.ui.candidates({}, req);
  let tree = fixture.render();
  assert.ok(flatten(tree).includes('斜杠菜单顺序'));
  assert.ok(flatten(tree).includes('分区：core'));

  const rows = find(tree, 'sno-command-row');
  assert.equal(rows.length, MENU.length, '全部命令都出现在编辑器里');
  assert.ok(flatten(rows[0]).join(' ').includes('文件'));

  const downs = find(tree, 'sno-command-down');
  const ups = find(tree, 'sno-command-up');
  assert.equal(ups[3].props.disabled, true, 'tools 第一行不能上移越过分区边界');
  assert.equal(downs[2].props.disabled, true, 'core 最后一行不能下移越过分区边界');
  assert.equal(downs[4].props.disabled, true, 'tools 最后一行不能下移');

  downs[0].props.onClick(); // 「文件」下移一位，与「代码审查和变更」交换
  tree = fixture.render();
  assert.ok(flatten(tree).join(' ').includes('未保存'));
  find(tree, 'sno-command-save')[0].props.onClick();
  const saved = ['review', 'file', 'terminal', 'git', 'browser', 'agent-teams', 'companion', 'acp', 'acp-cache'];
  assert.deepEqual(fixture.module.loadConfig().commands.order, saved);
  assert.deepEqual((await fixture.ui.candidates({}, req)).map((row) => row.name), saved);
});

test('设置页只列当前命令；配置里已移除的旧名字在保存后仍保留', async () => {
  const fixture = load({ rows: menuRows() });
  await fixture.ui.candidates({}, req);
  saveCommandOrder(fixture, [...menuNames(), 'gone-command']);
  const tree = fixture.render();
  assert.ok(!flatten(tree).join(' ').includes('gone-command'), '宿主没返回的旧命令不出现在编辑器里');
  find(tree, 'sno-command-down')[0].props.onClick();
  find(fixture.render(), 'sno-command-save')[0].props.onClick();
  assert.equal(fixture.module.loadConfig().commands.order.at(-1), 'gone-command',
    '旧名字留在末尾：插件重新装上时还能回到用户给的位置');
});

test('设置页保存命令顺序时推给现有宿主文件通道（不新增文件）', async () => {
  const fixture = load({ rows: menuRows() });
  await fixture.ui.candidates({}, req);
  const requests = [];
  fixture.window.fetch = async (url, options) => {
    requests.push({ url, body: options?.body });
    return { ok: true, json: async () => ({ ok: true }) };
  };
  find(fixture.render(), 'sno-command-down')[0].props.onClick();
  find(fixture.render(), 'sno-command-save')[0].props.onClick();
  assert.equal(requests.length, 1, '保存应推一次快照');
  assert.equal(requests[0].url, `${fixture.module.SYNC_API}/state`);
  assert.deepEqual(JSON.parse(requests[0].body).commands.order, fixture.module.loadConfig().commands.order);
});
