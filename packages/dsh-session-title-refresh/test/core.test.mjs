/**
 * lib/core.js 的单元测试（纯逻辑，零依赖）。
 *
 * 运行：node --test test/
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// 用命名空间导入：这样「函数还没实现」表现为**断言失败**，而不是整个文件 import 报错
// ——红灯阶段要能看清每一条用例为什么不过。
import * as coreNs from '../lib/core.js';

import {
  DEFAULTS,
  HARD_BOUNDS,
  PRESETS,
  assembleStreamText,
  cleanTitle,
  clampInt,
  describeSchedule,
  eligibleRoundCount,
  eligibleUserMessageOf,
  fitMessages,
  initNextDue,
  isSubagentSession,
  nextDueAfter,
  normalizeConfig,
  selectTitleMessages,
} from '../lib/core.js';

/** 未实现时以断言失败收场，而不是 TypeError。 */
const normalizeModelCatalog = (...args) => {
  if (typeof coreNs.normalizeModelCatalog !== 'function') {
    assert.fail('core 应导出 normalizeModelCatalog（尚未实现）');
  }
  return coreNs.normalizeModelCatalog(...args);
};

/** 同上：`pickTitleReasoningEffort` 也要能红灯。 */
const pickTitleReasoningEffort = (...args) => {
  if (typeof coreNs.pickTitleReasoningEffort !== 'function') {
    assert.fail('core 应导出 pickTitleReasoningEffort（尚未实现）');
  }
  return coreNs.pickTitleReasoningEffort(...args);
};

/** 造一个合格的人类 user/message 事件。 */
function humanMessage(seq, text) {
  return { seq, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text }] } };
}

/** 造一个插件注入的 user/message 事件（不合格）。 */
function injectedMessage(seq, text) {
  return { seq, type: 'user/message', data: { source: { kind: 'plugin', plugin: 'x' }, content: [{ type: 'text', text }] } };
}

test('clampInt 取整并夹在上下限内，非法值回退', () => {
  assert.equal(clampInt(7, 1, 10, 3), 7);
  assert.equal(clampInt('7', 1, 10, 3), 7);
  assert.equal(clampInt(7.6, 1, 10, 3), 7);
  assert.equal(clampInt(0, 1, 10, 3), 1);
  assert.equal(clampInt(99, 1, 10, 3), 10);
  assert.equal(clampInt(undefined, 1, 10, 3), 3);
  assert.equal(clampInt('abc', 1, 10, 3), 3);
  assert.equal(clampInt(NaN, 1, 10, 3), 3);
});

test('normalizeConfig：后者覆盖前者，并按上下限夹紧', () => {
  const cfg = normalizeConfig({ firstRound: 99, interval: 0 });
  assert.equal(cfg.firstRound, DEFAULTS.maxFirstRound); // 99 → 上限 10
  assert.equal(cfg.interval, 1); // 0 → 下限 1

  // 上下限本身可调：把上限压到 6，则首轮被夹到 6
  const tight = normalizeConfig({ maxFirstRound: 6, firstRound: 99 });
  assert.equal(tight.maxFirstRound, 6);
  assert.equal(tight.firstRound, 6);

  // 未提供的字段取默认
  assert.equal(normalizeConfig({}).windowSize, DEFAULTS.windowSize);
  assert.equal(normalizeConfig({ enabled: false }).enabled, false);
  // 非布尔值不会把开关变成 truthy 垃圾值
  assert.equal(normalizeConfig({ enabled: 'no' }).enabled, true);

  // provider/model 必须成对：只给一个则两个都视为未设置
  const half = normalizeConfig({ provider: 'deepseek-official' });
  assert.equal(half.provider, '');
  assert.equal(half.model, '');
  const pair = normalizeConfig({ provider: 'deepseek-official', model: 'deepseek-flash' });
  assert.equal(pair.provider, 'deepseek-official');
  assert.equal(pair.model, 'deepseek-flash');
});

test('PRESETS 里恰好有一个推荐档位，且默认值就是它', () => {
  const recommended = PRESETS.filter((preset) => preset.recommended);
  assert.equal(recommended.length, 1);
  assert.equal(recommended[0].firstRound, DEFAULTS.firstRound);
  assert.equal(recommended[0].interval, DEFAULTS.interval);
});

test('默认输出预算给思考型标题模型留出余量', () => {
  // 回归（0.3.1）：64 token 的预算会被思考型模型的 reasoning 吃光，流以
  // max-tokens 收尾且正文为空。默认值必须明显高于「只装一条标题」所需的量。
  assert.ok(DEFAULTS.maxOutputTokens >= 256, `默认输出预算应 ≥ 256，实际 ${DEFAULTS.maxOutputTokens}`);
  assert.ok(DEFAULTS.maxOutputTokens <= HARD_BOUNDS.maxOutputTokens[1], '默认值必须落在硬边界内');
  assert.equal(normalizeConfig({}).maxOutputTokens, DEFAULTS.maxOutputTokens);
});

test('eligibleUserMessageOf：只认人类纯文本消息', () => {
  assert.deepEqual(eligibleUserMessageOf(humanMessage(3, '帮我改个插件')), { seq: 3, text: '帮我改个插件' });
  assert.equal(eligibleUserMessageOf(injectedMessage(4, '插件注入')), undefined);
  assert.equal(eligibleUserMessageOf({ seq: 5, type: 'assistant/message', data: { content: [] } }), undefined);
  // 空白消息不合格
  assert.equal(eligibleUserMessageOf(humanMessage(6, '   \n  ')), undefined);
  // 非文本块被忽略，图片消息不合格
  assert.equal(
    eligibleUserMessageOf({ seq: 7, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'image', ref: 'x' }] } }),
    undefined,
  );
  // 多块拼接
  assert.deepEqual(
    eligibleUserMessageOf({ seq: 8, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] } }),
    { seq: 8, text: 'a\nb' },
  );
});

test('eligibleRoundCount：只数人类消息', () => {
  // seq 1 是插件注入、seq 3 是空白消息 —— 两者都不算轮次
  const events = [humanMessage(0, '一'), injectedMessage(1, '注入'), humanMessage(2, '二'), humanMessage(3, '  '), humanMessage(4, '三')];
  assert.equal(eligibleRoundCount(events), 3);
  assert.equal(eligibleRoundCount([]), 0);
});

test('isSubagentSession：子代理会话被识别，普通与分叉会话不算', () => {
  assert.equal(isSubagentSession({ origin: 'subagent' }), true);
  assert.equal(isSubagentSession({ delegationDepth: 1 }), true);
  assert.equal(isSubagentSession({}), false);
  assert.equal(isSubagentSession(undefined), false);
  // 用户手动分叉出来的会话（有父会话但没有 subagent 标记）仍算人类会话
  assert.equal(isSubagentSession({ parentSession: 'session-x' }), false);
});

test('轮次调度：第 first 轮首次触发，之后每 interval 轮一次，且永不回头', () => {
  // 首轮 3 / 间隔 5 → 触发轮次 3, 8, 13, 18…
  assert.equal(initNextDue(0, 3, 5), 3);
  assert.equal(initNextDue(2, 3, 5), 3);
  assert.equal(nextDueAfter(3, 3, 5), 8);
  assert.equal(nextDueAfter(8, 3, 5), 13);
  assert.equal(nextDueAfter(9, 3, 5), 13);

  // 中途接管（插件热加载 / 恢复旧会话）不会立刻补跑，而是对齐到绝对网格
  assert.equal(initNextDue(20, 3, 5), 23);
  assert.equal(initNextDue(30, 3, 5), 33);
  assert.equal(initNextDue(1, 1, 5), 1);
  assert.equal(nextDueAfter(1, 1, 5), 6);
});

test('selectTitleMessages：短会话全取，长会话取首条 + 最近若干条', () => {
  const messages = Array.from({ length: 5 }, (_, i) => ({ seq: i, text: `m${i}` }));
  assert.deepEqual(selectTitleMessages(messages, 8).map((m) => m.seq), [0, 1, 2, 3, 4]);

  const long = Array.from({ length: 20 }, (_, i) => ({ seq: i, text: `m${i}` }));
  // windowSize 8 → 首条 + 最近 7 条
  assert.deepEqual(selectTitleMessages(long, 8).map((m) => m.seq), [0, 13, 14, 15, 16, 17, 18, 19]);
  // 结果按 seq 升序，且不重复
  const picked = selectTitleMessages(long, 3).map((m) => m.seq);
  assert.deepEqual(picked, [0, 18, 19]);
  assert.ok(picked.every((seq, i) => i === 0 || seq > picked[i - 1]));
});

test('fitMessages：内容超限时丢弃中段，永不丢首条与最新一条', () => {
  const messages = [
    { seq: 0, text: 'A'.repeat(500) },
    { seq: 1, text: 'B'.repeat(500) },
    { seq: 2, text: 'C'.repeat(500) },
  ];
  const loose = fitMessages(messages, 100000);
  assert.deepEqual(loose.messages.map((m) => m.seq), [0, 1, 2]);
  assert.ok(loose.bytes <= 100000);

  const tight = fitMessages(messages, 900);
  assert.equal(tight.messages[0].seq, 0);
  assert.equal(tight.messages[tight.messages.length - 1].seq, 2);
  assert.ok(tight.bytes <= 900, `bytes=${tight.bytes}`);
  assert.ok(tight.prompt.includes('JSON'));
});

test('assembleStreamText：按块序号拼文本、识别工具调用与结束原因', () => {
  const chunks = [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text: '会话' },
    { type: 'text-delta', index: 0, text: '标题' },
    { type: 'finish', reason: { kind: 'stop' } },
  ];
  assert.deepEqual(assembleStreamText(chunks), { text: '会话标题', finish: 'stop', failure: undefined, toolCalls: false });

  // 只有 block-end 没有 delta 的适配器也能拿到文本
  assert.equal(
    assembleStreamText([{ type: 'block-end', index: 0, block: { type: 'text', text: '兜底' } }, { type: 'finish', reason: { kind: 'stop' } }]).text,
    '兜底',
  );

  const tool = assembleStreamText([{ type: 'block-start', index: 0, blockType: 'tool-call' }, { type: 'block-end', index: 0, block: { type: 'tool-call', name: 'x' } }, { type: 'finish', reason: { kind: 'tool-calls' } }]);
  assert.equal(tool.toolCalls, true);
  assert.equal(tool.finish, 'tool-calls');

  // 推理增量不算标题文本
  assert.equal(assembleStreamText([{ type: 'reasoning-delta', index: 0, text: '想想' }, { type: 'text-delta', index: 1, text: '真标题' }]).text, '真标题');
});

test('assembleStreamText：DSH 的 FinishReason 是对象，不能把对象当字符串用', () => {
  // 回归：曾经直接取 chunk.reason，报错信息变成「结束原因异常（[object Object]）」，
  // 真实会话第 3 轮自动命名因此全部失败。
  const ok = assembleStreamText([{ type: 'text-delta', index: 0, text: '标题' }, { type: 'finish', reason: { kind: 'stop' } }]);
  assert.equal(ok.finish, 'stop');
  assert.notEqual(String(ok.finish), '[object Object]');

  // error / aborted 要带上具体失败原因，而不是丢掉
  const failed = assembleStreamText([
    { type: 'finish', reason: { kind: 'error', failure: { message: '连接被重置', code: 'ECONNRESET' } } },
  ]);
  assert.equal(failed.finish, 'error');
  assert.equal(failed.failure.message, '连接被重置');
  assert.equal(failed.failure.code, 'ECONNRESET');

  const aborted = assembleStreamText([{ type: 'finish', reason: { kind: 'aborted', failure: { message: '调用方取消' } } }]);
  assert.equal(aborted.finish, 'aborted');
  assert.equal(aborted.failure.message, '调用方取消');

  // 适配器扩展出来的未知结束原因：保留 kind 原文，别丢信息
  const custom = assembleStreamText([{ type: 'finish', reason: { kind: 'content-filter' } }]);
  assert.equal(custom.finish, 'content-filter');

  // 兼容性：字符串形式仍然认（测试替身与老适配器）
  assert.equal(assembleStreamText([{ type: 'finish', reason: 'stop' }]).finish, 'stop');

  // 没有结束块
  assert.equal(assembleStreamText([{ type: 'text-delta', index: 0, text: 'x' }]).finish, undefined);
  // 缺 kind 的畸形 reason 不能变成 "[object Object]"
  assert.equal(assembleStreamText([{ type: 'finish', reason: {} }]).finish, undefined);
});

test('cleanTitle：去掉控制码、引号、Markdown 前缀，只保留第一行', () => {
  assert.equal(cleanTitle('  "会话标题"  '), '会话标题');
  assert.equal(cleanTitle('### DSH 插件开发\n\n细节'), 'DSH 插件开发');
  assert.equal(cleanTitle('标题：\u001b[31m自动刷新\u001b[0m'), '标题：自动刷新');
  assert.equal(cleanTitle('```\n标题\n```'), '标题');
  assert.equal(cleanTitle('「会话标题」'), '会话标题');
  assert.equal(cleanTitle('   \n  '), '');
  assert.equal(cleanTitle('标题\u0007'), '标题');
});

test('describeSchedule：给出人话的触发规则', () => {
  assert.equal(describeSchedule({ firstRound: 3, interval: 5, enabled: true }), '第 3 轮首次总结，之后每 5 轮刷新一次');
  assert.equal(describeSchedule({ firstRound: 1, interval: 1, enabled: true }), '第 1 轮首次总结，之后每轮刷新一次');
  assert.match(describeSchedule({ firstRound: 3, interval: 5, enabled: false }), /已停用/);
});

test('normalizeModelCatalog：保留目录顺序，name 缺失时用 id 兜底', () => {
  const catalog = normalizeModelCatalog([
    {
      provider: { id: 'bailian', name: '百炼 Token Plan（bailian）' },
      models: [
        { id: 'deepseek-v4.1-flash', name: 'deepseek-v4.1-flash' },
        { id: 'glm-5.3', name: 'GLM-5.3', description: '复杂编程' },
      ],
    },
    { provider: { id: 'bailian-he' }, models: [{ id: 'qwen3.7-plus' }] },
  ]);
  assert.deepEqual(catalog.providers.map((p) => p.id), ['bailian', 'bailian-he']);
  assert.equal(catalog.providers[0].name, '百炼 Token Plan（bailian）');
  assert.deepEqual(catalog.providers[0].models, [
    { id: 'deepseek-v4.1-flash', name: 'deepseek-v4.1-flash' },
    { id: 'glm-5.3', name: 'GLM-5.3', description: '复杂编程' },
  ]);
  // provider 没给 name → 用 id
  assert.equal(catalog.providers[1].name, 'bailian-he');
  // model 没给 name → 用 id，且不该凭空造出 description 字段
  assert.deepEqual(catalog.providers[1].models, [{ id: 'qwen3.7-plus', name: 'qwen3.7-plus' }]);
  assert.equal('description' in catalog.providers[1].models[0], false);
});

test('normalizeModelCatalog：丢掉畸形条目，不抛错', () => {
  for (const bad of [null, undefined, 'x', 42, {}, [], [null], [{ provider: null }], [{ provider: { id: '  ' } }]]) {
    const catalog = normalizeModelCatalog(bad);
    assert.deepEqual(catalog.providers, [], `输入 ${JSON.stringify(bad)} 应当产出空目录`);
    assert.deepEqual(catalog.skipped, []);
  }
});

test('normalizeModelCatalog：去重、丢空 id、丢没有模型的 provider', () => {
  const catalog = normalizeModelCatalog([
    { provider: { id: 'a', name: 'A' }, models: [{ id: 'm1' }, { id: 'm1' }, { id: '  ' }, null, { id: 'm2' }] },
    { provider: { id: 'empty', name: '空' }, models: [] },
    { provider: { id: 'dup', name: 'D' }, models: [{ id: ' m3 ' }] },
    { provider: { id: 'a', name: 'A again' }, models: [{ id: 'm4' }] },
  ]);
  assert.deepEqual(catalog.providers.map((p) => p.id), ['a', 'dup', 'a']);
  assert.deepEqual(catalog.providers[0].models.map((m) => m.id), ['m1', 'm2']);
  assert.deepEqual(catalog.providers[1].models.map((m) => m.id), ['m3'], 'model id 要去掉首尾空白');
});

test('normalizeModelCatalog：单个 provider 读不到模型时记入 skipped，其余照常', () => {
  const catalog = normalizeModelCatalog([
    { provider: { id: 'ok', name: 'OK' }, models: [{ id: 'm' }] },
    { provider: { id: 'broken', name: '坏了' }, models: undefined },
  ]);
  assert.deepEqual(catalog.providers.map((p) => p.id), ['ok']);
  assert.deepEqual(catalog.skipped, ['broken']);
});

test('normalizeModelCatalog：只做清洗、不做限制（目录外组合不得被这里判死）', () => {
  // DSH 允许调用未列出的 model id；目录是建议。这个函数不该产出任何「拒绝」信息。
  const catalog = normalizeModelCatalog([{ provider: { id: 'p', name: 'P' }, models: [{ id: 'listed' }] }]);
  assert.deepEqual(Object.keys(catalog).sort(), ['providers', 'skipped']);
  assert.equal(JSON.stringify(catalog).includes('unlisted-model'), false);
});

// ── 标题调用的思考档位选择 ────────────────────────────────────────────────
//
// 回归（0.3.2）：0.3.1 为了修「思考吃光输出预算」而**无条件**传 `reasoningEffort: 'off'`，
// 但 DSH 核心对显式档位是**硬校验**、不做任何降级：模型没声明 `off` 就直接抛
// `UNSUPPORTED_REASONING_EFFORT`，标题功能被整个打死。
// 实测：`hy-f` 的 `buddy/hy3` / `workbuddy/hy3` 只声明了 `low` / `high`（未声明 `off`），
// 于是 2026-10-10 当天从 10:09 起每一次自动命名都失败。
// 正确做法是先读该模型的真实档位，再挑一个它确实支持的。

test('pickTitleReasoningEffort：模型支持 off 时优先关思考', () => {
  const info = { reasoning: { efforts: [{ id: 'off' }, { id: 'high' }], defaultEffort: 'high' } };
  assert.equal(pickTitleReasoningEffort(info), 'off', '支持 off 就该关思考，省预算又不跑偏');
});

test('pickTitleReasoningEffort：不支持 off 时退到最低的思考档（hy3 场景）', () => {
  // 与 hy-f 的 buddy/hy3 / workbuddy/hy3 完全一致：只有 low 与 high。
  const info = { reasoning: { efforts: [{ id: 'low' }, { id: 'high' }] } };
  assert.equal(pickTitleReasoningEffort(info), 'low', '不能传 off，但也不该传 high 浪费预算');
});

test('pickTitleReasoningEffort：按升级顺序挑最低档，而不是按数组顺序', () => {
  const info = { reasoning: { efforts: [{ id: 'high' }, { id: 'medium' }, { id: 'xhigh' }] } };
  assert.equal(pickTitleReasoningEffort(info), 'medium', 'medium 比 high 低，应按升级顺序而不是数组顺序取');
});

test('pickTitleReasoningEffort：模型没有任何思考元数据时不传档位', () => {
  // 核心校验：模型 reasoning 为 undefined 时，传任何显式档位都会抛
  // `does not support reasoning effort`。此时唯一安全的做法是根本不传。
  assert.equal(pickTitleReasoningEffort({}), undefined);
  assert.equal(pickTitleReasoningEffort({ reasoning: undefined }), undefined);
  assert.equal(pickTitleReasoningEffort({ reasoning: { efforts: [] } }), undefined);
});

test('pickTitleReasoningEffort：认不出的输入一律回退成不传档位', () => {
  for (const bad of [null, undefined, 'x', 42, [], { reasoning: null }, { reasoning: { efforts: null } }, { reasoning: { efforts: [null, {}, { id: '' }, { id: '  ' }] } }]) {
    assert.equal(pickTitleReasoningEffort(bad), undefined, `输入 ${JSON.stringify(bad)} 应当回退成不传档位`);
  }
});

test('pickTitleReasoningEffort：只认得出升级顺序里的档位，未知档位不采纳', () => {
  const info = { reasoning: { efforts: [{ id: 'turbo' }, { id: 'high' }] } };
  assert.equal(pickTitleReasoningEffort(info), 'high', '未知档位不是可用的降级目标');
});