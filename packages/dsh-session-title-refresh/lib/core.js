/**
 * dsh-session-title-refresh —— 纯逻辑核心。
 *
 * 这里只有无副作用的判断与格式化：配置夹紧、轮次调度、消息取样、
 * 流装配、标题清洗。宿主半边（lib/index.js）负责把它接到 DSH 的服务上，
 * Web 半边（lib/client.js）负责界面。零依赖：只用 Node 内置的全局对象。
 *
 * @module dsh-session-title-refresh/core
 */

/** 注册到 ctx.sessionTitle 的提供方 id（会记进 session/title 事件的 source.provider）。 */
export const PROVIDER_ID = 'session-title-refresh';

/** 界面里的推荐档位与默认值（默认值就是推荐档位）。 */
export const DEFAULTS = {
  enabled: true,
  firstRound: 3,
  interval: 5,
  maxFirstRound: 10,
  maxInterval: 20,
  windowSize: 8,
  maxInputBytes: 4096,
  maxOutputTokens: 64,
  timeoutMs: 60000,
  targetWords: 5,
  targetCjkCharacters: 10,
  skipSubagentSessions: true,
  keepRefreshingAfterManualRename: false,
  provider: '',
  model: '',
};

/**
 * 档位预设。`recommended` 的那个必须与 {@link DEFAULTS} 一致：
 * 界面首次打开就停在推荐档位上。
 */
export const PRESETS = [
  { id: 'conservative', label: '保守', hint: '省额度，早期标题停留久一些', firstRound: 5, interval: 10, recommended: false },
  { id: 'balanced', label: '均衡', hint: '第 3 轮定方向，之后每 5 轮刷新', firstRound: 3, interval: 5, recommended: true },
  { id: 'aggressive', label: '积极', hint: '更贴当前方向，辅助调用约为均衡的两倍', firstRound: 2, interval: 3, recommended: false },
];

/** 各字段的硬边界（界面的"高级"里可调的是 maxFirstRound / maxInterval 这两个上限）。 */
export const HARD_BOUNDS = {
  firstRound: [1, 50],
  interval: [1, 100],
  maxFirstRound: [1, 50],
  maxInterval: [1, 100],
  windowSize: [2, 40],
  maxInputBytes: [256, 65536],
  maxOutputTokens: [16, 512],
  timeoutMs: [5000, 300000],
  targetWords: [1, 20],
  targetCjkCharacters: [2, 40],
};

/**
 * 取整并夹紧一个整数参数。
 * @param value - 原始值（可能是字符串、小数、NaN）。
 * @param min - 下限。
 * @param max - 上限。
 * @param fallback - 无法解析时的回退值。
 * @returns 落在 [min, max] 内的整数。
 */
export function clampInt(value, min, max, fallback) {
  const low = Number.isFinite(min) ? Math.trunc(min) : Number.NEGATIVE_INFINITY;
  const high = Number.isFinite(max) ? Math.trunc(max) : Number.POSITIVE_INFINITY;
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  const base = Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  const resolved = Number.isFinite(base) ? base : 0;
  const lo = Math.min(low, high);
  const hi = Math.max(low, high);
  return Math.min(Math.max(resolved, lo), hi);
}

/** 只在值是布尔时采纳，否则沿用前一层。 */
function pickBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

/** 只在值是非空字符串时采纳（去掉首尾空白）。 */
function pickString(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

/**
 * 合并多层配置（默认值 ← 插件行 config ← 界面保存的 config.json），
 * 并按上下限夹紧。后面的层覆盖前面的层。
 * @param sources - 从低优先级到高优先级的配置片段。
 * @returns 完整、可直接使用的配置（新对象）。
 */
export function normalizeConfig(...sources) {
  const layers = sources.filter((layer) => layer !== null && typeof layer === 'object');
  const read = (key) => {
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      const value = layers[index][key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
  };

  const merged = {};
  for (const key of Object.keys(DEFAULTS)) {
    const value = read(key);
    if (value !== undefined) merged[key] = value;
  }

  const numbers = {};
  for (const [key, [min, max]] of Object.entries(HARD_BOUNDS)) {
    const fallback = clampInt(DEFAULTS[key], min, max, DEFAULTS[key]);
    numbers[key] = clampInt(merged[key], min, max, fallback);
  }

  // 上限先定，再让当前值落在"用户可调范围"内。
  const maxFirstRound = numbers.maxFirstRound;
  const maxInterval = numbers.maxInterval;
  const firstRound = clampInt(numbers.firstRound, 1, maxFirstRound, DEFAULTS.firstRound);
  const interval = clampInt(numbers.interval, 1, maxInterval, DEFAULTS.interval);

  const rawProvider = pickString(merged.provider, '');
  const rawModel = pickString(merged.model, '');
  const paired = rawProvider !== '' && rawModel !== '';

  return {
    enabled: pickBoolean(merged.enabled, DEFAULTS.enabled),
    firstRound,
    interval,
    maxFirstRound,
    maxInterval,
    windowSize: numbers.windowSize,
    maxInputBytes: numbers.maxInputBytes,
    maxOutputTokens: numbers.maxOutputTokens,
    timeoutMs: numbers.timeoutMs,
    targetWords: numbers.targetWords,
    targetCjkCharacters: numbers.targetCjkCharacters,
    skipSubagentSessions: pickBoolean(merged.skipSubagentSessions, DEFAULTS.skipSubagentSessions),
    keepRefreshingAfterManualRename: pickBoolean(merged.keepRefreshingAfterManualRename, DEFAULTS.keepRefreshingAfterManualRename),
    provider: paired ? rawProvider : '',
    model: paired ? rawModel : '',
  };
}

/** 去掉空白、零宽与不可见控制符后是否还剩可见字符。 */
function hasVisibleText(text) {
  return String(text).replace(/[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, '').length > 0;
}

/**
 * 从一条会话事件里取出"合格的人类文本消息"。
 *
 * 口径与 DSH 标题服务一致：事件必须是 `user/message`、来源必须是人类
 * （`source.kind === 'user'`，插件注入的不算），且去掉空白后还有可见文本。
 * @param event - 任意会话事件。
 * @returns `{ seq, text }`，不合格时为 `undefined`。
 */
export function eligibleUserMessageOf(event) {
  if (event === null || typeof event !== 'object') return undefined;
  if (event.type !== 'user/message') return undefined;
  const data = event.data;
  if (data === null || typeof data !== 'object') return undefined;
  if (data.source === null || typeof data.source !== 'object' || data.source.kind !== 'user') return undefined;
  const blocks = Array.isArray(data.content) ? data.content : [];
  const text = blocks
    .filter((block) => block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n');
  if (!hasVisibleText(text)) return undefined;
  return { seq: event.seq, text };
}

/**
 * 数一个会话日志里有多少条合格人类消息（= 会话进行了多少"轮"）。
 * @param events - 会话事件日志（`session.snapshotEvents()` 或 `session.ownEvents()`）。
 * @returns 轮次数。
 */
export function eligibleRoundCount(events) {
  if (!Array.isArray(events)) return 0;
  let rounds = 0;
  for (const event of events) if (eligibleUserMessageOf(event) !== undefined) rounds += 1;
  return rounds;
}

/**
 * 是否是子代理（subagent）会话——这类会话不该被自动命名。
 * @param header - `session.header`。
 * @returns 子代理会话为 true；用户手动分叉出来的会话不算。
 */
export function isSubagentSession(header) {
  if (header === null || typeof header !== 'object') return false;
  if (header.origin === 'subagent') return true;
  return Number.isFinite(header.delegationDepth) && header.delegationDepth > 0;
}

/** 绝对触发网格上的下一个触发轮次（`rounds` 已经落在网格上时返回自身）。 */
function gridPoint(rounds, firstRound, interval) {
  if (rounds < firstRound) return firstRound;
  return firstRound + Math.ceil((rounds - firstRound) / interval) * interval;
}

/**
 * 首次接管一个会话时的下一个触发轮次。
 *
 * 触发轮次构成绝对网格 first、first+interval、first+2*interval…；
 * 中途接管（插件热加载、恢复旧会话）时对齐网格而不补跑历史，
 * 因此一次重启不会引发一阵辅助调用。
 * @param rounds - 当前已发生的轮次。
 * @param firstRound - 首次总结轮次。
 * @param interval - 刷新间隔。
 * @returns 下一个触发轮次（当前轮次正好是触发点时会等于 `rounds`）。
 */
export function initNextDue(rounds, firstRound, interval) {
  return gridPoint(rounds, firstRound, interval);
}

/**
 * 本轮触发之后的下一个触发轮次（严格大于 `rounds`）。
 * @param rounds - 刚触发的轮次。
 * @param firstRound - 首次总结轮次。
 * @param interval - 刷新间隔。
 * @returns 下一个触发轮次。
 */
export function nextDueAfter(rounds, firstRound, interval) {
  if (rounds < firstRound) return firstRound;
  return firstRound + (Math.floor((rounds - firstRound) / interval) + 1) * interval;
}

/**
 * 挑选送进标题模型的取样消息：短会话全取，长会话取"首条 + 最近若干条"。
 *
 * 首条给出会话的起点诉求，最近的若干条给出它现在的方向——两者合起来
 * 比只看首条（内置提供方的做法）或只看最近一条更贴近"这次对话在干什么"。
 * @param messages - 合格人类消息，按 seq 升序。
 * @param windowSize - 取样条数上限（至少 2）。
 * @returns 新的数组，按 seq 升序、不重复。
 */
export function selectTitleMessages(messages, windowSize) {
  const list = Array.isArray(messages) ? messages.slice() : [];
  const size = Math.max(2, Math.trunc(windowSize) || 2);
  if (list.length <= size) return list.sort((a, b) => a.seq - b.seq);
  const head = list[0];
  const tail = list.slice(list.length - (size - 1));
  const picked = [head, ...tail];
  const seen = new Set();
  return picked
    .filter((message) => {
      if (seen.has(message.seq)) return false;
      seen.add(message.seq);
      return true;
    })
    .sort((a, b) => a.seq - b.seq);
}

/** 按 UTF-8 字节上限截断字符串，不切断码点。 */
export function truncateUtf8(text, maxBytes) {
  const source = String(text);
  if (Buffer.byteLength(source, 'utf8') <= maxBytes) return source;
  let result = '';
  let used = 0;
  for (const char of source) {
    const size = Buffer.byteLength(char, 'utf8');
    if (used + size > maxBytes) break;
    result += char;
    used += size;
  }
  return result;
}

/** 把取样消息封成模型看到的提示词：JSON 数组，用户文本无法破坏结构分隔符。 */
function frameMessages(messages) {
  return `Generate the session title from this JSON array of human messages (the first item is the session's opening request; the last items are the most recent):\n${JSON.stringify(messages.map((message) => message.text))}`;
}

/**
 * 把取样消息压进输入预算内：先丢中段，再按比例截断每条的文本。
 * 首条与最新一条永远保留——它们是标题的两根支柱。
 * @param messages - 取样后的消息（按 seq 升序）。
 * @param maxInputBytes - 提示词的最大 UTF-8 字节数。
 * @returns `{ messages, prompt, bytes }`。
 */
export function fitMessages(messages, maxInputBytes) {
  const budget = Math.max(128, Math.trunc(maxInputBytes) || 4096);
  let selected = Array.isArray(messages) ? messages.slice() : [];
  if (selected.length === 0) return { messages: [], prompt: '', bytes: 0 };

  let prompt = frameMessages(selected);
  while (Buffer.byteLength(prompt, 'utf8') > budget && selected.length > 2) {
    // 丢掉第二条（中段里最老的一条），保住首条与最新一条。
    selected = [selected[0], ...selected.slice(2)];
    prompt = frameMessages(selected);
  }

  if (Buffer.byteLength(prompt, 'utf8') > budget) {
    const overhead = Buffer.byteLength(frameMessages(selected.map((message) => ({ ...message, text: '' }))), 'utf8');
    const available = Math.max(0, budget - overhead - 8);
    const perMessage = Math.max(24, Math.floor(available / selected.length));
    selected = selected.map((message) => ({ ...message, text: truncateUtf8(message.text, perMessage) }));
    prompt = frameMessages(selected);
    if (Buffer.byteLength(prompt, 'utf8') > budget) prompt = truncateUtf8(prompt, budget);
  }

  return { messages: selected, prompt, bytes: Buffer.byteLength(prompt, 'utf8') };
}

/**
 * 标题生成的系统指令。
 *
 * 与 DSH 内置提供方同源的表达（纯文本、无引号/Markdown、用消息的语言），
 * 额外强调"描述这次会话的整体方向，而不是某一处细节"。
 * @param config - 已归一化的配置。
 * @returns 系统提示词。
 */
export function buildTitleSystem(config) {
  return [
    'Create a concise title for an AI coding-assistant session from the supplied human messages.',
    "The title must capture the session's overall direction as of the most recent messages — the task, project, or topic it is really about — not a momentary detail.",
    'Return only the title on one line, in plain text of natural language, in the language of the messages, with no quotes, prefix, explanation, Markdown, XML, or terminal control codes. No code is allowed.',
    `Aim for about ${config.targetWords} words in non-CJK languages or ${config.targetCjkCharacters} CJK characters.`,
  ].join('\n');
}

/**
 * 装配流式响应：按块序号拼出文本，并报告结束原因与是否出现工具调用。
 *
 * 只认 `text-delta` 与文本块的 `block-end`（兼容不发增量的适配器）；
 * 推理增量不算标题内容。
 * @param chunks - `ctx.llm.stream()` 产出的原始块。
 * @returns `{ text, finish, toolCalls }`；`finish` 缺省表示流没给结束块。
 */
export function assembleStreamText(chunks) {
  const parts = new Map();
  const seenDelta = new Set();
  let finish;
  let toolCalls = false;
  for (const chunk of Array.isArray(chunks) ? chunks : []) {
    if (chunk === null || typeof chunk !== 'object') continue;
    switch (chunk.type) {
      case 'text-delta': {
        parts.set(chunk.index, (parts.get(chunk.index) ?? '') + chunk.text);
        seenDelta.add(chunk.index);
        break;
      }
      case 'block-end': {
        const block = chunk.block;
        if (block !== null && typeof block === 'object') {
          if (block.type === 'text' && !seenDelta.has(chunk.index)) parts.set(chunk.index, String(block.text ?? ''));
          if (block.type === 'tool-call') toolCalls = true;
        }
        break;
      }
      case 'block-start': {
        if (chunk.blockType === 'tool-call') toolCalls = true;
        break;
      }
      case 'tool-call-delta': {
        toolCalls = true;
        break;
      }
      case 'finish': {
        finish = chunk.reason;
        break;
      }
      default:
        break;
    }
  }
  const text = [...parts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map((entry) => entry[1])
    .join(' ');
  return { text, finish, toolCalls };
}

const ANSI_CSI = /\u001b\[[0-9;?]*[A-Za-z]/g;
const INVISIBLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\ufeff]/g;
const QUOTE_PAIRS = [
  ['"', '"'],
  ["'", "'"],
  ['“', '”'],
  ['「', '」'],
  ['『', '』'],
  ['《', '》'],
  ['(', ')'],
  ['（', '）'],
];

/**
 * 清洗模型输出成一条可用的标题。
 *
 * 只取第一条有内容的行；去掉终端控制码、Markdown 前缀与成对引号；
 * 空白统一成半角空格。清洗后为空表示这次生成作废（服务会保留旧标题）。
 * @param text - 模型原始输出。
 * @returns 清洗后的标题（可能为空串）。
 */
export function cleanTitle(text) {
  let source = String(text ?? '')
    .replace(ANSI_CSI, '')
    .replace(INVISIBLE, '');
  const line = source
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.length > 0 && !/^(`{3,}|~{3,})/.test(item));
  if (line === undefined) return '';
  let title = line.replace(/^[`*#>~\-–—\s]+/, '').replace(/[`*#~\s]+$/, '');
  let changed = true;
  while (changed) {
    changed = false;
    for (const [open, close] of QUOTE_PAIRS) {
      if (title.length > open.length + close.length && title.startsWith(open) && title.endsWith(close)) {
        title = title.slice(open.length, title.length - close.length).trim();
        changed = true;
      }
    }
  }
  return title.replace(/\s+/g, ' ').trim();
}

/**
 * 人话描述当前触发规则（界面与日志共用）。
 * @param config - 已归一化的配置。
 * @returns 例如「第 3 轮首次总结，之后每 5 轮刷新一次」。
 */
export function describeSchedule(config) {
  const every = config.interval === 1 ? '之后每轮刷新一次' : `之后每 ${config.interval} 轮刷新一次`;
  const body = `第 ${config.firstRound} 轮首次总结，${every}`;
  return config.enabled ? body : `已停用 · ${body}`;
}