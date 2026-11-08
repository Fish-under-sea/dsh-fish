import assert from 'node:assert/strict'
import test from 'node:test'
import { HostExecutionRunner } from '../src/host-runner.ts'
import { createTask } from '../src/core/tasks.ts'

// 0.4.16 的启动契约：卡片必须钉住工作区（或部署能解析出最近使用的工作区），
// 未钉住时在创建会话前 fail closed；owner peer 由 runner 内部按插件 fiber 绑定，
// 不再由调用方逐次传入。
const task = (extra = {}) => createTask({
  title: '回归任务',
  description: '',
  prompt: '测试',
  mode: 'default',
  workspaceId: 'ws-1',
  ...extra,
}, 1, 'task-test')

function fakeGateway(calls, presets = [{ id: 'default' }]) {
  return {
    async invoke(request) {
      assert.ok(request.peer, '每个请求都必须携带 runner 绑定 owner peer')
      calls.push({ namespace: request.namespace, method: request.method, args: request.args })
      if (request.namespace === 'agentPresets') return { presets }
      if (request.method === 'create') return { sessionId: 'session-test' }
      if (request.method === 'list') return { items: [{ sessionId: 'session-test', running: false }] }
      return {}
    },
    async stream(request) {
      assert.ok(request.peer, '历史流同样携带 owner peer')
      calls.push({ namespace: request.namespace, method: request.method, args: request.args })
      return (async function* () {
        yield { type: 'snapshot', cursor: 0, records: [], hasMore: false }
      })()
    },
  }
}

test('启动把卡片钉住的工作区带进 session.create，并按 create → rename → prompt 投递', async () => {
  const calls = []
  const runner = new HostExecutionRunner(fakeGateway(calls), undefined, {
    list: () => [{ id: 'ws-1' }],
  })
  assert.equal(await runner.launch(task()), 'session-test')
  assert.equal(calls[0].namespace, 'agentPresets')
  assert.deepEqual(calls[1], {
    namespace: 'session',
    method: 'create',
    args: { request: { workspaceId: 'ws-1', agentPreset: 'default' } },
  })
  assert.deepEqual(calls.map(call => call.method).slice(0, 3), ['list', 'create', 'rename'])
  assert.equal(calls.at(-1).method, 'prompt')
})

test('未钉工作区且部署没有可解析工作区时，在创建会话前 fail closed', async () => {
  const calls = []
  const runner = new HostExecutionRunner(fakeGateway(calls))
  await assert.rejects(runner.launch(task({ workspaceId: undefined })), /workspace/i)
  assert.equal(calls.some(call => call.method === 'create'), false)
})

test('钉住的工作区不在部署里时拒绝启动', async () => {
  const calls = []
  const runner = new HostExecutionRunner(fakeGateway(calls), undefined, {
    list: () => [{ id: 'ws-other' }],
  })
  await assert.rejects(runner.launch(task()), /workspace not found/)
  assert.equal(calls.some(call => call.method === 'create'), false)
})

test('名册与历史流走同一网关', async () => {
  const calls = []
  const runner = new HostExecutionRunner(fakeGateway(calls), undefined, {
    list: () => [{ id: 'ws-1' }],
  })
  await runner.launch(task())
  const running = await runner.listRunning()
  assert.equal(running.known, true)
  assert.equal(calls.at(-1).method, 'list')
  await runner.inspect('session-test', 0, [{ sessionId: 'session-test', running: false }])
  assert.equal(calls.at(-1).method, 'follow')
})