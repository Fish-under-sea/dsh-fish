/**
 * @fish-under-sea/dsh-visual-companion —— 视觉伴侣唤醒插件（host-only）
 *
 * 唯一职责：观察视觉伴侣目录里的 `state/pending.json`（由配套的本地服务
 * `visual-companion.mjs` 在用户按下「提交给助手」时写入），一有新的提交就给
 * **目标会话**投一条用户消息并起一轮，于是「网页上点完就继续」，
 * 用户不必回到终端把选择再复述一遍。
 *
 * 唤醒优先级（逐个 try，返回真正成功的那条）：
 *   1. `agent.followup(createUserMessage(...))` —— 与斜杠命令注入用户消息同一条公开路径；
 *   2. `agent.steer(...)` —— 目标正在跑时；
 *   3. `ctx.subagents[Symbol.for('dsh.subagent.deliverPrompt' | 'queuePrompt')]` ——
 *      可续期子代理的宿主内部投递钩子（协议与 AgentTeams 的 harness-compat 一致）。
 *
 * 设计取舍：
 *   - host-only，不声明 `dsh.client`，不注册前端；
 *   - 配置只有 `watchDir`：非空则加载即自动绑定（配置热重载/重启后不会掉绑定）；
 *   - 目标会话由 `pending.json` 自带（服务端 `--session` 写入），不在配置里钉死；
 *   - 长生命周期资源（fs watcher）归当前 fiber，插件卸载即释放。
 *
 * @module @fish-under-sea/dsh-visual-companion
 */
import { watch } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'

import { companionMessage } from './message.js'

export { companionMessage }

export const name = 'visual-companion'
export const inject = ['tools']

/** 与 AgentTeams `harness-compat` 相同的进程稳定符号（宿主内部子代理投递协议）。 */
const hostPromptQueue = Symbol.for('dsh.subagent.queuePrompt')
const hostPromptDeliver = Symbol.for('dsh.subagent.deliverPrompt')

/** 插件配置：`watchDir` 非空时加载即自动绑定。 */
export const Config = z.object({
  watchDir: z.string().default(''),
})

/** 当前绑定（单绑定：一个进程同时只服务一个视觉伴侣目录）。 */
const state = {
  dir: null,
  sessionId: null,
  watcher: null,
  lastFingerprint: null,
  lastWake: null,
  wakeCount: 0,
}

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()

function userMessage(text) {
  return createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })
}

function agentsRegistry(ctx) {
  const registry = ctx.get('agents')
  return registry !== undefined && typeof registry.get === 'function' ? registry : undefined
}

/** 尝试把一条消息投进目标会话并起一轮；返回成功的策略。 */
async function wake(ctx, sessionId, text) {
  const attempts = []
  const registry = agentsRegistry(ctx)
  if (registry === undefined) throw new Error('agents 服务不可用：无法按 sessionId 找到会话')
  const target = registry.get(sessionId)
  if (target === undefined) throw new Error(`找不到会话 ${sessionId} 的 live agent`)

  const tryOne = async (label, fn) => {
    try {
      const result = await fn()
      return { ok: true, label, messageId: result === undefined ? '' : String(result) }
    } catch (error) {
      attempts.push(`${label}: ${String(error?.message ?? error)}`)
      return { ok: false, label }
    }
  }

  const followup = await tryOne('agent.followup', () => target.followup(userMessage(text)))
  if (followup.ok) return { ...followup, attempts }
  const steer = await tryOne('agent.steer', () => target.steer(userMessage(text)))
  if (steer.ok) return { ...steer, attempts }

  const subagents = ctx.get('subagents')
  const deliver = subagents?.[hostPromptDeliver]
  const queue = subagents?.[hostPromptQueue]
  const content = [{ type: 'text', text }]
  const signal = AbortSignal.timeout(15_000)
  if (typeof deliver === 'function') {
    const r = await tryOne('subagents.deliverPrompt(queue)', () => deliver(target, sessionId, content, { kind: 'user' }, signal, 'queue'))
    if (r.ok) return { ...r, attempts }
  }
  if (typeof queue === 'function') {
    const r = await tryOne('subagents.queuePrompt', () => queue(target, sessionId, content, { kind: 'user' }, signal))
    if (r.ok) return { ...r, attempts }
  }
  throw new Error(`所有唤醒策略都失败 → ${attempts.join(' | ')}`)
}

async function readPending(dir) {
  try {
    const parsed = JSON.parse(await readFile(join(dir, 'state', 'pending.json'), 'utf8'))
    return parsed !== null && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

function fingerprintOf(pending) {
  return `${pending.ts ?? ''}|${pending.at ?? ''}|${pending.choice ?? ''}|${pending.text ?? ''}|${JSON.stringify(pending.selections ?? '')}|${pending.note ?? ''}`
}

async function handleSubmit(ctx, pending) {
  const fp = fingerprintOf(pending)
  if (fp === state.lastFingerprint) return
  state.lastFingerprint = fp
  const sessionId = pending.sessionId === undefined ? state.sessionId : String(pending.sessionId)
  if (sessionId === null || sessionId === '') {
    state.lastWake = { ok: false, detail: '未绑定 sessionId，无法唤醒' }
    return
  }
  try {
    const result = await wake(ctx, sessionId, companionMessage(pending))
    state.wakeCount += 1
    state.lastWake = { ok: true, detail: `${result.label} → message ${result.messageId || '(unknown id)'}` }
    ctx.logger?.info?.(`visual-companion: 唤醒 ${sessionId} 成功（${result.label}）`)
  } catch (error) {
    state.lastWake = { ok: false, detail: String(error?.message ?? error) }
    ctx.logger?.warn?.(`visual-companion: 唤醒 ${sessionId} 失败：${state.lastWake.detail}`)
  }
}

function arm(ctx, dir, sessionId) {
  state.watcher?.close?.()
  state.dir = dir
  state.sessionId = sessionId
  state.lastFingerprint = null
  const watchDir = join(dir, 'state')
  state.watcher = watch(watchDir, { persistent: false }, (_event, filename) => {
    if (filename !== null && basename(String(filename)) !== 'pending.json') return
    void readPending(dir).then((pending) => (pending === undefined ? undefined : handleSubmit(ctx, pending)))
  })
  state.watcher.on?.('error', (error) => ctx.logger?.warn?.(`visual-companion: 观察 ${watchDir} 出错：${String(error)}`))
  ctx.logger?.info?.(`visual-companion: 已绑定 ${watchDir}/pending.json → 会话 ${sessionId ?? '（由 pending.json 自带）'}`)
}

function disarm() {
  state.watcher?.close?.()
  state.watcher = null
}

function registerTool(ctx) {
  ctx.tools.register(defineTool({
    name: 'visual_companion',
    description: '视觉伴侣唤醒开关。arm 绑定一个视觉伴侣目录（观察其中的 state/pending.json）与目标会话；之后用户在页面上提交选择时，会直接给该会话投一条用户消息并起一轮，无需他回终端复述。disarm 解绑；status 查看绑定与最近一次唤醒结果；wake 立刻用给定文本探测唤醒链路（验证用）。',
    parameters: {
      action: { type: 'string', required: true, enum: ['arm', 'disarm', 'status', 'wake'], description: '要执行的动作。' },
      dir: { type: 'string', description: 'arm 用：视觉伴侣根目录（内含 state/pending.json）。' },
      session_id: { type: 'string', description: 'arm/wake 用：要唤醒的会话 id；arm 时可省略，之后由 pending.json 自带。' },
      text: { type: 'string', description: 'wake 用：投递的文本。' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          status: { type: 'string', required: true },
          detail: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `${value.status}${value.detail === undefined ? '' : ` — ${value.detail}`}` }],
    },
    async execute(args) {
      if (args.action === 'arm') {
        const dir = clean(args.dir)
        if (dir === '') return { status: 'arm 失败', detail: '需要 dir' }
        arm(ctx, dir, args.session_id === undefined || clean(args.session_id) === '' ? null : clean(args.session_id))
        return { status: '已绑定', detail: `${dir}/state/pending.json → ${state.sessionId ?? '（由 pending.json 自带 sessionId）'}` }
      }
      if (args.action === 'disarm') {
        disarm()
        return { status: '已解绑' }
      }
      if (args.action === 'wake') {
        const sessionId = clean(args.session_id) || clean(state.sessionId)
        const text = clean(args.text) === '' ? '【视觉伴侣】唤醒链路自检。' : clean(args.text)
        if (sessionId === '') return { status: 'wake 失败', detail: '需要 session_id' }
        try {
          const result = await wake(ctx, sessionId, text)
          state.wakeCount += 1
          state.lastWake = { ok: true, detail: `${result.label} → message ${result.messageId || '(unknown id)'}` }
          return { status: '唤醒成功', detail: `${sessionId} via ${result.label}（messageId=${result.messageId || 'unknown'}）` }
        } catch (error) {
          const detail = String(error?.message ?? error)
          state.lastWake = { ok: false, detail }
          return { status: '唤醒失败', detail }
        }
      }
      const pending = state.dir === null ? undefined : await readPending(state.dir)
      return {
        status: state.watcher === null ? '未绑定' : '已绑定',
        detail: [
          `dir=${state.dir ?? '(none)'}`,
          `session=${state.sessionId ?? '(from pending)'}`,
          `wakes=${state.wakeCount}`,
          `last=${state.lastWake === null ? '(none)' : `${state.lastWake.ok ? 'ok' : 'fail'}: ${state.lastWake.detail}`}`,
          `pending=${pending === undefined ? '(none)' : JSON.stringify(pending).slice(0, 120)}`,
        ].join(' | '),
      }
    },
  }))
}

export function apply(ctx, config) {
  registerTool(ctx)
  // 长生命周期资源归当前 fiber：插件卸载时关闭 watcher。
  ctx.effect(() => () => disarm())
  const watchDir = clean(config?.watchDir)
  // 目标会话不在这里钉死：由 pending.json 自带（伴侣服务用 --session 写入）。
  if (watchDir !== '') arm(ctx, watchDir, null)
  ctx.logger?.info?.(`visual-companion: 已加载（v0.1.0）${watchDir === '' ? '，未自动绑定' : `，自动绑定 ${watchDir}`}`)
}