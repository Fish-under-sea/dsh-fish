/**
 * @fish-under-sea/dsh-skill-lens-fish 的浏览器半边测试。
 *
 * 两件事：
 *
 *  1. **注册名必须严格等于包名** —— DSH 的 client-modules 拿「行里解析出的包名」
 *     去 factories 里认领 factory，对不上就在浏览器侧抛 `loaded without registering`。
 *     断言读 package.json 的 `name` 而不硬编码，改包名漏改会被直接抓住
 *     （本仓库 README「改包名时要同步的五处」第 3 处）。
 *
 *  2. **依赖图构建**（`src/client/deps.ts`）—— 本 Fork 新增的「引用资源」分类，
 *     以及目录式技能的回归基线。deps.ts 是零导入的纯函数模块，用 tsc 现转译后
 *     直接单测**源码**，不必经过 esbuild，也不需要额外的构建产物。
 *
 * 运行：node test/client.test.mjs
 * （不要用 `node --test test/`：测试运行器会派生子进程并捕获管道输出，在受限沙箱
 *   里会以 EPERM 失败。）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

/** 包清单：注册名必须等于包名，读 name 而不硬编码，改名后测试不会跟着漂移。 */
const PKG = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// ---------------------------------------------------------------------------
// 1) 客户端注册名
// ---------------------------------------------------------------------------

test('client.js 的 __ModuleLoader__ 注册名严格等于 package.json 的 name', () => {
  const code = readFileSync(path.join(ROOT, 'lib', 'client.js'), 'utf8');
  const match = /__ModuleLoader__\.load\(\{\s*id:\s*("(?:[^"\\]|\\.)*")/.exec(code);
  assert.ok(match, 'client.js 应包含 __ModuleLoader__.load({ id }) 注册（先 pnpm build）');
  assert.equal(JSON.parse(match[1]), PKG.name);
});

// ---------------------------------------------------------------------------
// 2) 依赖图构建（直接单测 src/client/deps.ts 源码）
// ---------------------------------------------------------------------------

const SOURCE = readFileSync(path.join(ROOT, 'src', 'client', 'deps.ts'), 'utf8');
const TRANSPILED = ts.transpileModule(SOURCE, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const deps = await import(
  `data:text/javascript;base64,${Buffer.from(TRANSPILED, 'utf8').toString('base64')}`
);
const { buildDependencyGraph, layoutGraph, displayName } = deps;

test('文件名：兼容 Windows 分隔符，保留完整 basename', () => {
  assert.equal(displayName('C:\\skills\\skill-refs\\design-essence\\02-judgments.md'), '02-judgments.md');
  assert.equal(displayName('skill-refs/ai-asset-forge/soloapi-playbook.md'), 'soloapi-playbook.md');
});

test('依赖图：入口与共享资源保留各自打开目标，分类及环境变量不可点', () => {
  const rootOpen = { via: 'external', path: 'C:/skills/ai-asset-forge.md' };
  const graph = buildDependencyGraph({
    rootLabel: 'ai-asset-forge.md', rootOpen, skillFiles: ['ai-asset-forge.md'],
    references: [
      { kind: 'relative-path', target: '../skill-refs/a/details.md', line: 2 },
      { kind: 'relative-path', target: '../skill-refs/b/details.md', line: 3 },
      { kind: 'env-var', target: 'DSH_HOME', line: 4 },
    ],
    externalFiles: ['a', 'b'].map((folder) => ({
      target: `../skill-refs/${folder}/details.md`,
      path: `C:/skill-refs/${folder}/details.md`,
      label: `skill-refs/${folder}/details.md`,
    })),
  });
  assert.deepEqual(graph.nodes.find((n) => n.kind === 'root').open, rootOpen);
  const refs = graph.nodes.filter((n) => n.kind === 'referenced' && !n.isGroup);
  assert.equal(refs.length, 2);
  assert.equal(refs[0].label, 'details.md');
  assert.notEqual(refs[0].id, refs[1].id);
  assert.notEqual(refs[0].open.path, refs[1].open.path);
  assert.ok(graph.nodes.filter((n) => n.isGroup || n.kind === 'env-var').every((n) => n.open === undefined));
});

/** 统计节点种类，便于断言。 */
function countKinds(nodes) {
  const out = {};
  for (const node of nodes) out[node.kind] = (out[node.kind] ?? 0) + 1;
  return out;
}

test('依赖图：技能目录之外的引用进入「引用资源」分类', () => {
  const external = {
    target: '../skill-refs/demo/protocol.md',
    path: 'C:/home/.dsh/skill-refs/demo/protocol.md',
    label: 'skill-refs/demo/protocol.md',
  };

  const graph = buildDependencyGraph({
    references: [
      { kind: 'relative-path', target: '../skill-refs/demo/protocol.md', line: 40 },
      // 这一条 host 没解析成功（未在 externalFiles 里），不应生成节点
      { kind: 'relative-path', target: '../skill-refs/demo/templates.md', line: 44 },
      { kind: 'env-var', target: 'DSH_HOME', line: 12 },
      { kind: 'url', target: 'https://example.com/doc', line: 20 },
    ],
    skillFiles: ['subagent-driven-dev.md'],
    externalFiles: [external],
    rootLabel: 'subagent-driven-dev.md',
  });

  const root = graph.nodes.find((n) => n.kind === 'root');
  assert.equal(root.id, 'subagent-driven-dev.md', '扁平技能用文件名做根节点');

  const group = graph.nodes.find((n) => n.kind === 'referenced' && n.isGroup);
  assert.ok(group, '应生成「引用资源」分组');
  assert.equal(group.label, '引用资源');

  const leaves = graph.nodes.filter((n) => n.kind === 'referenced' && !n.isGroup);
  assert.equal(leaves.length, 1, '只有解析成功的引用才生成叶子');
  assert.equal(leaves[0].label, 'protocol.md', '叶子显示文件名而非路径前缀');
  assert.deepEqual(leaves[0].open, { via: 'external', path: external.path });

  // 根节点连到分组
  assert.ok(graph.edges.some((e) => e.source === root.id && e.target === group.id));

  // 入口文件本身不落入「未引用」
  assert.ok(!graph.nodes.some((n) => n.kind === 'unref' && n.id === 'subagent-driven-dev.md'));

  // 原有分类不受影响
  const kinds = countKinds(graph.nodes);
  assert.equal(kinds['env-var'], 1);
  assert.equal(kinds['external-url'], 2, 'URL 分组 + 1 个 URL 叶子');
});

test('依赖图：目录式技能（SKILL.md）行为保持回归基线', () => {
  const graph = buildDependencyGraph({
    references: [
      { kind: 'relative-path', target: 'references/details.md', line: 10 },
      { kind: 'relative-path', target: 'assets/logo.png', line: 11 },
    ],
    skillFiles: ['SKILL.md', 'references/details.md', 'assets/logo.png', 'orphan.txt'],
    rootLabel: 'SKILL.md',
  });

  assert.equal(graph.nodes.find((n) => n.kind === 'root').id, 'SKILL.md');
  assert.ok(graph.nodes.some((n) => n.kind === 'document' && n.id === 'references/details.md'));
  assert.ok(graph.nodes.some((n) => n.kind === 'asset' && n.id === 'assets/logo.png'));
  assert.ok(graph.nodes.some((n) => n.kind === 'unref' && n.id === 'orphan.txt'));
  assert.ok(!graph.nodes.some((n) => n.kind === 'referenced'), '没有外部引用时不生成引用资源分组');
});

test('依赖图：未给 rootLabel 时退回 SKILL.md', () => {
  const graph = buildDependencyGraph({ references: [], skillFiles: ['SKILL.md'] });
  assert.equal(graph.nodes.find((n) => n.kind === 'root').id, 'SKILL.md');
});

test('布局：以入口节点为根展开，尺寸有效', () => {
  const graph = buildDependencyGraph({
    references: [{ kind: 'relative-path', target: '../skill-refs/demo/protocol.md', line: 1 }],
    skillFiles: ['demo.md'],
    externalFiles: [{ target: '../skill-refs/demo/protocol.md', path: '/x/skill-refs/demo/protocol.md', label: 'skill-refs/demo/protocol.md' }],
    rootLabel: 'demo.md',
  });
  const laid = layoutGraph(graph.nodes, graph.edges, 'demo.md');
  const root = laid.laid.find((n) => n.id === 'demo.md');
  assert.equal(root.x, 0, '根节点在第 0 层');
  assert.ok(laid.width > 0 && laid.height > 0);
});
