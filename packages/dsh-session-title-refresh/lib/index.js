/**
 * dsh-session-title-refresh —— 宿主半边。
 *
 * 干一件事：让会话标题自己跟着对话走。
 *
 *   · 第 N 轮（默认第 3 轮）人类发言后，总结一次会话方向并命名；
 *   · 此后每 M 轮（默认 5 轮）重新总结刷新一次；
 *   · N、M 与两者的可调上限、以及取样窗口/输入预算/路由，全部在
 *     「设置 → 会话标题自动刷新」里改。
 *
 * 实现路径是 DSH 自己的标题服务 `ctx.sessionTitle`：本插件注册唯一的
 * 标题提供方（包内的 cordis.patch.yml 会停用内置的「首条消息」提供方，
 * 因为该服务每个进程只接受一个提供方）。标题写进 `session/title` 事件，
 * 客户端列表行与标题栏据此更新——**不进入模型上下文、不加主对话 token、
 * 不阻塞主回答**，标题生成走独立的辅助 LLM 调用。
 *
 * 三条硬规矩：
 *   · 尊重人工命名——标题来源是 user 时默认不再自动刷新；
 *   · 不碰子代理会话；
 *   · 轮次按绝对网格推进，插件热加载/恢复旧会话都不会补跑一串历史调用。
 *
 * @module dsh-session-title-refresh/host
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  DEFAULTS,
  PRESETS,
  PROVIDER_ID,
  assembleStreamText,
  buildTitleSystem,
  cleanTitle,
  describeSchedule,
  eligibleUserMessageOf,
  fitMessages,
  initNextDue,
  isSubagentSession,
  nextDueAfter,
  normalizeConfig,
  selectTitleMessages,
} from './core.js';

export const name = 'dsh-session-title-refresh';
export const inject = ['sessionTitle', 'llm', 'sessions', 'webServer'];

/** 同源 API 前缀（Web 半边按这个路径取数据）。 */
const API_PREFIX = '/dsh-session-title-refresh/api';

/** 标题文本的 UTF-8 字节上限，与 DSH 内置提供方的口径一致。 */
const TITLE_MAX_BYTES = 512;

/** 标题提供的结束原因（不认识的原因一律判失败，保留旧标题）。 */
const FINISH_STOP = 'stop';

/** DSH home：与 @deepseek-ai/dsh-home-paths 的解析口径一致。 */
export function resolveHome() {
  const configured = process.env.DSH_HOME;
  if (configured && configured.trim()) return path.resolve(configured.trim());
  return path.join(os.homedir(), '.dsh');
}

/** 界面保存的配置落在这里（不进任何同步仓库，与 DSH_HOME 绑定）。 */
export function statePath(home = resolveHome()) {
  return path.join(home, 'dsh-session-title-refresh', 'config.json');
}

/** 读取界面保存的配置；文件损坏时当作空配置，绝不让插件起不来。 */
function readState(home) {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath(home), 'utf8'));
    return parsed !== null && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** 合并写回界面配置（局部更新）。 */
function writeState(home, patch) {
  const file = statePath(home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const next = { ...readState(home), ...patch };
  fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

/** 把时间格式化成 ISO 字符串；失败时返回 undefined。 */
function isoTime(value) {
  const date = new Date(value ?? Date.now());
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * 装好一个会话的轮次计数与触发点。
 *
 * 计数取自会话日志本身（`ownEvents()` 会排除分叉继承的前缀），
 * 因此插件重启、会话恢复后依然准确；触发点对齐绝对网格，
 * 所以"第 3 轮刷过之后，重启也不会在第 4 轮再刷一次"。
 */
function ensureEntry(state, session, config) {
  const rounds = session.ownEvents().filter((event) => eligibleUserMessageOf(event) !== undefined).length;
  const seen = state.entries.get(session.id);
  if (seen !== undefined) {
    // 已经数过的轮次不会倒退；计数只增不减。
    if (rounds > seen.rounds) seen.rounds = rounds;
    return seen;
  }
  const entry = {
    sessionId: session.id,
    rounds,
    nextDue: initNextDue(rounds, config.firstRound, config.interval),
    refreshes: 0,
    lastRefreshAt: undefined,
    lastTitle: undefined,
    lastSource: undefined,
    skipReason: undefined,
    session,
  };
  state.entries.set(session.id, entry);
  return entry;
}

/** 记录当前标题的来源，用于判断"人工命名过没有"。 */
function noteTitle(state, session, titleApi) {
  const entry = state.entries.get(session.id);
  if (entry === undefined) return;
  const snapshot = titleApi.get(session);
  entry.lastTitle = snapshot?.title;
  entry.lastSource = snapshot?.source?.kind;
}

/**
 * 判断这次该不该自动刷新。
 * @returns 允许时 `undefined`，否则是给界面看的原因短语。
 */
function skipReasonFor(entry, config) {
  const source = entry.lastSource;
  if (source === 'user' && !config.keepRefreshingAfterManualRename) return '人工命名过，已停止自动刷新';
  if (entry.session.header !== undefined && isSubagentSession(entry.session.header)) return '子代理会话，不自动命名';
  return undefined;
}

/** 追加一条运行记录（界面"最近自动命名"用），最多留 50 条。 */
function pushLog(state, record) {
  state.log.unshift(record);
  if (state.log.length > 50) state.log.length = 50;
}

/** 把一个会话推进一格：数轮次 → 到点则刷新一次。 */
async function onRound(state, session, titleApi, logger) {
  const config = state.config;
  if (!config.enabled) return;
  if (session.header !== undefined && isSubagentSession(session.header)) return;

  const entry = ensureEntry(state, session, config);
  noteTitle(state, session, titleApi);

  const reason = skipReasonFor(entry, config);
  if (reason !== undefined) {
    entry.skipReason = reason;
    return;
  }
  entry.skipReason = undefined;

  if (entry.rounds < entry.nextDue) return;

  // 先推进触发点，再发起刷新：刷新是异步的，且失败也不该让它原地卡住。
  entry.nextDue = nextDueAfter(entry.rounds, config.firstRound, config.interval);

  const rounds = entry.rounds;
  await Promise.resolve().then(async () => {
    try {
      const snapshot = await titleApi.refresh(session);
      entry.refreshes += 1;
      entry.lastRefreshAt = isoTime();
      entry.lastTitle = snapshot?.title ?? entry.lastTitle;
      entry.lastSource = snapshot?.source?.kind ?? entry.lastSource;
      pushLog(state, {
        at: entry.lastRefreshAt,
        sessionId: session.id,
        round: rounds,
        ok: true,
        title: snapshot?.title,
      });
      logger.info?.(`会话 "${session.id}" 第 ${rounds} 轮自动命名：${String(snapshot?.title ?? '(无)')}`);
    } catch (error) {
      const message = String(error?.message ?? error);
      entry.nextDue = initNextDue(rounds + 1, config.firstRound, config.interval);
      pushLog(state, { at: isoTime(), sessionId: session.id, round: rounds, ok: false, error: message });
      logger.warn(`会话 "${session.id}" 第 ${rounds} 轮自动命名失败：${message}`);
    }
  });
}

/**
 * 生成一次标题：取样人类消息 → 调辅助 LLM → 清洗 → 作为 `session/title` 的来源。
 *
 * 这是注册进 `ctx.sessionTitle` 的提供方实现。注册成 `first-prompt` 节奏是
 * 为了保住 DSH 原有的"第 1 轮就有标题"体验；第 N 轮起的刷新由本插件自己驱动。
 * @returns `{ title, messageSeqs, model }`；失败一律抛错（服务会保留旧标题）。
 */
export function createProvider(ctx, state) {
  return {
    id: PROVIDER_ID,
    automatic: 'first-prompt',
    async generate(request) {
      const config = state.config;
      request.signal?.throwIfAborted();

      const route = resolveRoute(config, request);
      const messages = Array.isArray(request.messages) ? request.messages : [];
      if (messages.length === 0) throw new Error('dsh-session-title-refresh: 没有可用的人类消息，无法生成标题');

      const picked = selectTitleMessages(messages, config.windowSize);
      const fitted = fitMessages(picked, config.maxInputBytes);
      const selected = fitted.messages.length > 0 ? fitted.messages : picked;
      const prompt = fitted.prompt;
      const system = buildTitleSystem(config);

      const deadline = createDeadline(request.signal, config.timeoutMs);
      try {
        const chunks = [];
        for await (const chunk of ctx.llm.stream({
          provider: route.provider,
          model: route.model,
          purpose: 'session-title',
          sessionId: request.session.id,
          messages: [{ role: 'user', content: [{ type: 'text', text: prompt }], source: { kind: 'plugin', plugin: name } }],
          system,
          maxTokens: config.maxOutputTokens,
          signal: deadline.signal,
        })) {
          deadline.signal.throwIfAborted();
          chunks.push(chunk);
        }
        deadline.signal.throwIfAborted();

        const assembled = assembleStreamText(chunks);
        if (assembled.finish !== FINISH_STOP) {
          const detail = assembled.failure?.message ? `：${assembled.failure.message}` : '';
          const code = assembled.failure?.code ? `（${assembled.failure.code}）` : '';
          throw new Error(`dsh-session-title-refresh: 标题模型结束原因异常（${String(assembled.finish ?? '无结束块')}）${detail}${code}`);
        }
        if (assembled.toolCalls) throw new Error('dsh-session-title-refresh: 标题输出必须是纯文本');
        const title = cleanTitle(assembled.text);
        if (title === '') throw new Error('dsh-session-title-refresh: 标题模型没有产出文本');
        if (Buffer.byteLength(title, 'utf8') > TITLE_MAX_BYTES) {
          throw new Error(`dsh-session-title-refresh: 标题超过 ${TITLE_MAX_BYTES} 字节`);
        }
        return {
          title,
          messageSeqs: selected.map((message) => message.seq),
          model: route,
        };
      } finally {
        deadline.dispose();
      }
    },
  };
}

/** 解析路由：显式配置成对给出时用它，否则沿会话已记录的当前路由。 */
function resolveRoute(config, request) {
  if (config.provider !== '' && config.model !== '') return { provider: config.provider, model: config.model };
  const route = request.route ?? {
    provider: request.session?.requestHeader?.()?.config?.provider,
    model: request.session?.requestHeader?.()?.config?.model,
  };
  if (typeof route?.provider === 'string' && typeof route?.model === 'string' && route.provider && route.model) {
    return { provider: route.provider, model: route.model };
  }
  throw new Error('dsh-session-title-refresh: 没有可用路由——请在设置里指定 provider/model，或先让会话发出一次主请求');
}

/** 组合调用方信号与超时，给辅助调用一个明确的截止时间。 */
export function createDeadline(signal, timeoutMs) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason ?? new Error('aborted'));
  if (signal !== undefined) {
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(new Error(`dsh-session-title-refresh: 超过 ${timeoutMs}ms 未完成`)), timeoutMs);
  timer.unref?.();
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', abort);
    },
  };
}

// ── HTTP（同源 API，给设置页用） ───────────────────────────────────────
function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader?.('content-type', 'application/json; charset=utf-8');
  res.setHeader?.('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

/** 读请求体（大小有上限，坏 JSON 不会打崩宿主）。 */
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
    size += buffer.length;
    if (size > 64 * 1024) return {};
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, ''));
    return parsed !== null && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** 组装 /status：配置、规则描述、活动会话、最近记录、预设与可调范围。 */
function buildStatus(state, titleApi) {
  const config = state.config;
  const sessions = state.entries.size === 0 ? [] : [...state.entries.values()];
  const sessionList = sessions
    .map((entry) => {
      const live = state.sessions.get(entry.sessionId);
      return {
        sessionId: entry.sessionId,
        cwd: live?.session?.header?.cwd ?? live?.header?.cwd,
        rounds: entry.rounds,
        nextDue: entry.nextDue,
        refreshes: entry.refreshes,
        lastRefreshAt: entry.lastRefreshAt,
        title: entry.lastTitle,
        titleSource: entry.lastSource,
        skipReason: entry.skipReason,
        subagent: live?.session?.header !== undefined ? isSubagentSession(live.session.header) : false,
      };
    })
    .sort((a, b) => b.rounds - a.rounds);

  return {
    ok: true,
    home: resolveHome(),
    configPath: statePath(),
    config,
    defaults: DEFAULTS,
    presets: PRESETS,
    schedule: describeSchedule(config),
    running: state.running,
    sessionList,
    log: state.log.slice(0, 20),
  };
}

/**
 * 插件入口：注册标题提供方、挂会话事件监听、挂同源 API。
 * @param ctx - DSH 上下文（需要 sessionTitle / llm / sessions / webServer）。
 * @param config - 插件行里写的配置（可选），优先级低于界面保存的 config.json。
 */
export function apply(ctx, config) {
  const home = resolveHome();
  const state = {
    home,
    ctx,
    config: normalizeConfig(config, readState(home)),
    entries: new Map(),
    log: [],
    running: false,
    sessions: ctx.sessions,
  };

  // 1) 标题提供方（接管内置的那一个）。
  ctx.sessionTitle.register(createProvider(ctx, state));

  // 2) 轮次计数：每条人类发言推进一格，到点刷新。
  const fire = (session) => {
    state.running = true;
    void onRound(state, session, ctx.sessionTitle, ctx.logger).finally(() => {
      state.running = false;
    });
  };
  ctx.on('session/event', (session, event) => {
    if (event?.type !== 'user/message') return;
    if (event.data?.source?.kind !== 'user') return;
    fire(session);
  });

  // 3) 同源 API：设置页的读与写。
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: API_PREFIX,
        handler: async (req, res) => {
          if (String(req.headers?.['sec-fetch-site'] ?? '') === 'cross-site') {
            sendJson(res, 403, { ok: false, error: 'cross-site request refused' });
            return;
          }
          let url;
          try {
            url = new URL(req.url ?? '/', 'http://localhost');
          } catch {
            sendJson(res, 400, { ok: false, error: 'bad url' });
            return;
          }
          const route = url.pathname.replace(API_PREFIX, '') || '/';
          const method = String(req.method ?? 'GET').toUpperCase();

          try {
            if (method === 'GET' && route === '/status') {
              sendJson(res, 200, buildStatus(state, ctx.sessionTitle));
              return;
            }

            if (method === 'GET' && route === '/sessions') {
              const list = [];
              for (const session of ctx.sessions.list()) {
                const entry = ensureEntry(state, session, state.config);
                noteTitle(state, session, ctx.sessionTitle);
                list.push({
                  sessionId: session.id,
                  cwd: session.header?.cwd,
                  rounds: entry.rounds,
                  nextDue: entry.nextDue,
                  refreshes: entry.refreshes,
                  lastRefreshAt: entry.lastRefreshAt,
                  title: entry.lastTitle,
                  titleSource: entry.lastSource,
                  skipReason: skipReasonFor(entry, state.config),
                  subagent: isSubagentSession(session.header),
                });
              }
              list.sort((a, b) => b.rounds - a.rounds);
              sendJson(res, 200, { ok: true, sessionList: list });
              return;
            }

            if (method === 'POST' && route === '/config') {
              const body = await readBody(req);
              // readState 与 writeState 都从 state.home 取路径，这里必须用同一个 home。
              const next = writeState(state.home, body);
              state.config = normalizeConfig(config, next);
              // 规则变了：让所有会话按新规则重新对齐触发点（不补跑历史）。
              for (const entry of state.entries.values()) {
                entry.nextDue = initNextDue(entry.rounds, state.config.firstRound, state.config.interval);
                entry.skipReason = undefined;
              }
              sendJson(res, 200, buildStatus(state, ctx.sessionTitle));
              return;
            }

            if (method === 'POST' && route === '/refresh') {
              const body = await readBody(req);
              const targets = [];
              if (typeof body.sessionId === 'string' && body.sessionId !== '') {
                const session = ctx.sessions.get(body.sessionId);
                if (session === undefined) {
                  sendJson(res, 404, { ok: false, error: `找不到活动会话：${body.sessionId}` });
                  return;
                }
                targets.push(session);
              } else {
                targets.push(...ctx.sessions.list().filter((session) => !isSubagentSession(session.header)));
              }

              const refreshed = [];
              const failed = [];
              for (const session of targets) {
                try {
                  const snapshot = await ctx.sessionTitle.refresh(session);
                  const entry = ensureEntry(state, session, state.config);
                  entry.refreshes += 1;
                  entry.lastRefreshAt = isoTime();
                  entry.lastTitle = snapshot?.title;
                  entry.lastSource = snapshot?.source?.kind;
                  pushLog(state, { at: entry.lastRefreshAt, sessionId: session.id, round: entry.rounds, ok: true, title: snapshot?.title, manual: true });
                  refreshed.push({ sessionId: session.id, title: snapshot?.title, source: snapshot?.source?.kind });
                } catch (error) {
                  const message = String(error?.message ?? error);
                  pushLog(state, { at: isoTime(), sessionId: session.id, round: 0, ok: false, error: message, manual: true });
                  failed.push({ sessionId: session.id, error: message });
                }
              }
              sendJson(res, 200, { ok: true, refreshed, failed, ...buildStatus(state, ctx.sessionTitle) });
              return;
            }

            sendJson(res, 404, { ok: false, error: 'not found' });
          } catch (error) {
            sendJson(res, 500, { ok: false, error: String(error?.message ?? error) });
          }
        },
      }),
    'dsh-session-title-refresh: 同源设置 API（状态 / 保存 / 手动刷新）',
  );
}

export { API_PREFIX, PROVIDER_ID, normalizeConfig, describeSchedule };