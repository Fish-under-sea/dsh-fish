/**
 * Token 银行「官方价目表假设估算」的口径测试。
 *
 * 口径：统计**所有路由**下 DeepSeek 模型的消耗（不限官方家族），按当前 Flash
 * 价目表分别算出「全高峰」与「全低谷」两个假设金额。
 *
 * 分两层验证：
 *  1. `summarizeDays` 在宿主侧按**不截断**的逐模型映射汇总出 deepseek 分桶；
 *  2. `officialPricingScenarios` 只读该分桶计价，旧宿主不下发时不虚构数字。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as voucher from '../src/client/voucher.ts'
import { summarizeDays } from '../src/core/ledger.ts'
import { emptyTotals } from '../src/core/types.ts'

const tokens = (patch = {}) => ({ ...emptyTotals(), ...patch })
const row = (provider, patch) => ({ provider, totals: tokens(patch), models: [] })
const day = (providers) => {
  const out = {}
  for (const [provider, models] of Object.entries(providers)) out[provider] = models
  return out
}

// ---------- 第二层：假设计价 ----------

test('假设计价读宿主下发的 deepseek 分桶', () => {
  const window = {
    from: '2026-09-11',
    to: '2026-10-12',
    totals: emptyTotals(),
    providers: [],
    deepseek: tokens({
      inputTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      outputTokens: 1_000_000,
      reasoningTokens: 400_000,
      cost: 99999, // 历史 cost 绝不参与假设计价
    }),
  }
  assert.deepEqual(voucher.officialPricingScenarios(window), { peak: 12.04, offPeak: 6.02 })
})

test('旧宿主不下发 deepseek 分桶时不虚构金额', () => {
  const legacy = { from: 'a', to: 'b', totals: emptyTotals(), providers: [row('deepseek-official', { outputTokens: 1_000_000 })] }
  assert.equal(voucher.officialPricingScenarios(legacy), undefined)
  assert.equal(voucher.officialPricingScenarios(undefined), undefined)
})

test('零消耗的窗口给出 0 而不是 undefined', () => {
  const window = { from: 'a', to: 'b', totals: emptyTotals(), providers: [], deepseek: emptyTotals() }
  assert.deepEqual(voucher.officialPricingScenarios(window), { peak: 0, offPeak: 0 })
})

// ---------- 第一层：宿主汇总 ----------

test('汇总把所有路由的 DeepSeek 模型计入 deepseek 分桶', () => {
  const summary = summarizeDays([
    day({
      // 聚合型 provider 上的 DeepSeek 模型：这是本次口径变更的关键增量
      bailian: {
        'deepseek-v4.1-flash': tokens({ inputTokens: 100, outputTokens: 200 }),
        'deepseek-v4-pro': tokens({ cacheReadTokens: 5 }),
        // 同 provider 的非 DeepSeek 模型必须排除
        'qwen3.8-max': tokens({ inputTokens: 999_999 }),
      },
      // 官方路由：即便模型 id 不含 deepseek 字样也要计入（保底条款）
      'deepseek-official': { 'some-unusual-alias': tokens({ outputTokens: 50 }) },
      // 其它厂商一律排除
      'mimo-f': { 'mimo-v2.6-flash': tokens({ inputTokens: 500_000 }) },
      'glm-f': { 'zai/glm-5.3': tokens({ inputTokens: 700_000 }) },
    }),
  ])

  assert.equal(summary.deepseek.inputTokens, 100)
  assert.equal(summary.deepseek.outputTokens, 250)
  assert.equal(summary.deepseek.cacheReadTokens, 5)
  assert.equal(summary.deepseek.cacheWriteTokens, 0)
  // 全量合计仍包含被排除的模型
  assert.ok(summary.totals.inputTokens > summary.deepseek.inputTokens)
})

test('汇总的 deepseek 分桶不受每 provider 模型上限影响', () => {
  // 造 20 个模型：前 19 个是干扰项且更重，DeepSeek 模型排最后
  const heavy = {}
  for (let i = 0; i < 19; i += 1) heavy[`other-model-${i}`] = tokens({ inputTokens: 10_000_000 })
  heavy['deepseek-v4.1-flash'] = tokens({ inputTokens: 7 })

  const summary = summarizeDays([day({ bailian: heavy })])
  // 客户端只能拿到 12 条最重的模型行，deepseek 那条会被截断掉
  const bailian = summary.providers.find((p) => p.provider === 'bailian')
  assert.equal(bailian.models.some((m) => m.model === 'deepseek-v4.1-flash'), false)
  assert.equal(bailian.models.length, 12)
  // 但宿主汇总的分桶仍然完整
  assert.equal(summary.deepseek.inputTokens, 7)
})

test('多种真实命名口径都被识别', () => {
  const summary = summarizeDays([
    day({
      bailian: { 'deepseek-v4-flash-0731': tokens({ inputTokens: 1 }) },
      'deepseek-f': { 'loomy/DeepSeek-V4.1-Flash': tokens({ inputTokens: 2 }) },
      'deepseek-f-2': { 'our-free-model/deepseek-ai/deepseek-v4.1-flash': tokens({ inputTokens: 4 }) },
      chatanywhere: { 'deepseek-v4.1-flash': tokens({ inputTokens: 8 }) },
      'minimax-f': { 'minimax/MiniMax-M3': tokens({ inputTokens: 16 }) },
      'cn-f': { 'cline/cline-free/step-5-preview': tokens({ inputTokens: 32 }) },
    }),
  ])
  assert.equal(summary.deepseek.inputTokens, 15)
})
