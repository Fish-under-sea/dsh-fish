/**
 * lib/core.js 的单元测试（纯逻辑，零依赖）。
 *
 * 运行：node --test test/
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULTS,
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
    { type: 'finish', reason: 'stop' },
  ];
  assert.deepEqual(assembleStreamText(chunks), { text: '会话标题', finish: 'stop', toolCalls: false });

  // 只有 block-end 没有 delta 的适配器也能拿到文本
  assert.equal(
    assembleStreamText([{ type: 'block-end', index: 0, block: { type: 'text', text: '兜底' } }, { type: 'finish', reason: 'stop' }]).text,
    '兜底',
  );

  const tool = assembleStreamText([{ type: 'block-start', index: 0, blockType: 'tool-call' }, { type: 'block-end', index: 0, block: { type: 'tool-call', name: 'x' } }, { type: 'finish', reason: 'tool-calls' }]);
  assert.equal(tool.toolCalls, true);
  assert.equal(tool.finish, 'tool-calls');

  // 推理增量不算标题文本
  assert.equal(assembleStreamText([{ type: 'reasoning-delta', index: 0, text: '想想' }, { type: 'text-delta', index: 1, text: '真标题' }]).text, '真标题');
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