// dsh-git-sync Web 半边的执行测试。
// 用假的 window.__ModuleLoader__ 加载真实 client.js，再用最小 react shim
// 真正调用一次 Panel()，检查渲染出的元素树。这样不需要 DOM / 真 react，
// 但验证的是真实代码路径（而不是只做语法检查）。
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const CLIENT = fileURLToPath(new URL('../lib/client.js', import.meta.url));

let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  [ok]   ${label}`); }
  else { fail++; console.log(`  [FAIL] ${label} ${extra}`); }
};

console.log('=== 1. 通过 __ModuleLoader__ 加载 bundle ===');
let spec = null;
const sandbox = {
  window: { __ModuleLoader__: { load: (s) => { spec = s; } } },
  console,
};
vm.createContext(sandbox);
vm.runInContext(readFileSync(CLIENT, 'utf8'), sandbox, { filename: 'client.js' });
check('调用了 __ModuleLoader__.load', spec !== null);
// 断言读 package.json 的 name，而不是硬编码字符串 —— 包名带 scope 之后
// 注册名也必须带 scope，硬编码会让「改名漏改」这类问题逃过测试。
// loader 是拿行里解析出的包名去 factories 认领 factory 的，对不上就在
// 浏览器侧报 `loaded without registering`，整条插件加载失败。
const pkgName = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
).name;
check(`id 严格等于包名（${pkgName}）`, spec?.id === pkgName, `id=${spec?.id} name=${pkgName}`);
check('factory 是函数', typeof spec?.factory === 'function');

console.log('\n=== 2. factory 求值（只允许 require("react")）===');
const reactShim = {
  createElement: (type, props, ...children) => ({
    type,
    props: props || {},
    children: children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false),
  }),
  useState: (init) => [init, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
};
const required = [];
const fakeRequire = (id) => {
  required.push(id);
  if (id === 'react') return reactShim;
  throw new Error(`意外的 require: ${id}`);
};
let mod;
try {
  mod = spec.factory(fakeRequire);
  check('factory 未抛错', true);
} catch (e) {
  check('factory 未抛错', false, String(e.message));
}
check('导出 inject = ["slots"]', JSON.stringify(mod?.inject) === '["slots"]', JSON.stringify(mod?.inject));
check('导出 apply 函数', typeof mod?.apply === 'function');
check('只 require 了 react', required.length === 1 && required[0] === 'react', JSON.stringify(required));

console.log('\n=== 3. apply() 注册到 settings.section ===');
let injectedName = null, registered = null;
const ctx = {
  effect: (fn) => fn(),
  slots: {
    inject: (name, cb) => { injectedName = name; cb(); },
    register: (def, Comp) => { registered = { def, Comp }; },
  },
};
mod.apply(ctx);
check('inject 目标为 settings.section', injectedName === 'settings.section', injectedName);
check('注册了组件', typeof registered?.Comp === 'function');
check('页 id 正确', registered?.def?.id === 'dsh-git-sync', registered?.def?.id);
check('order 已设置', typeof registered?.def?.order === 'number');
check('label() 返回「Git 同步」', registered?.def?.label?.() === 'Git 同步', registered?.def?.label?.());

console.log('\n=== 4. 首次渲染 Panel() ===');
let tree;
try {
  tree = registered.Comp();
  check('Panel 渲染未抛错', true);
} catch (e) {
  check('Panel 渲染未抛错', false, `${e.message}\n${e.stack}`);
}

// 遍历元素树收集文本 / 按钮标签 / placeholder
const texts = [], buttons = [], placeholders = [];
(function walk(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return;
  if (typeof node === 'string' || typeof node === 'number') { texts.push(String(node)); return; }
  if (Array.isArray(node)) { node.forEach(walk); return; }
  if (typeof node.type === 'string') {
    if (node.type === 'button') buttons.push(node.children.filter((c) => typeof c === 'string').join(''));
    if (node.type === 'input' && node.props?.placeholder) placeholders.push(node.props.placeholder);
  }
  (node.children || []).forEach(walk);
})(tree);

const all = texts.join('\n');

console.log('\n=== 5. 内容断言 ===');
const EXACT = '新机器请不必动api设置：DEEPSEEK_API_KEY、BAILIAN_API_KEY、BAILIAN_HE_API_KEY。';
check('包含指定的原句（逐字符一致）', all.includes(EXACT));
check('标题为「Git 同步」', texts.includes('Git 同步'));
for (const label of ['一键同步', '仅采集并提交', '从仓库还原到本机', '密钥体检', '刷新']) {
  check(`按钮存在：${label}`, buttons.includes(label), `实际=${JSON.stringify(buttons)}`);
}
check('已移除冗余的「推送到远端」按钮', !buttons.includes('推送到远端'), `实际=${JSON.stringify(buttons)}`);
check('说明了一键同步会补推未推送的提交', all.includes('补推'));
for (const label of ['含会话记录', '含附件']) {
  check(`开关存在：${label}`, all.includes(label));
}
check('声明了 Skill 会被同步', all.includes('Skill（skills/）'));
check('说明了「仅采集并提交」只提交不推送', all.includes('只提交、不推送'));
check('声明了单文件失败不中断', all.includes('不会中断整次同步'));
check('仓库目录输入框存在', placeholders.some((p) => p.includes('同步仓库的本地路径')));
check('声明了密钥永不搬运', all.includes('.credentials.yaml'));
check('加载态文案存在（初始 status=null）', all.includes('正在读取状态'));

console.log('\n=== 6. 注入 status 后的渲染（状态卡只在有状态时才出现）===');
const fakeStatus = {
  repoDir: 'D:\\repo\\sync-kit',
  branch: 'main',
  remote: 'https://github.com/o/r.git',
  files: 46,
  sizeKB: 5744,
  pending: 5,
  pendingDetail: { added: 1, changed: 3, removed: 1 },
  isGitRepo: true,
  dirty: false,
  ahead: 0,
  home: 'C:\\Users\\X\\.dsh',
  lastRun: null,
};
let st = 0;
// 复用同一个 spec，换一个会返回假 status 的 react 再渲染一次。
// Panel 的第一次 useState 就是 status。
const react2 = {
  ...reactShim,
  useState: (init) => {
    st += 1;
    return [st === 1 ? fakeStatus : init, () => {}];
  },
};
const mod2 = spec.factory((id) => {
  if (id === 'react') return react2;
  throw new Error(`意外的 require: ${id}`);
});
let reg2 = null;
mod2.apply({
  effect: (fn) => fn(),
  slots: { inject: (n, cb) => cb(), register: (d, c) => { reg2 = { d, c }; } },
});
let tree2;
try {
  tree2 = reg2.c();
  check('有状态时渲染未抛错', true);
} catch (e) {
  check('有状态时渲染未抛错', false, e.message);
}
const texts2 = [];
(function walk(n) {
  if (n === null || n === undefined || typeof n === 'boolean') return;
  if (typeof n === 'string' || typeof n === 'number') { texts2.push(String(n)); return; }
  if (Array.isArray(n)) { n.forEach(walk); return; }
  (n.children || []).forEach(walk);
})(tree2);
const all2 = texts2.join('\n');

check('出现「仓库内文件」卡', all2.includes('仓库内文件'));
check('不出现误导性的「待同步文件」', !all2.includes('待同步文件'));
check('「仓库内文件」显示 46 个 · 5744 KB', all2.includes('46 个 · 5744 KB'));
check('「待同步」显示真实差异 5 个', all2.includes('5 个文件有差异'));
check('差异明细含新增/变更/仓库多出', all2.includes('新增 1') && all2.includes('变更 3') && all2.includes('仓库多出 1'));

console.log(`\n    ─ 按钮 ── ${buttons.join(' | ')}`);
console.log(`────────────  通过 ${pass} / 失败 ${fail}  ────────────`);
process.exit(fail ? 1 : 0);