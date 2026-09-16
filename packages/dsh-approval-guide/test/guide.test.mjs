/**
 * dsh-approval-guide 中文说明逻辑测试。
 *
 * 测试装载的是真正会进浏览器的 client bundle：用 node:vm 提供一个
 * `window.__ModuleLoader__`，抓住 bundle 注册的 factory，再用假的模块表
 * 实例化它。组件函数只用注入进来的 hook（`useChat` /
 * `useSessionPendingInteraction`）取数据，本身不调用 React hook，所以可以
 * 直接调用并检查它产出的元素树——不需要为测试安装 React。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const clientPath = join(here, '..', 'lib', 'client.js')

/** 把 vm 世界里造出来的对象搬回本 realm，便于深比较。 */
function plain(value) {
	return JSON.parse(JSON.stringify(value))
}

/** 记录型 jsx 运行时：产出可遍历的元素树，替代真实 React。 */
function recordingJsxRuntime() {
	const jsx = (type, props, key) => ({ type, props: props ?? {}, key })
	return { jsx, jsxs: jsx, Fragment: Symbol('Fragment') }
}

/** 把元素树里的文本节点按顺序收集出来。 */
function collectText(node, out = []) {
	if (node === null || node === undefined || typeof node === 'boolean') return out
	if (typeof node === 'string' || typeof node === 'number') {
		out.push(String(node))
		return out
	}
	if (Array.isArray(node)) {
		for (const child of node) collectText(child, out)
		return out
	}
	collectText(node.props?.children, out)
	return out
}

/** 装载 bundle 并实例化 factory。 */
function loadPlugin() {
	const source = readFileSync(clientPath, 'utf8')
	let entry
	const document = {
		querySelector: () => null,
		createElement: () => ({ dataset: {}, textContent: '' }),
		head: { appendChild: () => {} }
	}
	const sandbox = {
		window: { __ModuleLoader__: { load: (value) => (entry = value) } },
		document,
		console
	}
	vm.createContext(sandbox)
	vm.runInContext(source, sandbox, { filename: clientPath })
	assert.ok(entry !== undefined, 'bundle 必须调用 window.__ModuleLoader__.load')
	const modules = {
		'react': { createElement: (type, props, ...children) => ({ type, props: { ...props, children }, key: props?.key }) },
		'react/jsx-runtime': recordingJsxRuntime(),
		'@deepseek-ai/dsh-client-ui-primitives': {}
	}
	const requireFn = (spec) => {
		if (Object.hasOwn(modules, spec)) return modules[spec]
		throw new Error(`测试模块表缺少 "${spec}"`)
	}
	return { id: entry.id, exports: entry.factory(requireFn) }
}

/** 造一个和真实 Chat store 同形的快照。 */
function chatSnapshot(callId, argsRaw, toolName) {
	const root = toolName === undefined ? { callId, argsRaw } : { callId, argsRaw, name: toolName }
	return { nodes: new Map([['node-1', { kind: 'tool-call', data: { root } }]]) }
}

test('沙箱升级到 danger-full-access：说明会做什么、风险，并标为高危', () => {
	const { __internals } = loadPlugin().exports
	const guide = plain(__internals.explainApproval({
		toolName: 'pwsh',
		reason: 'escalate sandbox to danger-full-access: 需要读取安装目录的版本号',
		args: {
			command: 'Get-Item "C:\\Program Files\\DeepSeek Harness"',
			sandbox_permissions: 'danger-full-access',
			justification: '需要读取安装目录的版本号'
		}
	}))
	assert.equal(guide.level, 'danger')
	assert.equal(guide.scope, 'sandbox-escalation')
	assert.match(guide.what, /pwsh/)
	assert.match(guide.what, /danger-full-access/)
	assert.match(guide.what, /只对本次|仅本次/)
	assert.match(guide.risk, /任意文件/)
	assert.match(guide.risk, /密钥|凭据/)
	assert.equal(guide.command, 'Get-Item "C:\\Program Files\\DeepSeek Harness"')
	assert.deepEqual(guide.facts.map((fact) => fact.label), ['工具', '目标权限', '模型给的理由'])
	assert.equal(guide.facts[2].value, '需要读取安装目录的版本号')
	assert.ok(guide.check.length > 0)
})

test('沙箱升级到 workspace-write：风险文案限定在工作区与临时目录', () => {
	const { __internals } = loadPlugin().exports
	const guide = plain(__internals.explainApproval({
		toolName: 'write',
		reason: 'escalate sandbox to workspace-write: 需要把结果写入工作区',
		args: { file_path: 'D:\\Fish-code\\DSH\\out.md', sandbox_permissions: 'workspace-write', justification: '需要把结果写入工作区' }
	}))
	assert.equal(guide.level, 'caution')
	assert.equal(guide.scope, 'sandbox-escalation')
	assert.match(guide.what, /workspace-write/)
	assert.match(guide.risk, /工作区/)
	assert.match(guide.risk, /临时目录/)
	assert.equal(guide.command, undefined, '没有 command 参数时不应编造命令')
	assert.deepEqual(guide.facts[1].value, '工作区可写（workspace-write）')
})

test('参数缺失时用理由文本兜底解析出目标权限', () => {
	const { __internals } = loadPlugin().exports
	const guide = plain(__internals.explainApproval({
		toolName: 'pwsh',
		reason: 'escalate sandbox to danger-full-access: 只是想看一眼日志',
		args: undefined
	}))
	assert.equal(guide.scope, 'sandbox-escalation')
	assert.equal(guide.level, 'danger')
	assert.match(guide.what, /danger-full-access/)
	assert.equal(guide.facts[2].value, '只是想看一眼日志')
})

test('非沙箱升级的审批走通用中文兜底，不会漏掉说明', () => {
	const { __internals } = loadPlugin().exports
	const guide = plain(__internals.explainApproval({
		toolName: 'bash',
		reason: 'blocked by PreToolUse hook',
		args: { command: 'rm -rf build' }
	}))
	assert.equal(guide.scope, 'generic')
	assert.equal(guide.level, 'caution')
	assert.match(guide.what, /bash/)
	assert.match(guide.what, /本次/)
	assert.match(guide.risk, /更高权限/)
	assert.equal(guide.command, 'rm -rf build')
	assert.ok(guide.facts.every((fact) => fact.label !== '目标权限'))
})

test('损坏或畸形的输入绝不抛异常，仍给出完整中文说明', () => {
	const { __internals } = loadPlugin().exports
	const cases = [
		{ toolName: undefined, reason: undefined, args: undefined },
		{ toolName: 'pwsh', reason: 'escalate sandbox to', args: { sandbox_permissions: 42 } },
		{ toolName: 'pwsh', reason: '', args: {} },
		{ toolName: '   ', reason: 'escalate sandbox to unknown-mode: 理由', args: { command: null } },
		{ toolName: 'pwsh', reason: 'escalate sandbox to danger-full-access: ', args: undefined }
	]
	for (const input of cases) {
		const guide = plain(__internals.explainApproval(input))
		assert.ok(guide.what.length > 0, `what 不应为空: ${JSON.stringify(input)}`)
		assert.ok(guide.risk.length > 0, `risk 不应为空: ${JSON.stringify(input)}`)
		assert.ok(guide.check.length > 0, `check 不应为空: ${JSON.stringify(input)}`)
		assert.ok(['danger', 'caution'].includes(guide.level))
	}
})

test('未知目标权限按升级处理并保留原始模式名', () => {
	const { __internals } = loadPlugin().exports
	const guide = plain(__internals.explainApproval({
		toolName: 'pwsh',
		reason: 'escalate sandbox to future-mode: 理由',
		args: { sandbox_permissions: 'future-mode' }
	}))
	assert.equal(guide.scope, 'sandbox-escalation')
	assert.equal(guide.level, 'caution')
	assert.match(guide.what, /future-mode/)
})

test('argsRaw 不是合法 JSON 时按无参数处理', () => {
	const { __internals } = loadPlugin().exports
	assert.equal(plain(__internals.explainApproval({ toolName: 'pwsh', reason: '', args: __internals.parseCallArgs('{不是 JSON') })).scope, 'generic')
	assert.equal(__internals.parseCallArgs('{"command":"echo hi"}').command, 'echo hi')
	assert.equal(__internals.parseCallArgs(undefined), undefined)
	assert.equal(__internals.parseCallArgs('[1,2]'), undefined, '数组参数不是工具调用对象')
})

test('组件：审批卡里同时出现原命令与中文说明块', () => {
	const { __internals } = loadPlugin().exports
	const props = {
		callId: 'call-1',
		sessionId: 'session-1',
		useChat: (selector) => selector(chatSnapshot('call-1', JSON.stringify({
			command: 'Get-Content C:\\Users\\Fish\\.dsh\\settings.yaml',
			sandbox_permissions: 'danger-full-access',
			justification: '需要核对配置'
		}))),
		useSessionPendingInteraction: (selector) => selector(new Map([
			['session-1', { kind: 'approval', toolName: 'pwsh', reason: 'escalate sandbox to danger-full-access: 需要核对配置' }]
		]))
	}
	const text = collectText(__internals.ApprovalGuide(props)).join('\n')
	assert.match(text, /Get-Content C:\\Users\\Fish\\\.dsh\\settings\.yaml/, '命令原文必须保留显示')
	assert.match(text, /pwsh/)
	assert.match(text, /任意文件/, '必须给出中文风险说明')
	assert.match(text, /拒绝/)
})

test('组件：取不到 pending/关联调用时降级但绝不崩溃', () => {
	const { __internals } = loadPlugin().exports
	const props = {
		callId: 'call-404',
		sessionId: 'session-1',
		useChat: (selector) => selector(chatSnapshot('other-call', '{}')),
		useSessionPendingInteraction: (selector) => selector(new Map())
	}
	const text = collectText(__internals.ApprovalGuide(props)).join('\n')
	assert.match(text, /未知工具/)
	assert.ok(text.includes('风险'))
})

test('组件：chat 选择器返回字符串，两次取值同一身份（避开 useSyncExternalStore 快照缓存告警）', () => {
	const { __internals } = loadPlugin().exports
	const argsRaw = JSON.stringify({ command: 'echo hi' })
	const snapshot = chatSnapshot('call-1', argsRaw)
	let captured
	__internals.ApprovalGuide({
		callId: 'call-1',
		sessionId: 'session-1',
		useChat: (selector) => {
			captured = selector
			return selector(snapshot)
		},
		useSessionPendingInteraction: (selector) => selector(new Map())
	})
	assert.equal(typeof captured, 'function', '组件必须用 useChat 读取关联调用')
	const first = captured(snapshot)
	const second = captured(snapshot)
	assert.equal(typeof first, 'string')
	assert.ok(Object.is(first, second), '同一快照上的两次取值必须身份相同')
	assert.equal(first, argsRaw)
})

test('插件元数据：注册到审批详情插槽且优先级低于核心占用者', () => {
	const { exports } = loadPlugin()
	assert.deepEqual(plain(exports.inject), ['slots'])
	assert.equal(typeof exports.apply, 'function')
	const registrations = []
	const ctx = {
		effect: (fn) => {
			fn()
			return () => {}
		},
		slots: {
			inject: (name, factory) => {
				const record = { inject: name, options: undefined }
				registrations.push(record)
				record.entry = factory()
				return () => {}
			},
			register: (options) => {
				registrations[registrations.length - 1].options = options
				return () => {}
			}
		}
	}
	exports.apply(ctx)
	assert.equal(registrations.length, 1)
	assert.equal(registrations[0].inject, 'conversation.approval.detail')
	assert.equal(registrations[0].options.name, 'conversation.approval.detail')
	assert.ok(registrations[0].options.priority < 0, '必须低于核心 ApprovalCommand 的默认优先级 0')
})