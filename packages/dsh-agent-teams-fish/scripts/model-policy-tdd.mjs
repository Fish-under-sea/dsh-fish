/** 官方 subagent 策略是成员路由与 fallback 的唯一名单来源。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveMemberLlmSelection } from '../lib/members.js'

const POLICY = [
  { provider: 'magpie', model: 'group/deepseek' },
  { provider: 'magpie', model: 'group/qwen-p' },
  { provider: 'magpie', model: 'group/glm' },
]

function fixture(policy = POLICY) {
  const captain = {
    id: 'captain',
    options: { provider: 'magpie', model: 'group/deepseek' },
    session: {
      requestHeader: () => ({ config: { provider: 'magpie', model: 'group/deepseek' } }),
      append() {},
    },
  }
  const ctx = {
    get: (name) => name === 'sessionProjections'
      ? { stateOf: () => policy }
      : undefined,
    llm: {
      resolveCallConfig: async (route) => route,
    },
  }
  return { ctx, captain }
}

test('名单内 fallback 保留原值', async () => {
  const { ctx, captain } = fixture()
  const selection = await resolveMemberLlmSelection(ctx, captain, {
    fallback: { provider: 'magpie', model: 'group/qwen-p' },
  })
  assert.equal(selection.provider, 'magpie')
  assert.equal(selection.model, 'group/deepseek')
  assert.deepEqual(selection.fallback, { provider: 'magpie', model: 'group/qwen-p' })
})

test('名单外 fallback 自动改成名单内另一条路由', async () => {
  const { ctx, captain } = fixture()
  const selection = await resolveMemberLlmSelection(ctx, captain, {
    fallback: { provider: 'magpie', model: 'group/hy4-m' },
  })
  assert.deepEqual(selection.fallback, { provider: 'magpie', model: 'group/qwen-p' })
})

test('captain 默认路由不在名单内时自动改用名单首项（未配置 fallback 则不降级）', async () => {
  const { ctx, captain } = fixture([
    { provider: 'magpie', model: 'group/qwen-p' },
    { provider: 'magpie', model: 'group/glm' },
  ])
  const selection = await resolveMemberLlmSelection(ctx, captain, {})
  assert.equal(selection.provider, 'magpie')
  assert.equal(selection.model, 'group/qwen-p')
  assert.equal(selection.fallback, undefined)
})

test('显式选择名单外路由仍然报错，不静默改路', async () => {
  const { ctx, captain } = fixture()
  await assert.rejects(
    () => resolveMemberLlmSelection(ctx, captain, {
      provider: 'magpie',
      model: 'group/hy4-m',
    }),
    /not allowed for this Session/,
  )
})
