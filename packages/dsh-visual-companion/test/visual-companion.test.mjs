import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { companionMessage } from '../lib/message.js'

/** 最小 ctx：记录工具/命令、收集 warn，并提供卸载入口。 */
function testCtx() {
  const tools = []
  const commands = []
  const warns = []
  const offs = []
  return {
    tools: { register: (tool) => { tools.push(tool); return () => {} } },
    commands: { register: (command) => { commands.push(command); return () => {} } },
    effect: (fn) => { const dispose = fn(); offs.push(dispose); return () => { if (typeof dispose === 'function') dispose() } },
    logger: { info: () => {}, warn: (message) => warns.push(String(message)) },
    registered: { tools, commands, warns },
    dispose: () => { for (const off of offs) if (typeof off === 'function') off() },
  }
}

/** 建一个只用一次的临时伴侣目录，异步体跑完（含失败）后连目录一起删。 */
async function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'vc-arm-'))
  try {
    return await fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const TAIL = '已同步给你，直接往下走就行（不必再问他）。'

test('注册 /companion 斜杠命令，并声明 commands 注入', async () => {
  const mod = await import('../lib/index.js')
  assert.ok(mod.inject.includes('commands'), 'inject 必须声明 commands')

  const commands = []
  const tools = []
  const ctx = {
    tools: { register: (tool) => { tools.push(tool); return () => {} } },
    commands: { register: (command) => { commands.push(command); return () => {} } },
    effect: (fn) => { const dispose = fn(); return () => { if (typeof dispose === 'function') dispose() } },
    logger: { info: () => {}, warn: () => {} },
  }
  mod.apply(ctx, { watchDir: '' })

  assert.equal(tools.length, 1, '应注册一个工具')
  assert.equal(commands.length, 1, '应注册一个斜杠命令')
  const [command] = commands
  assert.equal(command.name, 'companion')
  assert.equal(typeof command.handler, 'function')
  assert.ok(String(command.description).includes('提交给助手'), '说明里应讲清提交后自动继续')
  assert.ok(command.input && typeof command.input.hint === 'string', '应带 input.hint')
})

test('插件元数据：host-only、注册工具、可配置', async () => {
  // lib/index.js 会 import 宿主提供的 @deepseek-ai/* 包；这里只断言静态契约，
  // 不做真实加载（真实加载由 profile 的冷启动/工具探针负责）。
  const manifest = await import('../package.json', { with: { type: 'json' } }).then((m) => m.default)
  assert.equal(manifest.name, '@fish-under-sea/dsh-visual-companion')
  assert.deepEqual(manifest.dsh.bundle, { patch: './cordis.patch.yml' })
  assert.equal(manifest.dsh.client, undefined)
  assert.ok(manifest.files.includes('lib'))
  assert.ok(manifest.files.includes('bin'))
  assert.ok(manifest.files.includes('cordis.patch.yml'))
})

test('单选：一句话说清选了什么', () => {
  assert.equal(
    companionMessage({ selections: [{ choice: 'a', text: '单栏布局' }] }),
    `【视觉伴侣】用户在页面上选好了 A（单栏布局）。${TAIL}`,
  )
})

test('多选 + 备注：整组带上，不丢备注', () => {
  assert.equal(
    companionMessage({
      selections: [{ choice: 'a', text: '单栏布局' }, { choice: 'c', text: '混合方案' }],
      note: '间距再大一点',
    }),
    `【视觉伴侣】用户在页面上选好了 2 项：A（单栏布局）、C（混合方案），备注：间距再大一点。${TAIL}`,
  )
})

test('只有备注：不重复写「备注：」', () => {
  assert.equal(
    companionMessage({ selections: [], note: '整体再紧凑些' }),
    `【视觉伴侣】用户在页面上留了句话：整体再紧凑些。${TAIL}`,
  )
})

test('兼容旧格式（choice/text，无 selections）', () => {
  assert.equal(
    companionMessage({ choice: 's1', text: '单栏布局', note: '顺便换个配色' }),
    `【视觉伴侣】用户在页面上选好了 S1（单栏布局），备注：顺便换个配色。${TAIL}`,
  )
})

test('只有编号、没有描述也能读', () => {
  assert.equal(
    companionMessage({ selections: [{ choice: 'b', text: '' }] }),
    `【视觉伴侣】用户在页面上选好了 B。${TAIL}`,
  )
})

test('空提交不崩，给出可读兜底', () => {
  assert.equal(
    companionMessage({}),
    `【视觉伴侣】用户在页面上留了句话：（无内容）。${TAIL}`,
  )
})

test('watchDir 里的 state 目录还不存在时：加载不崩，并自建目录后完成绑定', async () => {
  await withTempDir(async (dir) => {
    assert.equal(existsSync(join(dir, 'state')), false, '前置：state 目录本不存在')
    const mod = await import('../lib/index.js')
    const ctx = testCtx()
    try {
      mod.apply(ctx, { watchDir: dir })
      assert.equal(existsSync(join(dir, 'state')), true, '应自建 <watchDir>/state')
      assert.deepEqual(ctx.registered.warns, [], '自建目录属正常路径，不该告警')
      const [tool] = ctx.registered.tools
      const status = await tool.execute({ action: 'status' })
      assert.equal(status.status, '已绑定', `应完成绑定，实际：${status.status} — ${status.detail}`)
    } finally {
      ctx.dispose()
    }
  })
})

test('watchDir 指向的不是目录（无法观察）时：加载不崩，降级为告警 + 未绑定', async () => {
  await withTempDir(async (dir) => {
    const notADir = join(dir, 'not-a-dir')
    writeFileSync(notADir, '这不是目录', 'utf8')
    const mod = await import('../lib/index.js')
    const ctx = testCtx()
    try {
      mod.apply(ctx, { watchDir: notADir })
      assert.equal(ctx.registered.warns.length, 1, `应留下一条告警，实际：${JSON.stringify(ctx.registered.warns)}`)
      assert.match(ctx.registered.warns[0], /观察/)
      const [tool] = ctx.registered.tools
      const status = await tool.execute({ action: 'status' })
      assert.equal(status.status, '未绑定', `观察器不该假装绑上，实际：${status.status}`)
    } finally {
      ctx.dispose()
    }
  })
})