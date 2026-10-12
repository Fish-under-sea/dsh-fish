import test from 'node:test'
import assert from 'node:assert/strict'
import * as voucher from '../src/client/voucher.ts'
import { emptyTotals } from '../src/core/types.ts'

const tokens = (patch = {}) => ({ ...emptyTotals(), ...patch })
const row = (provider, patch) => ({ provider, totals: tokens(patch), models: [] })
const windowOf = (providers) => ({ from: '2026-09-11', to: '2026-10-12', totals: emptyTotals(), providers })

test('假设计价函数存在', () => {
  assert.equal(typeof voucher.officialPricingScenarios, 'function')
})
test('完整 provider 分桶计价，不依赖截短的 models 与历史 cost', () => {
  const window = windowOf([row('deepseek', {
    inputTokens: 1_000_000, cacheWriteTokens: 1_000_000, cacheReadTokens: 1_000_000,
    outputTokens: 1_000_000, reasoningTokens: 400_000, cost: 99999,
  })])
  assert.deepEqual(voucher.officialPricingScenarios(window), { peak: 12.04, offPeak: 6.02 })
})
test('计价仅官方家族，MiMo 与第三方不进入假設金额', () => {
  const window = windowOf([
    row('deepseek-official', { outputTokens: 1_000_000 }),
    row('deepseek-account', { inputTokens: 1_000_000 }),
    row('mimo', { outputTokens: 100_000_000 }),
    row('third-party', { outputTokens: 100_000_000 }),
  ])
  assert.deepEqual(voucher.officialPricingScenarios(window), { peak: 10, offPeak: 5 })
})
test('无窗口不虚构金额，无官方 token 的有效窗口金额为零', () => {
  assert.equal(voucher.officialPricingScenarios(undefined), undefined)
  assert.deepEqual(voucher.officialPricingScenarios(windowOf([row('mimo', { inputTokens: 50 })])), { peak: 0, offPeak: 0 })
})
test('窗口变化与未计价历史记录按当前 Flash 表重算', () => {
  assert.deepEqual(voucher.officialPricingScenarios(windowOf([row('deepseek', { inputTokens: 2_000_000, cost: 0 })])), { peak: 4, offPeak: 2 })
  assert.deepEqual(voucher.officialPricingScenarios(windowOf([row('deepseek', { inputTokens: 10 })])), { peak: 0.00002, offPeak: 0.00001 })
})
