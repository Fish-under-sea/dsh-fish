import assert from 'node:assert/strict'
import test from 'node:test'

import { companionMessage } from '../lib/message.js'

const TAIL = '已同步给你，直接往下走就行（不必再问他）。'

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