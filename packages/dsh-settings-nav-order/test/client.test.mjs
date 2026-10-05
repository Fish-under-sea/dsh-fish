/**
 * dsh-settings-nav-order 的浏览器半边（lib/client.js）测试。
 *
 * 这个插件做的事全部在 DOM 上：给「设置」面板左侧那列导航按钮打 CSS order，
 * 再自带一个设置页让用户上下移动菜单项。所以这里用一个手写的假 DOM（元素、
 * 样式、localStorage）走完整条链路：装载 → 计算顺序 → 落到元素上 → 面板渲染。
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
/** 源码读一次（同一个文件被反复 new Function 执行）。 */
const CODE = fs.readFileSync(SOURCE, 'utf8');
/** 包清单：注册名必须等于包名，读 name 而不硬编码，改名后测试不会跟着漂移。 */
const PKG = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'package.json'), 'utf8'));

/** 最小的 react 替身：hooks 用一个数组轮转，useEffect 立即执行一次。 */
function makeFakeReact() {
  const hooks = [];
  /** 每个 useEffect 占一个槽位：`[]` 依赖的副作用只在首次渲染执行（与真实 React 一致）。 */
  const effects = [];
  let cursor = 0;
  return {
    hooks,
    /** 开始一次新渲染（真实 react 每次 render 都从第一个 hook 重新数）。 */
    render: (component, props) => {
      cursor = 0;
      return component(props ?? {});
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
      useEffect: (fn, deps) => {
        const slot = cursor;
        cursor += 1;
        if (!effects[slot]) effects[slot] = { ran: false };
        const record = effects[slot];
        if (record.ran && Array.isArray(deps) && deps.length === 0) return;
        record.ran = true;
        if (typeof fn === 'function') fn();
      },
    },
  };
}

/**
 * 极简选择器：只支持实现里真正用到的两种写法——`.className` 与 `[class*="x"]`。
 * 后者是必需的：真实 DOM 里类名是 CSS Modules 哈希名（ZiQlkq_navList），
 * 只能按子串匹配。
 */
function matchesSelector(node, selector) {
  const className = String(node.className ?? '');
  const attr = /^\[class\*="([^"]+)"\]$/.exec(selector);
  if (attr) return className.includes(attr[1]);
  const dot = /^\.(.+)$/.exec(selector);
  if (dot) return className.split(/\s+/).includes(dot[1]);
  return false;
}

/** 按文档顺序收集 root 后代里命中选择器的元素。 */
function querySelectorAll(root, selector) {
  const out = [];
  const walk = (node) => {
    for (const child of node.children ?? []) {
      if (matchesSelector(child, selector)) out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

/** 假元素：够 React 与重排逻辑用（style、children、textContent、querySelector）。 */
function makeElement(tagName = 'div') {
  return {
    tagName,
    children: [],
    style: {},
    attributes: {},
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    setAttribute(key, value) {
      this.attributes[key] = String(value);
    },
    removeAttribute(key) {
      delete this.attributes[key];
    },
    querySelector(selector) {
      return querySelectorAll(this, selector)[0] ?? null;
    },
  };
}

/** 设置面板左侧那列容器（真实 DOM 里是一个 div.navList）。 */
function makeNavList(items) {
  const list = makeElement('div');
  list.className = 'navList';
  list.children = items;
  return list;
}

/** 造一个导航按钮：真实 DOM 里 button.navCell > span.navLabel。 */
function makeNavCell(label, name) {
  const button = makeElement('button');
  button.className = 'navCell';
  const span = makeElement('span');
  span.className = 'navLabel';
  span.textContent = label;
  button.children = [span];
  if (name !== undefined) button.attributes['data-nav-name'] = name;
  return button;
}

/** 假浏览器环境：设置面板由 portal 挂到 document.body，所以 body 里就有 .navList。 */
function makeFakeDom(initialEntries) {
  const store = new Map();
  const elements = new Map();
  const document = {
    body: makeElement('body'),
    createElement: (tagName) => makeElement(tagName),
  };
  /** body 子树里的全部后代：设置面板由 portal 挂到 body 下，所以都从这里找。 */
  const descendants = () => {
    const out = [];
    const walk = (node) => {
      for (const child of node.children ?? []) {
        out.push(child);
        walk(child);
      }
    };
    walk(document.body);
    return out;
  };
  document.querySelector = (selector) => querySelectorAll(document.body, selector)[0] ?? null;
  document.getElementById = (id) => descendants().find((el) => el.id === id) ?? null;
  const resetEntries = (entries) => {
    elements.clear();
    document.body.children = entries.map(([name, label]) => {
      const cell = makeNavCell(label, name);
      cell.attributes['data-nav-menu'] = name;
      elements.set(name, cell);
      return cell;
    });
    document.body.children = [makeNavList(document.body.children)];
  };
  resetEntries(initialEntries);
  return {
    document,
    /** 读取容器里当前的按钮顺序（按 DOM 排列）。 */
    labels: () => document.body.children[0].children.map((cell) => cell.children[0].textContent),
    labelsInVisualOrder: () =>
      document.body.children[0].children
        .map((cell, index) => ({ cell, index }))
        .sort((a, b) => {
          const left = Number(a.cell.style.order ?? a.index);
          const right = Number(b.cell.style.order ?? b.index);
          return left - right || a.index - b.index;
        })
        .map((row) => row.cell.children[0].textContent),
    resetEntries,
    window: {
      __ModuleLoader__: { load: (definition) => { globalThis.__navOrderLoaded = definition; } },
      localStorage: {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
      },
      document,
    },
    store,
  };
}

/** 装载客户端模块：返回 module / react / 假 DOM。 */
function loadClient(initialEntries = []) {
  const dom = makeFakeDom(initialEntries);
  const react = makeFakeReact();
  globalThis.window = dom.window;
  globalThis.document = dom.document;
  globalThis.__navOrderLoaded = undefined;
  new Function('window', 'document', CODE)(dom.window, dom.document);
  assert.ok(globalThis.__navOrderLoaded, '客户端源码应调用 window.__ModuleLoader__.load');
  assert.equal(globalThis.__navOrderLoaded.id, PKG.name, '注册名必须是包名（loader 按包名认领 factory）');
  const module = globalThis.__navOrderLoaded.factory((specifier) => {
    assert.equal(specifier, 'react', '客户端半边只应 require("react")');
    return react.api;
  });
  return { module, react, dom };
}

/** 把 React 元素树摊平成字符串，方便断言「界面上有这句话」。函数组件也会展开。 */
function renderText(node) {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(renderText).join(' ');
  if (typeof node === 'object' && node.props) {
    if (typeof node.type === 'function') return renderText(node.type(node.props));
    return renderText(node.props.children);
  }
  return '';
}

/** 在元素树里按 className 找一个节点（用来模拟点按钮）。 */
function findByClass(node, className) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findByClass(child, className);
      if (hit) return hit;
    }
    return null;
  }
  const own = String(node.props?.className ?? '').split(/\s+/);
  if (own.includes(className)) return node;
  return findByClass(node.props?.children, className);
}

/**
 * 收集树里全部命中 className 的节点，并把函数组件展开后再找。
 * 假 react 不会自动渲染组件，而「上移/下移」按钮只存在于 `Row` 的返回值里，
 * 不展开就永远找不到（真 react 里这一步由渲染器完成）。
 */
function collectByClass(node, className, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const child of node) collectByClass(child, className, out);
    return out;
  }
  const own = String(node.props?.className ?? '').split(/\s+/);
  if (own.includes(className)) out.push(node);
  collectByClass(node.props?.children, className, out);
  if (typeof node.type === 'function' && !own.includes(className)) {
    collectByClass(node.type(node.props ?? {}), className, out);
  }
  return out;
}

const SAMPLE = [
  ['general', '通用设置'],
  ['models', '模型'],
  ['plugins', '内置插件'],
  ['agent-presets', 'Agent 预设'],
  ['account', '账户'],
];

test('客户端模块能被加载器装载，并导出 apply / computeOrder / applyToNav / SettingsNavPanel', () => {
  const { module } = loadClient();
  assert.equal(typeof module.apply, 'function');
  assert.equal(typeof module.computeOrder, 'function');
  assert.equal(typeof module.applyToNav, 'function');
  assert.equal(typeof module.SettingsNavPanel, 'function');
  assert.deepEqual(module.inject, ['slots']);
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
  assert.equal(registrations[0].definition.id, 'settings-nav-order');
  assert.equal(registrations[0].definition.label(), '设置导航顺序');
  assert.equal(registrations[0].component, module.SettingsNavPanel);
});

test('没有配置时保持原顺序（order 就是原下标）', () => {
  const { module } = loadClient();
  const rows = module.computeOrder(SAMPLE.map(([, label]) => ({ name: label })), { enabled: true, order: [] });
  assert.deepEqual(rows.map((row) => row.name), SAMPLE.map(([, label]) => label));
  assert.deepEqual(rows.map((row) => row.rank), [0, 1, 2, 3, 4]);
});

test('已配置的项排到前面，且按配置顺序；没提到的项保持原顺序跟在后面', () => {
  const { module } = loadClient();
  const names = SAMPLE.map(([, label]) => label);
  const rows = module.computeOrder(names.map((name) => ({ name })), {
    enabled: true,
    order: [
      { name: '内置插件', index: 0 },
      { name: '通用设置', index: 0 },
    ],
  });
  assert.deepEqual(rows.map((row) => row.name), ['内置插件', '通用设置', '模型', 'Agent 预设', '账户']);
  assert.deepEqual(rows.map((row) => row.rank), [0, 1, 2, 3, 4]);
});

test('配置里有已经不在菜单里的旧项时，其余项顺序不乱', () => {
  const { module } = loadClient();
  const rows = module.computeOrder([{ name: '通用设置' }, { name: '模型' }], {
    enabled: true,
    order: [
      { name: '早就删掉的插件', index: 0 },
      { name: '模型', index: 0 },
    ],
  });
  assert.deepEqual(rows.map((row) => `${row.name}:${row.rank}`), ['模型:0', '通用设置:1']);
});

test('同名菜单项按组内序号区分，不会互相错位', () => {
  const { module } = loadClient();
  const rows = module.computeOrder(
    [{ name: '插件' }, { name: '插件' }, { name: '模型' }],
    { enabled: true, order: [{ name: '插件', index: 1 }, { name: '插件', index: 0 }] },
  );
  assert.deepEqual(rows.map((row) => row.name), ['插件', '插件', '模型']);
  assert.deepEqual(rows.map((row) => row.rank), [0, 1, 2]);
  assert.deepEqual(rows.map((row) => row.index), [1, 0, 2], '第二项「插件」交换到第一项「插件」前面');
});

test('未启用时保持原顺序', () => {
  const { module } = loadClient();
  const rows = module.computeOrder([{ name: '模型' }, { name: '通用设置' }], {
    enabled: false,
    order: [{ name: '模型', index: 0 }],
  });
  assert.deepEqual(rows.map((row) => row.name), ['模型', '通用设置']);
});

test('moveItem 只交换相邻两项，越界请求不动', () => {
  const { module } = loadClient();
  const order = [{ name: '模型' }, { name: '通用设置' }, { name: '账户' }];
  assert.deepEqual(module.moveItem(order, 0, -1), order, '第一项上移无效');
  assert.deepEqual(module.moveItem(order, 2, 1), order, '最后一项下移无效');
  assert.deepEqual(module.moveItem(order, 1, -1).map((row) => row.name), ['通用设置', '模型', '账户']);
  assert.deepEqual(module.moveItem(order, 1, 1).map((row) => row.name), ['模型', '账户', '通用设置']);
});

test('列表顺序是纯粹的移动结果，不依赖调用方的可变性', () => {
  const { module } = loadClient();
  const names = SAMPLE.map(([, label]) => label);
  // 「账户」（最后一项）上移两位：多步移动的结果与逐步交换一致，且入参不被改动。
  const moved = module.moveItem(names.map((name) => ({ name })), 4, -2);
  assert.deepEqual(moved.map((row) => row.name), ['通用设置', '模型', '账户', '内置插件', 'Agent 预设']);
});

const STORE_KEY = 'dsh-settings-nav-order/v1';

test('配置写进 localStorage，能原样读回来', () => {
  const { module, dom } = loadClient();
  const saved = { enabled: true, order: [{ name: '模型', index: 0 }], hidden: [] };
  module.saveConfig(saved);
  assert.equal(dom.store.get(STORE_KEY), JSON.stringify(saved));
  assert.deepEqual(module.loadConfig(), saved);
});

test('没有配置 / 配置损坏 / JSON 解析失败时都退回默认值，不抛错', () => {
  const { module, dom } = loadClient();
  assert.deepEqual(module.loadConfig(), { enabled: true, order: [], hidden: [] });
  dom.store.set(STORE_KEY, '{ 这不是 JSON');
  assert.deepEqual(module.loadConfig(), { enabled: true, order: [], hidden: [] });
  dom.store.set(STORE_KEY, JSON.stringify({ enabled: 'yes', order: [{ name: 1 }, null] }));
  assert.deepEqual(module.loadConfig(), { enabled: true, order: [], hidden: [] });
  dom.store.set(STORE_KEY, JSON.stringify({ enabled: false, order: [{ name: '模型', index: 2 }] }));
  assert.deepEqual(module.loadConfig(), { enabled: false, order: [{ name: '模型', index: 2 }], hidden: [] });
});

test('localStorage 本身不可用时（隐私模式等）读写都不抛错', () => {
  const { module, dom } = loadClient();
  dom.window.localStorage = {
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: () => { throw new Error('SecurityError'); },
  };
  assert.deepEqual(module.loadConfig(), { enabled: true, order: [], hidden: [] });
  assert.doesNotThrow(() => module.saveConfig({ enabled: false, order: [] }));
});

test('applyToNav 按 rank 给导航按钮打 CSS order，未启用时清干净', () => {
  const { module, dom } = loadClient(SAMPLE);
  module.saveConfig({ enabled: true, order: [{ name: '内置插件', index: 0 }, { name: '通用设置', index: 0 }] });
  module.applyToNav(dom.document);
  assert.deepEqual(dom.labelsInVisualOrder(), ['内置插件', '通用设置', '模型', 'Agent 预设', '账户']);

  module.saveConfig({ enabled: false, order: [] });
  module.applyToNav(dom.document);
  assert.deepEqual(dom.labels(), SAMPLE.map(([, label]) => label));
  assert.ok(
    dom.document.body.children[0].children.every((cell) => cell.style.order === ''),
    '停用后不该留下任何 order 残留',
  );
  assert.ok(
    dom.document.body.children[0].children.every((cell) => !('data-nav-rank' in cell.attributes)),
    '停用后不该留下标记',
  );
});

test('applyToNav 遇到没有 order 槽的假按钮也不崩（真实 DOM 总有）', () => {
  const { module, dom } = loadClient(SAMPLE);
  delete dom.document.body.children[0].children[0].style;
  assert.doesNotThrow(() => module.applyToNav(dom.document));
});

test('applyToNav 在面板未打开时安静退出', () => {
  const { module, dom } = loadClient([]);
  dom.document.body.children = [];
  assert.doesNotThrow(() => module.applyToNav(dom.document));
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('设置页渲染出当前菜单顺序，并把改后的顺序存起来', async () => {
  const { module, react, dom } = loadClient(SAMPLE);
  react.render(module.SettingsNavPanel);
  await tick();
  const text = renderText(react.render(module.SettingsNavPanel));
  for (const [, label] of SAMPLE) assert.ok(text.includes(label), `面板上应列出「${label}」`);
  assert.match(text, /设置导航顺序/);
  assert.match(text, /已检测到 5 个菜单项/, '面板应报告检测到的菜单项数量');
  assert.match(text, /当前顺序与已保存的一致/, '刚打开、还没动过时不该报「未保存」');

  const ups = collectByClass(react.render(module.SettingsNavPanel), 'sno-up');
  assert.equal(ups.length, SAMPLE.length, '每行都应有一个「上移」按钮');
  assert.equal(ups[0].props.disabled, true, '第一行不能上移');
  const secondRowUp = ups[1];
  assert.equal(secondRowUp.props.disabled, false, '第二行可以上移');
  secondRowUp.props.onClick();
  await tick();
  const after = renderText(react.render(module.SettingsNavPanel));
  assert.ok(after.includes('未保存'), '移动之后应提示还没保存');

  const save = findByClass(react.render(module.SettingsNavPanel), 'sno-save');
  assert.ok(save, '应有保存按钮');
  save.props.onClick();
  await tick();
  assert.deepEqual(module.loadConfig().order.slice(0, 2).map((row) => row.name), ['模型', '通用设置']);
  module.applyToNav(dom.document);
  assert.deepEqual(dom.labelsInVisualOrder().slice(0, 2), ['模型', '通用设置']);
});

test('停用开关保存后，导航立刻回到原顺序', async () => {
  const { module, react, dom } = loadClient(SAMPLE);
  module.saveConfig({ enabled: true, order: [{ name: '账户', index: 0 }] });
  module.applyToNav(dom.document);
  assert.equal(dom.labelsInVisualOrder()[0], '账户');

  react.render(module.SettingsNavPanel);
  await tick();
  const toggle = findByClass(react.render(module.SettingsNavPanel), 'sno-toggle');
  assert.ok(toggle, '应有停用开关');
  toggle.props.onChange({ target: { checked: false } });
  await tick();
  findByClass(react.render(module.SettingsNavPanel), 'sno-save').props.onClick();
  await tick();
  assert.equal(module.loadConfig().enabled, false);
  module.applyToNav(dom.document);
  assert.deepEqual(dom.labelsInVisualOrder(), SAMPLE.map(([, label]) => label));
});

test('「恢复默认」清掉顺序，导航回到原顺序', async () => {
  const { module, react, dom } = loadClient(SAMPLE);
  module.saveConfig({ enabled: true, order: [{ name: '账户', index: 0 }] });
  react.render(module.SettingsNavPanel);
  await tick();
  const reset = findByClass(react.render(module.SettingsNavPanel), 'sno-reset');
  assert.ok(reset, '应有「恢复默认」按钮');
  reset.props.onClick();
  await tick();
  assert.deepEqual(module.loadConfig(), { enabled: true, order: [], hidden: [] });
  module.applyToNav(dom.document);
  assert.deepEqual(dom.labelsInVisualOrder(), SAMPLE.map(([, label]) => label));
});

// ---------------------------------------------------------------- 拖拽排序

test('moveTo 把一项移到指定位置：返回新数组，不改入参', () => {
  const { module } = loadClient();
  const list = SAMPLE.map(([, label]) => ({ name: label }));
  const before = list.map((row) => row.name);

  assert.deepEqual(
    module.moveTo(list, 0, 1).map((row) => row.name),
    ['模型', '通用设置', '内置插件', 'Agent 预设', '账户'],
  );
  assert.deepEqual(
    module.moveTo(list, 3, 0).map((row) => row.name),
    ['Agent 预设', '通用设置', '模型', '内置插件', '账户'],
  );
  assert.deepEqual(module.moveTo(list, 1, 1).map((row) => row.name), before, '落回原位等于没动');
  assert.deepEqual(list.map((row) => row.name), before, '入参不能被改动');
});

test('moveTo 越界时原样返回，目标越界时夹到两端', () => {
  const { module } = loadClient();
  const list = ['a', 'b', 'c'].map((name) => ({ name }));
  assert.deepEqual(module.moveTo(list, -1, 1).map((row) => row.name), ['a', 'b', 'c']);
  assert.deepEqual(module.moveTo(list, 3, 0).map((row) => row.name), ['a', 'b', 'c']);
  assert.deepEqual(module.moveTo(list, 0, 99).map((row) => row.name), ['b', 'c', 'a'], '目标越界夹到最后');
  assert.deepEqual(module.moveTo(list, 2, -5).map((row) => row.name), ['c', 'a', 'b'], '目标越界夹到最前');
});

test('moveItem 的相邻交换与 moveTo 对同一动作给出相同结果', () => {
  const { module } = loadClient();
  const list = ['a', 'b', 'c', 'd'].map((name) => ({ name }));
  for (const [index, delta] of [[0, 1], [3, -1], [1, -1], [2, 1]]) {
    assert.deepEqual(
      module.moveItem(list, index, delta).map((row) => row.name),
      module.moveTo(list, index, index + delta).map((row) => row.name),
      `第 ${index} 项移动 ${delta} 步，箭头与拖拽应给出同一个结果`,
    );
  }
});

test('dropIndex 按各行中线算出插入位置', () => {
  const { module } = loadClient();
  const centers = [10, 30, 50];
  assert.equal(module.dropIndex(centers, 5), 0, '在最上面那行之上 → 插到最前');
  assert.equal(module.dropIndex(centers, 10), 1, '正好压在中线上算「到下一行前面」');
  assert.equal(module.dropIndex(centers, 29), 1);
  assert.equal(module.dropIndex(centers, 45), 2);
  assert.equal(module.dropIndex(centers, 999), 3, '在最后一行之下 → 插到最后');
  assert.equal(module.dropIndex([], 42), 0, '没有行时插到第 0 位');
});

test('adjustDrop 把「含被拖项」的落点换算成「取出被拖项后」的下标', () => {
  const { module } = loadClient();
  assert.equal(module.adjustDrop(1, 3), 2, '往后拖时被拖项自己占了一位');
  assert.equal(module.adjustDrop(3, 1), 1, '往前拖不受影响');
  assert.equal(module.adjustDrop(2, 2), 2, '原地落下');
  assert.equal(module.adjustDrop(0, 4), 3);
});

// ---------------------------------------------------------------- 隐藏设置项

test('老配置没有 hidden 字段时读成空数组：向后兼容，已保存的顺序不丢', () => {
  const { module, dom } = loadClient();
  dom.store.set(STORE_KEY, JSON.stringify({ enabled: true, order: [{ name: '模型', index: 0 }] }));
  const loaded = module.loadConfig();
  assert.deepEqual(loaded.order, [{ name: '模型', index: 0 }], '老顺序照旧读出来');
  assert.deepEqual(loaded.hidden, []);
});

test('hidden 字段坏掉时退回空数组，不抛错', () => {
  const { module, dom } = loadClient();
  for (const bad of ['不是数组', 42, null, { name: '模型' }, [{ name: 1 }, null]]) {
    dom.store.set(STORE_KEY, JSON.stringify({ enabled: true, order: [], hidden: bad }));
    assert.deepEqual(module.loadConfig().hidden, [], `hidden=${JSON.stringify(bad)} 应退回空数组`);
  }
  dom.store.set(STORE_KEY, JSON.stringify({ enabled: true, order: [], hidden: [{ name: 'Web 插件', index: 2 }] }));
  assert.deepEqual(module.loadConfig().hidden, [{ name: 'Web 插件', index: 2 }]);
});

test('applyToNav 把隐藏项设成 display:none，但不删 DOM 节点、不动顺序', () => {
  const { module, dom } = loadClient(SAMPLE);
  module.saveConfig({ enabled: true, order: [], hidden: [{ name: '内置插件', index: 0 }] });
  module.applyToNav(dom.document);

  const cells = dom.document.body.children[0].children;
  const index = SAMPLE.findIndex(([, label]) => label === '内置插件');
  assert.equal(cells[index].style.display, 'none', '被隐藏的那项要 display:none');
  assert.equal(cells[index].attributes['data-nav-hidden'], '1');
  assert.equal(cells.filter((cell) => cell.style.display === 'none').length, 1, '只藏这一项');
  assert.deepEqual(dom.labels(), SAMPLE.map(([, label]) => label), 'DOM 顺序与节点都不动');
});

test('取消隐藏后 display 与标记都清干净', () => {
  const { module, dom } = loadClient(SAMPLE);
  module.saveConfig({ enabled: true, order: [], hidden: [{ name: '内置插件', index: 0 }] });
  module.applyToNav(dom.document);
  module.saveConfig({ enabled: true, order: [], hidden: [] });
  module.applyToNav(dom.document);

  const cells = dom.document.body.children[0].children;
  assert.ok(cells.every((cell) => cell.style.display === ''), '不该留下 display 残留');
  assert.ok(cells.every((cell) => !('data-nav-hidden' in cell.attributes)), '不该留下隐藏标记');
});

test('停用开关后隐藏也一并清除', () => {
  const { module, dom } = loadClient(SAMPLE);
  module.saveConfig({ enabled: true, order: [], hidden: [{ name: '账户', index: 0 }] });
  module.applyToNav(dom.document);
  module.saveConfig({ enabled: false, order: [], hidden: [{ name: '账户', index: 0 }] });
  module.applyToNav(dom.document);

  const cells = dom.document.body.children[0].children;
  assert.ok(cells.every((cell) => cell.style.display === ''), '停用后藏起来的项要重新出现');
  assert.ok(cells.every((cell) => cell.style.order === ''), '停用后顺序也回原样');
});

test('隐藏配置里的陈旧项不影响其它项', () => {
  const { module, dom } = loadClient(SAMPLE);
  module.saveConfig({
    enabled: true,
    order: [],
    hidden: [{ name: '早就删掉的插件', index: 0 }, { name: '账户', index: 0 }],
  });
  module.applyToNav(dom.document);

  const cells = dom.document.body.children[0].children;
  assert.equal(cells.filter((cell) => cell.style.display === 'none').length, 1, '只藏真实存在的那一项');
});

test('隐藏同名项时按组内序号区分', () => {
  const { module, dom } = loadClient([['p1', '插件'], ['p2', '插件'], ['models', '模型']]);
  module.saveConfig({ enabled: true, order: [], hidden: [{ name: '插件', index: 1 }] });
  module.applyToNav(dom.document);

  const cells = dom.document.body.children[0].children;
  assert.equal(cells[0].style.display, '', '第一个「插件」不受影响');
  assert.equal(cells[1].style.display, 'none', '被藏的是第二个「插件」');
});

test('面板自己不可隐藏：配置里写了也不生效（否则再也打不开这一页）', () => {
  const { module, dom } = loadClient([...SAMPLE, ['nav-order', '设置导航顺序']]);
  module.saveConfig({ enabled: true, order: [], hidden: [{ name: '设置导航顺序', index: 0 }] });
  module.applyToNav(dom.document);

  const cells = dom.document.body.children[0].children;
  assert.equal(cells[cells.length - 1].style.display, '', '本页入口必须始终可见');
});

test('保存后配置能原样读写 hidden 字段', () => {
  const { module, dom } = loadClient();
  const saved = {
    enabled: true,
    order: [{ name: '模型', index: 0 }],
    hidden: [{ name: 'Web 插件', index: 0 }],
  };
  module.saveConfig(saved);
  assert.equal(dom.store.get(STORE_KEY), JSON.stringify(saved));
  assert.deepEqual(module.loadConfig(), saved);
});

test('设置页：点「隐藏」先标未保存，保存后配置与导航一起变', async () => {
  const { module, react, dom } = loadClient(SAMPLE);
  react.render(module.SettingsNavPanel);
  await tick();

  const rows = collectByClass(react.render(module.SettingsNavPanel), 'sno-row');
  const target = rows.find((row) => renderText(row).includes('内置插件'));
  assert.ok(target, '应能定位到「内置插件」那一行');
  const hideBtn = collectByClass(target, 'sno-hide')[0];
  assert.ok(hideBtn, '每行应有「隐藏」按钮');
  hideBtn.props.onClick();
  await tick();
  assert.match(renderText(react.render(module.SettingsNavPanel)), /未保存/, '隐藏之后应提示还没保存');

  findByClass(react.render(module.SettingsNavPanel), 'sno-save').props.onClick();
  await tick();
  assert.deepEqual(module.loadConfig().hidden, [{ name: '内置插件', index: 0 }]);
  module.applyToNav(dom.document);
  const cells = dom.document.body.children[0].children;
  assert.equal(cells[SAMPLE.findIndex(([, label]) => label === '内置插件')].style.display, 'none');
});

test('设置页：已经隐藏的行按钮变成「显示」，点它即可恢复', async () => {
  const { module, react } = loadClient(SAMPLE);
  module.saveConfig({ enabled: true, order: [], hidden: [{ name: '账户', index: 0 }] });
  react.render(module.SettingsNavPanel);
  await tick();

  const rows = collectByClass(react.render(module.SettingsNavPanel), 'sno-row');
  const target = rows.find((row) => renderText(row).includes('账户'));
  assert.ok(target, '应能定位到被隐藏的「账户」那一行');
  const showBtn = collectByClass(target, 'sno-hide')[0];
  assert.match(String(showBtn.props.children), /显示/, '已隐藏的行按钮文字应是「显示」');
  showBtn.props.onClick();
  await tick();

  findByClass(react.render(module.SettingsNavPanel), 'sno-save').props.onClick();
  await tick();
  assert.deepEqual(module.loadConfig().hidden, [], '保存后不再隐藏任何项');
});

test('设置页：本页自己那一行没有「隐藏」按钮', async () => {
  const { module, react } = loadClient([...SAMPLE, ['nav-order', '设置导航顺序']]);
  react.render(module.SettingsNavPanel);
  await tick();

  const rows = collectByClass(react.render(module.SettingsNavPanel), 'sno-row');
  const selfRow = rows.find((row) => renderText(row).includes('设置导航顺序'));
  assert.ok(selfRow, '应能找到本页自己那一行');
  assert.equal(collectByClass(selfRow, 'sno-hide').length, 0, '本页不能隐藏自己');
  assert.equal(collectByClass(selfRow, 'sno-up').length, 1, '但排序按钮还在');
});

test('「恢复默认」把顺序与隐藏一起清掉', async () => {
  const { module, react } = loadClient(SAMPLE);
  module.saveConfig({
    enabled: true,
    order: [{ name: '账户', index: 0 }],
    hidden: [{ name: '模型', index: 0 }],
  });
  react.render(module.SettingsNavPanel);
  await tick();

  findByClass(react.render(module.SettingsNavPanel), 'sno-reset').props.onClick();
  await tick();
  assert.deepEqual(module.loadConfig(), { enabled: true, order: [], hidden: [] });
});

// ------------------------------------------------- 宿主偏好文件通道（跨机复原）

/**
 * 假响应：实现里只用到 ok 与 json()。
 * @param payload - json() 回给调用方的对象
 * @param ok - HTTP 是否成功
 */
function jsonResponse(payload, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => payload };
}

/**
 * 假宿主：GET /state 回当前快照，POST /state 收下请求体当新快照，并把每次请求记进 calls。
 * @param initial - 宿主当前持有的快照；null 表示还没有这个文件
 */
function makeFakeHost(initial = null) {
  const host = {
    state: initial,
    calls: [],
    fail: null,
    fetch(url, options) {
      const method = options?.method ?? 'GET';
      host.calls.push({ url, method, body: options?.body });
      if (host.fail) return Promise.resolve(host.fail);
      if (method === 'POST') {
        host.state = JSON.parse(options.body);
        return Promise.resolve(jsonResponse({ ok: true }));
      }
      return Promise.resolve(jsonResponse({ ok: true, state: host.state, exists: host.state !== null }));
    },
  };
  return host;
}

/** 装载客户端并给假 window 接上假宿主（放在 apply 之前，启动对账才会发请求）。 */
function loadClientWithHost(initialEntries, hostState) {
  const loaded = loadClient(initialEntries);
  const host = makeFakeHost(hostState);
  loaded.dom.window.fetch = host.fetch;
  return { ...loaded, host };
}

/** 插件上下文：effect 立即执行，槽位注册立即生效（与既有用例同一套假 ctx）。 */
function pluginContext() {
  const registered = [];
  return {
    registered,
    ctx: {
      effect: (fn) => fn(),
      slots: {
        inject: (slot, register) => register(),
        register: (definition, component) => registered.push({ definition, component }),
      },
    },
  };
}

/** 宿主里的快照原文（与客户端写 localStorage 的规范化口径一致）。 */
const remoteRaw = (config) => JSON.stringify(config);

test('启动对账：本地没有配置时采用宿主快照，顺序立刻恢复（换机复原路径）', async () => {
  const saved = { enabled: true, order: [{ name: '账户', index: 0 }, { name: '通用设置', index: 0 }], hidden: [] };
  const { module, dom, host } = loadClientWithHost(SAMPLE, saved);
  assert.equal(dom.store.get(module.STORE_KEY), undefined, '前置条件：本地一条偏好都没有');

  const { ctx } = pluginContext();
  module.apply(ctx);
  await tick();

  assert.deepEqual(module.loadConfig(), saved, '宿主的快照应被回填进 localStorage');
  assert.deepEqual(dom.labelsInVisualOrder().slice(0, 2), ['账户', '通用设置'], '导航应立刻按恢复的顺序排列');
  assert.equal(module.readSynced(), remoteRaw(saved), '回填后应记下指纹');
  assert.equal(host.calls.filter((c) => c.method === 'POST').length, 0, '本地本来没东西，不该有写请求');
});

test('启动对账：宿主没有快照时把本地偏好推上去（升级前就存在的顺序第一次进仓库）', async () => {
  const local = remoteRaw({ enabled: true, order: [{ name: '账户', index: 0 }], hidden: [] });
  const { module, dom, host } = loadClientWithHost(SAMPLE, null);
  dom.store.set(module.STORE_KEY, local);

  module.apply(pluginContext().ctx);
  await tick();

  const posts = host.calls.filter((c) => c.method === 'POST');
  assert.equal(posts.length, 1, '应正好推一次');
  assert.equal(posts[0].body, local, '推上去的应是本地原文');
  assert.deepEqual(host.state, JSON.parse(local), '宿主应因此持有该快照');
  assert.equal(dom.store.get(module.STORE_KEY), local, '本地不该被改动');
  assert.equal(module.readSynced(), local, '推送成功应记指纹');
});

test('启动对账：本地没动过而宿主更新时采用宿主（另一台机器改过）', async () => {
  const older = remoteRaw({ enabled: true, order: [{ name: '账户', index: 0 }], hidden: [] });
  const newer = { enabled: true, order: [{ name: '内置插件', index: 0 }], hidden: [] };
  const { module, dom, host } = loadClientWithHost(SAMPLE, newer);
  dom.store.set(module.STORE_KEY, older);
  dom.store.set(module.SYNCED_KEY, older); // 与指纹逐字相同 = 本地没动过

  module.apply(pluginContext().ctx);
  await tick();

  assert.deepEqual(module.loadConfig(), newer, '应采用宿主里更新的那份');
  assert.equal(dom.labelsInVisualOrder()[0], '内置插件');
  assert.equal(host.calls.filter((c) => c.method === 'POST').length, 0, '采用宿主即可，不必回写');
});

test('启动对账：本地有未同步改动时保留本地并推给宿主（绝不静默丢弃）', async () => {
  const synced = remoteRaw({ enabled: true, order: [{ name: '账户', index: 0 }], hidden: [] });
  const local = remoteRaw({ enabled: true, order: [{ name: '模型', index: 0 }], hidden: [] });
  const { module, dom, host } = loadClientWithHost(SAMPLE, { enabled: true, order: [{ name: '内置插件', index: 0 }], hidden: [] });
  dom.store.set(module.STORE_KEY, local);
  dom.store.set(module.SYNCED_KEY, synced); // 本地改过、还没推上去

  module.apply(pluginContext().ctx);
  await tick();

  assert.equal(dom.store.get(module.STORE_KEY), local, '本地改动不该被宿主覆盖');
  assert.deepEqual(host.state, JSON.parse(local), '应把本地改动推上去让宿主对齐');
  assert.equal(module.readSynced(), local);
});

test('推送失败不记指纹，且本地偏好不受影响（下次启动会重推）', async () => {
  const local = remoteRaw({ enabled: true, order: [{ name: '账户', index: 0 }], hidden: [] });

  // 宿主回 500
  {
    const { module, dom, host } = loadClientWithHost(SAMPLE, null);
    host.fail = jsonResponse({ ok: false, error: '写盘失败' }, false);
    dom.store.set(module.STORE_KEY, local);
    assert.equal(await module.pushState(), false);
    assert.equal(module.readSynced(), null, '失败就不该记指纹');
    assert.equal(dom.store.get(module.STORE_KEY), local);
  }

  // fetch 直接抛（离线 / 被拦截）
  {
    const { module, dom } = loadClientWithHost(SAMPLE, null);
    dom.window.fetch = () => {
      throw new Error('offline');
    };
    dom.store.set(module.STORE_KEY, local);
    assert.equal(await module.pushState(), false);
    assert.equal(module.readSynced(), null);
  }

  // fetch 返回一个被拒的 promise
  {
    const { module, dom } = loadClientWithHost(SAMPLE, null);
    dom.window.fetch = () => Promise.reject(new Error('offline'));
    dom.store.set(module.STORE_KEY, local);
    assert.equal(await module.pushState(), false);
    assert.equal(module.readSynced(), null);
  }

  // 失败之后宿主恢复：同一份本地偏好会被重推
  {
    const { module, dom, host } = loadClientWithHost(SAMPLE, null);
    host.fail = jsonResponse({ ok: false }, false);
    dom.store.set(module.STORE_KEY, local);
    await module.reconcile(dom.document);
    assert.equal(host.state, null, '第一次推送失败，宿主仍没有快照');
    host.fail = null;
    await module.reconcile(dom.document);
    assert.deepEqual(host.state, JSON.parse(local), '宿主恢复后应重推成功');
  }
});

test('宿主读不通（离线 / 非 2xx / body 不是 JSON）时，本地偏好完全不动', async () => {
  const local = remoteRaw({ enabled: true, order: [{ name: '账户', index: 0 }], hidden: [] });
  const unreachable = [
    ['fetch 抛异常', () => {
      throw new Error('offline');
    }],
    ['fetch 被拒', () => Promise.reject(new Error('offline'))],
    ['非 2xx', () => Promise.resolve(jsonResponse({ ok: false }, false))],
    ['body 不是 JSON', () => Promise.resolve({ ok: true, json: async () => { throw new Error('bad json'); } })],
    ['ok 不是 true', () => Promise.resolve(jsonResponse({ state: { order: [{ name: '账户' }] } }))],
  ];

  for (const [label, fetchImpl] of unreachable) {
    const { module, dom, host } = loadClientWithHost(SAMPLE, null);
    dom.store.set(module.STORE_KEY, local);
    dom.window.fetch = fetchImpl;

    module.apply(pluginContext().ctx);
    await tick();

    assert.equal(dom.store.get(module.STORE_KEY), local, `${label}：本地偏好不该被动`);
    assert.equal(module.readSynced(), null, `${label}：读不通就不该假装对齐过`);
    assert.ok(!host.calls.some((c) => c.method === 'POST'), `${label}：读不通时不该回写`);
  }
});

test('宿主回的 state 形状不对时当作没有快照，用本地偏好自愈并推上去', async () => {
  const local = remoteRaw({ enabled: true, order: [{ name: '账户', index: 0 }], hidden: [] });

  for (const broken of ['nope', [1, 2], 12, true]) {
    const { module, dom, host } = loadClientWithHost(SAMPLE, null);
    dom.store.set(module.STORE_KEY, local);
    // 只把 GET 的回答换掉 —— POST 照真宿主的样回 { ok: true }。
    host.fetch = (url, options) => {
      const method = options?.method ?? 'GET';
      host.calls.push({ url, method, body: options?.body });
      if (method === 'POST') {
        host.state = JSON.parse(options.body);
        return Promise.resolve(jsonResponse({ ok: true }));
      }
      return Promise.resolve(jsonResponse({ ok: true, state: broken, exists: true }));
    };

    module.apply(pluginContext().ctx);
    await tick();

    const label = `state=${JSON.stringify(broken)}`;
    assert.equal(dom.store.get(module.STORE_KEY), local, `${label}：坏快照不该覆盖本地`);
    const posts = host.calls.filter((c) => c.method === 'POST');
    assert.equal(posts.length, 1, `${label}：应把本地偏好推上去自愈`);
    assert.equal(posts[0].body, local);
    assert.deepEqual(host.state, JSON.parse(local), `${label}：宿主应被本地偏好覆盖`);
    assert.equal(module.readSynced(), local, `${label}：自愈成功即为对齐`);
  }
});

test('window 没有 fetch（非浏览器环境）时一次请求都不发，本地照旧', async () => {
  const local = remoteRaw({ enabled: true, order: [{ name: '账户', index: 0 }], hidden: [] });
  const { module, dom } = loadClient(SAMPLE);
  dom.window.fetch = undefined;
  dom.store.set(module.STORE_KEY, local);

  module.apply(pluginContext().ctx);
  await tick();
  assert.equal(await module.pushState(), false);
  assert.equal(dom.store.get(module.STORE_KEY), local);
  assert.equal(module.readSynced(), null);
  assert.equal(module.reconcile(dom.document) instanceof Promise, true, 'reconcile 始终返回 promise，调用方不必判空');
});

test('宿主文件坏掉（state 读不出来）时，本地偏好会推上去覆盖它', async () => {
  const local = remoteRaw({ enabled: true, order: [{ name: '账户', index: 0 }], hidden: [] });
  const { module, dom, host } = loadClientWithHost(SAMPLE, null);
  dom.store.set(module.STORE_KEY, local);
  // 宿主半边对坏文件的答复：ok=true、state=null、exists=true、带 error。
  host.fetch = (url, options) => {
    const method = options?.method ?? 'GET';
    host.calls.push({ url, method, body: options?.body });
    if (method === 'POST') {
      host.state = JSON.parse(options.body);
      return Promise.resolve(jsonResponse({ ok: true }));
    }
    return Promise.resolve(jsonResponse({ ok: true, state: null, exists: true, error: '文件内容不是一份可用的偏好' }));
  };

  module.apply(pluginContext().ctx);
  await tick();

  assert.deepEqual(host.state, JSON.parse(local), '坏文件应被本地偏好覆盖掉（自愈）');
  assert.deepEqual(module.loadConfig(), JSON.parse(local), '本地偏好原样保留');
});

test('设置页保存后把快照推给宿主（面板保存是日常唯一的写入路径）', async () => {
  const { module, react, dom, host } = loadClientWithHost(SAMPLE, null);
  react.render(module.SettingsNavPanel);
  await tick();

  // 把第二行「模型」上移，再点保存。
  collectByClass(react.render(module.SettingsNavPanel), 'sno-up')[1].props.onClick();
  await tick();
  findByClass(react.render(module.SettingsNavPanel), 'sno-save').props.onClick();
  await tick();

  const posts = host.calls.filter((c) => c.method === 'POST');
  assert.equal(posts.length, 1, '保存应推一次快照');
  assert.equal(posts[0].body, dom.store.get(module.STORE_KEY), '推上去的就是刚落盘的那份配置');
  assert.deepEqual(host.state, module.loadConfig());
  assert.deepEqual(host.state.order.slice(0, 2).map((row) => row.name), ['模型', '通用设置']);
});

test('「恢复默认」也推给宿主（否则另一台机器会一直保留旧顺序）', async () => {
  const { module, react, host } = loadClientWithHost(SAMPLE, { enabled: true, order: [{ name: '账户', index: 0 }], hidden: [] });
  module.saveConfig({ enabled: true, order: [{ name: '账户', index: 0 }], hidden: [] });
  react.render(module.SettingsNavPanel);
  await tick();

  findByClass(react.render(module.SettingsNavPanel), 'sno-reset').props.onClick();
  await tick();

  const posts = host.calls.filter((c) => c.method === 'POST');
  assert.equal(posts.length, 1);
  assert.deepEqual(host.state, { enabled: true, order: [], hidden: [] }, '宿主应收到「恢复默认」后的空配置');
});

test('normalizeRemote：形状不对一律当作没有快照', () => {
  const { module } = loadClient();
  assert.equal(module.normalizeRemote(null), null);
  assert.equal(module.normalizeRemote(undefined), null);
  assert.equal(module.normalizeRemote('x'), null);
  assert.equal(module.normalizeRemote([1, 2]), null);
  assert.equal(module.normalizeRemote(12), null);

  const bad = module.normalizeRemote({ enabled: false, order: [{ name: '模型', index: 1 }, { name: 7 }, null], hidden: 'nope' });
  assert.equal(bad.raw, remoteRaw({ enabled: false, order: [{ name: '模型', index: 1 }], hidden: [] }), '坏行丢弃、不是数组就当空');
  assert.deepEqual(bad.config, { enabled: false, order: [{ name: '模型', index: 1 }], hidden: [] });
  assert.equal(module.normalizeRemote({ enabled: 'yes' }).config.enabled, true, '只有显式 false 才算停用');
});

// ------------------------------------------- 保存后的宿主文件回执（不许假装成功）

test('保存后显示「已同步」回执（面板把宿主文件的结果如实说出来）', async () => {
  const { module, react, dom, host } = loadClientWithHost(SAMPLE, null);
  react.render(module.SettingsNavPanel);
  await tick();
  assert.ok(!renderText(react.render(module.SettingsNavPanel)).includes(module.SYNC_PENDING.slice(0, 5)), '没保存过就不该有回执');

  collectByClass(react.render(module.SettingsNavPanel), 'sno-up')[1].props.onClick();
  await tick();
  findByClass(react.render(module.SettingsNavPanel), 'sno-save').props.onClick();
  await tick();

  const text = renderText(react.render(module.SettingsNavPanel));
  assert.ok(text.includes(module.SYNC_DONE), `应显示已同步：${text.slice(-120)}`);
  assert.ok(!text.includes(module.SYNC_FAILED));
  assert.deepEqual(host.state, module.loadConfig());
});

test('宿主写不进去时如实回报「未同步」，绝不假装成功', async () => {
  const { module, react, dom } = loadClientWithHost(SAMPLE, null);
  dom.window.fetch = () => Promise.reject(new Error('offline')); // 宿主通道不可用
  react.render(module.SettingsNavPanel);
  await tick();

  collectByClass(react.render(module.SettingsNavPanel), 'sno-up')[1].props.onClick();
  await tick();
  findByClass(react.render(module.SettingsNavPanel), 'sno-save').props.onClick();
  await tick();

  const text = renderText(react.render(module.SettingsNavPanel));
  assert.ok(text.includes(module.SYNC_FAILED), `应如实回报未同步：${text.slice(-160)}`);
  assert.ok(!text.includes(module.SYNC_DONE), '失败时不许显示已同步');
  assert.ok(module.loadConfig().order.length > 0, '本地偏好仍然保存成功（只是没进宿主文件）');
  assert.equal(module.readSynced(), null, '失败不记指纹，下次启动会重推');
});

test('「恢复默认」的回执同样如实：宿主文件里也变成空配置', async () => {
  const { module, react, host } = loadClientWithHost(SAMPLE, { enabled: true, order: [{ name: '账户', index: 0 }], hidden: [] });
  react.render(module.SettingsNavPanel);
  await tick();
  findByClass(react.render(module.SettingsNavPanel), 'sno-reset').props.onClick();
  await tick();

  assert.deepEqual(host.state, { enabled: true, order: [], hidden: [] });
  assert.ok(renderText(react.render(module.SettingsNavPanel)).includes(module.SYNC_DONE));
});

test('有未保存的排序时点「启用」复选框：不能谎报已保存（草稿还没进配置）', async () => {
  const { module, react, dom } = loadClientWithHost(SAMPLE, null);
  react.render(module.SettingsNavPanel);
  await tick();

  // 先把「模型」上移（只改草稿，没点保存）
  collectByClass(react.render(module.SettingsNavPanel), 'sno-up')[1].props.onClick();
  await tick();
  assert.ok(renderText(react.render(module.SettingsNavPanel)).includes('未保存'), '前置条件：草稿未保存');

  // 再点「启用」复选框：它提交的是「已保存」的顺序，草稿并没有跟着进配置
  findByClass(react.render(module.SettingsNavPanel), 'sno-toggle').props.onChange({ target: { checked: true } });
  await tick();

  const text = renderText(react.render(module.SettingsNavPanel));
  assert.ok(text.includes('未保存'), `草稿还没进配置，必须继续显示未保存：${text.slice(-160)}`);
  assert.ok(!text.includes('当前顺序与已保存的一致'), '不许谎报已保存');
  assert.ok(renderText(react.render(module.SettingsNavPanel)).includes('模型'), '草稿行还在，没被丢掉');

  // 点保存之后草稿才真的进配置，此时才该显示「一致」
  findByClass(react.render(module.SettingsNavPanel), 'sno-save').props.onClick();
  await tick();
  const after = renderText(react.render(module.SettingsNavPanel));
  assert.ok(after.includes('当前顺序与已保存的一致'), `保存后才显示一致：${after.slice(-160)}`);
  assert.deepEqual(module.loadConfig().order.slice(0, 2).map((row) => row.name), ['模型', '通用设置']);
  assert.deepEqual(dom.labelsInVisualOrder().slice(0, 2), ['模型', '通用设置']);
});