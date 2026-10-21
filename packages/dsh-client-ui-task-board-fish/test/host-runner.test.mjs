import assert from 'node:assert/strict'
import test from 'node:test'
import { HostExecutionRunner } from '../src/host-runner.ts'
import { createTask } from '../src/core/tasks.ts'

const task = () => createTask({ title: '回归任务', description: '', prompt: '测试', mode: 'default' }, 1, 'task-test')

function strictGateway(peer, calls) {
  return {
    async invoke(request) {
      // 复现新版宿主的真实入口检查，不伪造或替换调用者身份。
      assert.equal(request.peer.signal.aborted, false)
      assert.equal(request.peer, peer)
      calls.push(request)
      if (request.namespace === 'agentPresets') return { presets: [{ id: 'default' }] }
      if (request.method === 'create') return { sessionId: 'session-test' }
      if (request.method === 'list') return { items: [{ sessionId: 'session-test', running: false }] }
      return {}
    },
    async stream(request) {
      assert.equal(request.peer.signal.aborted, false)
      assert.equal(request.peer, peer)
      calls.push(request)
      return (async function* () { yield { type: 'snapshot', cursor: 0, records: [], hasMore: false } })()
    },
  }
}

test('启动、名册和历史流携带宿主提供的同一真实 Peer', async () => {
  const peer = { signal: new AbortController().signal }
  const calls = []
  const runner = new HostExecutionRunner(strictGateway(peer, calls), undefined, undefined, undefined, () => peer)
  assert.equal(await runner.launch(task()), 'session-test')
  assert.deepEqual(calls.map(call => call.method), ['list', 'create', 'rename', 'prompt'])
  assert.deepEqual(calls[0].args, {})
  assert.deepEqual(calls[1].args, { request: { agentPreset: 'default' } })
  assert.equal((await runner.listRunning()).known, true)
  assert.equal(calls.at(-1).method, 'list')
  await runner.inspect('session-test', 0, [{ sessionId: 'session-test', running: false }])
  assert.equal(calls.at(-1).method, 'follow')
})

test('每次调用重新读取 Peer，已失效的身份不能启动任务', async () => {
  const controller = new AbortController()
  const peer = { signal: controller.signal }
  const calls = []
  const runner = new HostExecutionRunner(strictGateway(peer, calls), undefined, undefined, undefined, () => peer)
  controller.abort()
  await assert.rejects(runner.launch(task()))
  assert.equal(calls.length, 0)
})

test('旧版网关不提供显式 Peer 时仍可使用原有启动契约', async () => {
  const calls = []
  const runner = new HostExecutionRunner({ async invoke(request) {
    calls.push(request)
    return request.method === 'create' ? { sessionId: 'legacy-session' } : {}
  } })
  const plain = { ...task(), mode: undefined }
  assert.equal(await runner.launch(plain), 'legacy-session')
  assert.deepEqual(calls.map(call => call.method), ['create', 'rename', 'prompt'])
})
