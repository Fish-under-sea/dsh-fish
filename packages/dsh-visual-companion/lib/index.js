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
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, watch } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'

/**
 * 包版本：**从 package.json 现读**，不在代码里写死。
 *
 * 曾经这里写死 `v0.1.2`，之后连升三个版本它一次都没跟上 —— 用户拿加载日志去对版本时
 * 会被指向错误的版本号。读不到就退化成 `unknown`（只是日志，不该因为读文件失败而影响加载）。
 */
const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version ?? 'unknown'
  } catch {
    return 'unknown'
  }
})()

import { companionMessage } from './message.js'

export { companionMessage }

export const name = 'visual-companion'
export const inject = ['tools', 'commands']

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
  try {
    // 目录还不存在（这个工作区还没起过伴侣服务）时要自建：fs.watch 对不存在的路径
    // 会同步抛 ENOENT，而那会把整条插件记录成「未激活」——工具和斜杠命令一起消失。
    mkdirSync(watchDir, { recursive: true })
    state.watcher = watch(watchDir, { persistent: false }, (_event, filename) => {
      if (filename !== null && basename(String(filename)) !== 'pending.json') return
      void readPending(dir).then((pending) => (pending === undefined ? undefined : handleSubmit(ctx, pending)))
    })
    state.watcher.on?.('error', (error) => ctx.logger?.warn?.(`visual-companion: 观察 ${watchDir} 出错：${String(error)}`))
    ctx.logger?.info?.(`visual-companion: 已绑定 ${watchDir}/pending.json → 会话 ${sessionId ?? '（由 pending.json 自带）'}`)
    return true
  } catch (error) {
    // 观察不了不该让插件掉线：退化成「未绑定」，需要时还能用 visual_companion arm 重试。
    state.watcher = null
    ctx.logger?.warn?.(`visual-companion: 无法观察 ${watchDir}（${String(error?.message ?? error)}）；已跳过自动绑定，可稍后用 visual_companion({action:"arm"}) 重试`)
    return false
  }
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
        const bound = arm(ctx, dir, args.session_id === undefined || clean(args.session_id) === '' ? null : clean(args.session_id))
        if (!bound) return { status: 'arm 失败', detail: `无法观察 ${join(dir, 'state')}（详见日志）；先修好目录或权限再重试` }
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

/** 斜杠命令名：`/companion`。 */
const COMPANION_COMMAND = 'companion'

/** 被本插件拉起的服务进程（卸载时收尸；复用已有服务时保持 null）。 */
let spawnedService = null

/** 本地伴侣服务脚本（随本包发布）。 */
function companionBin() {
  return fileURLToPath(new URL('../bin/visual-companion.mjs', import.meta.url))
}

/** 伴侣根目录：配置了 watchDir 就用它，否则退回工作区下的 .dsh-visual。 */
function companionDir(config) {
  const configured = clean(config?.watchDir)
  return configured === '' ? join(process.cwd(), '.dsh-visual') : configured
}

async function readServerInfo(dir) {
  try {
    const parsed = JSON.parse(await readFile(join(dir, 'state', 'server-info'), 'utf8'))
    return parsed !== null && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

/** 服务没在跑就后台拉起（零依赖、detached、丢弃 stdio），并等它写出 server-info。 */
async function ensureService(ctx, dir, sessionId) {
  const existing = await readServerInfo(dir)
  if (existing?.url !== undefined) return existing
  await mkdir(join(dir, 'screen'), { recursive: true })
  await mkdir(join(dir, 'state'), { recursive: true })
  const args = [companionBin(), '--dir', dir, '--port', '0']
  if (sessionId !== '') args.push('--session', sessionId)
  const child = spawn(process.execPath, args, { detached: true, stdio: 'ignore' })
  child.unref()
  spawnedService = child
  ctx.logger?.info?.(`visual-companion: 已拉起伴侣服务（pid=${child.pid ?? '?'}，dir=${dir}）`)
  for (let i = 0; i < 24; i += 1) {
    const info = await readServerInfo(dir)
    if (info?.url !== undefined) return info
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return undefined
}

/** 把服务打印的 url 与 key 拼成可直接打开的完整地址。 */
function withKey(info) {
  const url = String(info?.url ?? '')
  const key = String(info?.key ?? '')
  if (url === '' || key === '' || url.includes('key=')) return url
  return `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`
}

/**
 * 注册 `/companion`：起服务并让当前会话的助手接手。
 * 服务只负责写文件；「绑观察器」与「开右侧栏」交给会话里的助手（它有 sidebar_open 与
 * visual_companion 工具，且能从自己的 $env:DSH_SESSION_ID 拿到本会话 id）。
 */
function registerCommand(ctx, config) {
  ctx.commands.register({
    name: COMPANION_COMMAND,
    description: '视觉伴侣 · 启动本地零依赖服务并把原型页开在右侧栏 —— 你点选 + 写备注后按「提交给助手」，会话自动继续',
    input: { hint: '[<想看的主题>]' },
    async handler(invocation) {
      const dir = companionDir(config)
      const sessionId = clean(invocation?.agent?.sessionId ?? invocation?.agent?.id ?? '')
      let info
      try {
        info = await ensureService(ctx, dir, sessionId)
      } catch (error) {
        return { kind: 'error', text: `视觉伴侣启动失败：${String(error?.message ?? error)}` }
      }
      if (info === undefined) {
        return { kind: 'error', text: `伴侣服务未就绪（没有写出 ${join(dir, 'state', 'server-info')}）；可手动运行 bin/visual-companion.mjs 后重试` }
      }
      const url = withKey(info)
      if (state.dir !== dir || state.watcher === null) arm(ctx, dir, sessionId === '' ? null : sessionId)
      const topic = clean(invocation?.rawInput)
      invocation?.agent?.followup?.(userMessage([
        `【视觉伴侣】本地服务已就绪：${url}`,
        `请接着做三件事：① 用 sidebar_open 把这个 URL 开在右侧栏；② 用 visual_companion({action:"arm", dir:"${dir}", session_id:"<本会话 id>"}) 绑上观察器（本会话 id 读 $env:DSH_SESSION_ID；若这个服务绑的是别的会话，重启它并带 --session）；③ 把${topic === '' ? '要看的原型' : `「${topic}」的原型`}写成 HTML 片段放进 ${join(dir, 'screen')} 目录。`,
        '用户点选并按「提交给助手」后，你会自动收到消息，不必让他回终端复述。',
      ].join('\n')))
      return { kind: 'success', text: `视觉伴侣已就绪：${url}（已让助手打开右侧栏并准备第一屏）` }
    },
  })
}
export function apply(ctx, config) {
  registerTool(ctx)
  registerCommand(ctx, config)
  // 长生命周期资源归当前 fiber：插件卸载时关闭 watcher 与本插件拉起的服务。
  ctx.effect(() => () => {
    spawnedService?.kill?.()
    spawnedService = null
    disarm()
  })
  const watchDir = clean(config?.watchDir)
  // 目标会话不在这里钉死：由 pending.json 自带（伴侣服务用 --session 写入）。
  if (watchDir !== '') arm(ctx, watchDir, null)
  ctx.logger?.info?.(`visual-companion: 已加载（v${VERSION}）${watchDir === '' ? '，未自动绑定' : `，自动绑定 ${watchDir}`}`)
}