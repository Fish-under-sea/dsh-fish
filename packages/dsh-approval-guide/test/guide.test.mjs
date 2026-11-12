/**
 * dsh-approval-guide 中文说明逻辑测试。
 *
 * 测试装载的是真正会进浏览器的 client bundle：用 node:vm 提供一个
 * `window.__ModuleLoader__`，抓住 bundle 注册的 factory，再用假的模块表
 * 实例化它。组件函数只用注入进来的 hook（`useChat` / `useSessionStatus`，
 * 旧版宿主回退 `useSessionPendingInteraction`）取数据，本身不调用 React hook，所以可以
 * 直接调用并检查它产出的元素树——不需要为测试安装 React。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

/**
 * jsdom 只用于「空输入点发送」的 DOM 测试。它来自仓库根 node_modules（pnpm 提升），
 * 但没有写进本包 package.json（本任务禁止改 package.json）：缺了就显式跳过这段
 * 用例，而不是让整个测试文件因为一个可选测试依赖而加载失败。
 */
let JSDOM = null
try {
	;({ JSDOM } = await import('jsdom'))
} catch {
	JSDOM = null
}

/** 需要 jsdom 的用例：环境里没有 jsdom 时显式跳过，而不是让整个测试文件崩掉。 */
const domTest = (name, fn) =>
	JSDOM === null
		? test(name, { skip: 'jsdom 不可用（仓库根 node_modules 未提升这个可选测试依赖）' }, () => {})
		: test(name, fn)

const here = dirname(fileURLToPath(import.meta.url))
const clientPath = join(here, '..', 'lib', 'client.js')
/** 包清单：注册名必须等于包名，这里直接读 name 而不硬编码，改名后测试不会跟着漂移。 */
const PKG = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'))

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
	assert.equal(entry.id, PKG.name, '注册名必须是包名（loader 按包名认领 factory）')
	const modules = {
		'react': { createElement: (type, props, ...children) => ({ type, props: { ...props, children }, key: props?.key }) },
		'react/jsx-runtime': recordingJsxRuntime()
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

test('组件：审批卡里同时出现原命令与中文说明块（0.2.0 的 useSessionStatus）', () => {
	const { __internals } = loadPlugin().exports
	const props = {
		callId: 'call-1',
		sessionId: 'session-1',
		useChat: (selector) => selector(chatSnapshot('call-1', JSON.stringify({
			command: 'Get-Content C:\\Users\\Fish\\.dsh\\settings.yaml',
			sandbox_permissions: 'danger-full-access',
			justification: '需要核对配置'
		}))),
		useSessionStatus: (selector) => selector(new Map([
			['session-1', { pendingInteraction: { kind: 'approval', toolName: 'pwsh', reason: 'escalate sandbox to danger-full-access: 需要核对配置' } }]
		]))
	}
	const text = collectText(__internals.ApprovalGuide(props)).join('\n')
	assert.match(text, /Get-Content C:\\Users\\Fish\\\.dsh\\settings\.yaml/, '命令原文必须保留显示')
	assert.match(text, /pwsh/)
	assert.match(text, /任意文件/, '必须给出中文风险说明')
	assert.match(text, /拒绝/)
})

test('组件：0.1.x 回退路径仍然可用（useSessionPendingInteraction）', () => {
	const { __internals } = loadPlugin().exports
	const props = {
		callId: 'call-1',
		sessionId: 'session-1',
		useChat: (selector) => selector(chatSnapshot('call-1', JSON.stringify({ command: 'echo hi' }))),
		useSessionPendingInteraction: (selector) => selector(new Map([
			['session-1', { kind: 'approval', toolName: 'pwsh', reason: 'escalate sandbox to danger-full-access: 需要核对配置' }]
		]))
	}
	const text = collectText(__internals.ApprovalGuide(props)).join('\n')
	assert.match(text, /pwsh/, '旧版宿主下也必须取到待审批工具名')
	assert.match(text, /任意文件/)
})

test('组件：取不到 pending/关联调用时降级但绝不崩溃', () => {
	const { __internals } = loadPlugin().exports
	const props = {
		callId: 'call-404',
		sessionId: 'session-1',
		useChat: (selector) => selector(chatSnapshot('other-call', '{}')),
		useSessionStatus: (selector) => selector(new Map())
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
		useSessionStatus: (selector) => selector(new Map())
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

// ---------------------------------------------------------------------------
// 空输入点发送增强：输入框为空时点发送按钮，自动填入固定文案并只提交一次。
// 这一段用 jsdom 走真实的 DOM 事件链路（pointerdown → 写入 → 按钮变可用 → 点击）。
// ---------------------------------------------------------------------------

/** 和实现里保持一致的固定文案（断言用字面量，避免实现改文案却测试跟着漂）。 */
const EMPTY_SEND_TEXT = '继续任务，并梳理进度'

/** 手动时钟：把「等按钮变可用」的轮询收进队列，由测试显式推进。 */
function makeClock() {
	const queue = new Map()
	let next = 1
	return {
		setTimeout(fn) {
			const id = next++
			queue.set(id, fn)
			return id
		},
		clearTimeout(id) {
			queue.delete(id)
		},
		get pending() {
			return queue.size
		},
		flush(limit = 500) {
			let steps = 0
			while (queue.size > 0 && steps < limit) {
				const [id, fn] = queue.entries().next().value
				queue.delete(id)
				fn()
				steps += 1
			}
			return steps
		}
	}
}

/**
 * 造一个和 DSH 输入区同形的 jsdom DOM：
 * [data-composer-card] > (附件轨道?) + [data-input-scroll] > 编辑器 + 行 > 主按钮。
 * 默认是「空输入 + 发送按钮 disabled」这个死键现场。
 */
function makeComposerDom(options = {}) {
	const {
		text = '',
		phase = 'plain',
		sendDisabled = true,
		stop = false,
		sending = false,
		attachments = false,
		uploading = false,
		composing = false,
		claimed = false,
		commandMenu = false
	} = options
	const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
	const { document } = dom.window
	const card = document.createElement('div')
	card.setAttribute('data-composer-card', '')
	/** 附件轨道由 ComposerAttachments 直接渲染成卡片子元素，位于编辑器之前。 */
	const appendRail = (node) => {
		const rail = document.createElement('div')
		rail.appendChild(node)
		card.appendChild(rail)
	}
	if (attachments) {
		const group = document.createElement('div')
		group.setAttribute('role', 'group')
		group.setAttribute('aria-label', '附件')
		appendRail(group)
	}
	if (uploading) {
		const thumb = document.createElement('img')
		thumb.setAttribute('aria-busy', 'true')
		appendRail(thumb)
	}
	const scroll = document.createElement('div')
	scroll.setAttribute('data-input-scroll', '')
	const editor = document.createElement('div')
	editor.setAttribute('contenteditable', 'true')
	editor.setAttribute('role', 'textbox')
	editor.setAttribute('data-lexical-editor', 'true')
	editor.setAttribute('data-composer-input', '')
	editor.setAttribute('data-phase', phase)
	if (composing) editor.setAttribute('data-composer-composing', '')
	if (claimed) {
		const chip = document.createElement('span')
		chip.setAttribute('data-composer-command', 'goal')
		editor.appendChild(chip)
	}
	if (text !== '') editor.textContent = text
	else {
		const p = document.createElement('p')
		p.appendChild(document.createElement('br'))
		editor.appendChild(p)
	}
	scroll.appendChild(editor)
	card.appendChild(scroll)
	const row = document.createElement('div')
	if (commandMenu) {
		const plus = document.createElement('button')
		plus.setAttribute('type', 'button')
		plus.setAttribute('aria-haspopup', 'listbox')
		plus.setAttribute('aria-expanded', 'true')
		row.appendChild(plus)
	}
	const button = document.createElement('button')
	button.setAttribute('type', 'button')
	button.className = 'uV2eYG_primary'
	button.setAttribute('aria-label', stop ? '停止生成' : '发送消息')
	button.disabled = sendDisabled
	if (sending) button.setAttribute('data-sending', '')
	// 停止按钮的图标是 svg > rect（方块），发送按钮是 svg > path（箭头）。
	if (stop) button.innerHTML = '<svg viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10"></rect></svg>'
	else button.innerHTML = '<svg viewBox="0 0 16 16"><path d="M8 1v14"></path></svg>'
	row.appendChild(button)
	card.appendChild(row)
	document.body.appendChild(card)
	return { dom, document, card, editor, button }
}

/** 在 jsdom 里装载 bundle：window/document 指向真实 DOM，事件与元素查询都走浏览器 API。 */
function loadPluginInDom(dom) {
	const source = readFileSync(clientPath, 'utf8')
	let entry
	dom.window.__ModuleLoader__ = { load: (value) => (entry = value) }
	const sandbox = { window: dom.window, document: dom.window.document, console }
	vm.createContext(sandbox)
	vm.runInContext(source, sandbox, { filename: clientPath })
	assert.ok(entry !== undefined, 'bundle 必须调用 window.__ModuleLoader__.load')
	const modules = {
		'react': { createElement: (type, props, ...children) => ({ type, props: { ...props, children }, key: props?.key }) },
		'react/jsx-runtime': recordingJsxRuntime()
	}
	const requireFn = (spec) => {
		if (Object.hasOwn(modules, spec)) return modules[spec]
		throw new Error(`测试模块表缺少 "${spec}"`)
	}
	return { id: entry.id, exports: entry.factory(requireFn) }
}

/** 装载并 apply：手动时钟 + 告警收集器 + 卸载函数。 */
function bootComposer(dom) {
	const clock = makeClock()
	dom.window.setTimeout = clock.setTimeout
	dom.window.clearTimeout = clock.clearTimeout
	const warnings = []
	dom.window.console = { warn: (...args) => warnings.push(args.join(' ')) }
	const plugin = loadPluginInDom(dom)
	const disposers = []
	plugin.exports.apply({
		effect(fn) {
			const dispose = fn()
			if (typeof dispose === 'function') disposers.push(dispose)
		},
		slots: {
			inject: (name, factory) => {
				factory()
				return () => {}
			},
			register: () => () => {}
		}
	})
	return {
		plugin,
		clock,
		warnings,
		dispose: () => disposers.reverse().forEach((fn) => fn())
	}
}

/** 派发一次 pointerdown（bubbles + cancelable，和真实手势一样会经过 document 捕获阶段）。 */
function pointerDown(dom, target, init = {}) {
	const event = new dom.window.MouseEvent('pointerdown', {
		bubbles: true,
		cancelable: true,
		button: 0,
		clientX: 8,
		clientY: 8,
		...init
	})
	target.dispatchEvent(event)
	return event
}

/** 让 execCommand('insertText') 真正写入 editor.textContent，可选同时把按钮变为可用。 */
function stubInsertText(document, editor, { enableButton = null } = {}) {
	const calls = []
	document.execCommand = (command, ui, text) => {
		calls.push({ command, text })
		editor.textContent = text
		if (enableButton !== null) enableButton.disabled = false
		return true
	}
	return calls
}

domTest('空输入点发送：自动填入固定文案并只提交一次', () => {
	const { dom, document, editor, button } = makeComposerDom()
	let submits = 0
	button.addEventListener('click', () => {
		submits += 1
	})
	const calls = stubInsertText(document, editor, { enableButton: button })
	bootComposer(dom)

	const event = pointerDown(dom, button)
	assert.equal(event.defaultPrevented, true, '接管后必须 preventDefault')
	assert.equal(editor.textContent, EMPTY_SEND_TEXT, '编辑器里要出现固定文案')
	assert.deepEqual(calls.map((call) => call.text), [EMPTY_SEND_TEXT], '优先走 execCommand insertText')
	assert.equal(submits, 1, '按钮变可用后只点一次')
})

domTest('execCommand 不可用时退回 paste 事件写入（模拟 Lexical 的粘贴处理）', () => {
	const { dom, document, editor, button } = makeComposerDom()
	// jsdom 没有 DataTransfer / ClipboardEvent：补一个最小实现，验证 paste 兜底的载荷。
	dom.window.DataTransfer = class {
		constructor() {
			this.data = new Map()
		}
		setData(type, value) {
			this.data.set(type, value)
		}
		getData(type) {
			return this.data.get(type) ?? ''
		}
	}
	dom.window.ClipboardEvent = class extends dom.window.Event {
		constructor(type, init = {}) {
			super(type, init)
			this.clipboardData = init.clipboardData
		}
	}
	let submits = 0
	button.addEventListener('click', () => {
		submits += 1
	})
	document.execCommand = () => false
	let pasted = null
	editor.addEventListener('paste', (event) => {
		pasted = event.clipboardData?.getData?.('text/plain') ?? null
		editor.textContent = pasted ?? ''
		button.disabled = false
	})
	bootComposer(dom)

	const event = pointerDown(dom, button)
	assert.equal(event.defaultPrevented, true)
	assert.equal(pasted, EMPTY_SEND_TEXT, '粘贴事件必须带 text/plain 数据')
	assert.equal(editor.textContent, EMPTY_SEND_TEXT)
	assert.equal(submits, 1)
})

domTest('paste 也没人接时退回直接写 DOM 再发 input 事件', () => {
	const { dom, document, editor, button } = makeComposerDom()
	let submits = 0
	button.addEventListener('click', () => {
		submits += 1
	})
	document.execCommand = () => false
	// 模拟 Lexical 收到 input 后把草稿同步进 store、按钮变可用。
	editor.addEventListener('input', () => {
		button.disabled = false
	})
	bootComposer(dom)

	const event = pointerDown(dom, button)
	assert.equal(event.defaultPrevented, true)
	assert.equal(editor.textContent, EMPTY_SEND_TEXT)
	assert.equal(submits, 1, '兜底写入后仍要提交一次')
})

domTest('非空输入不接管：不写文本、不点击、不拦事件', () => {
	const { dom, document, editor, button } = makeComposerDom({ text: '已经写好的内容' })
	let submits = 0
	button.addEventListener('click', () => {
		submits += 1
	})
	const calls = stubInsertText(document, editor, { enableButton: button })
	bootComposer(dom)

	const event = pointerDown(dom, button)
	assert.equal(event.defaultPrevented, false)
	assert.equal(editor.textContent, '已经写好的内容')
	assert.equal(calls.length, 0)
	assert.equal(submits, 0)
})

domTest('停止按钮与「正在发送」按钮绝不接管', () => {
	for (const [label, options] of [['停止按钮', { stop: true }], ['正在发送', { sending: true }]]) {
		const { dom, document, editor, button } = makeComposerDom(options)
		let submits = 0
		button.addEventListener('click', () => {
			submits += 1
		})
		let execCalls = 0
		document.execCommand = () => {
			execCalls += 1
			return true
		}
		bootComposer(dom)

		const event = pointerDown(dom, button)
		assert.equal(event.defaultPrevented, false, `${label}：不应接管`)
		assert.equal(execCalls, 0, `${label}：不应写入`)
		assert.equal(submits, 0, `${label}：不应点击`)
	}
})

domTest('附件、上传中、组合输入、slash 命令与命令菜单都不接管', () => {
	const cases = [
		['附件', { attachments: true }],
		['上传中', { uploading: true }],
		['编辑器组合输入', { composing: true }],
		['已认领 slash 命令', { claimed: true }],
		['提交中', { phase: 'submitting' }],
		['命令菜单', { commandMenu: true }]
	]
	for (const [label, options] of cases) {
		const { dom, document, editor, button } = makeComposerDom(options)
		let execCalls = 0
		document.execCommand = () => {
			execCalls += 1
			return true
		}
		bootComposer(dom)

		const event = pointerDown(dom, button)
		assert.equal(event.defaultPrevented, false, `${label}：不应接管`)
		assert.equal(execCalls, 0, `${label}：不应写入`)
		assert.equal(editor.textContent?.includes(EMPTY_SEND_TEXT), false, `${label}：不应写入固定文案`)
	}

	// pointerdown 事件本身带 isComposing（组合输入期间的事件）
	const { dom, document, editor, button } = makeComposerDom()
	let execCalls = 0
	document.execCommand = () => {
		execCalls += 1
		return true
	}
	bootComposer(dom)
	const event = new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true })
	Object.defineProperty(event, 'isComposing', { value: true })
	button.dispatchEvent(event)
	assert.equal(event.defaultPrevented, false, '事件 isComposing=true 时不应接管')
	assert.equal(execCalls, 0)
	assert.equal(editor.textContent?.includes(EMPTY_SEND_TEXT), false)
})

domTest('重入保护：接管期间重复 pointerdown 只提交一次，迟到 click 也被吞掉', () => {
	const { dom, document, editor, button } = makeComposerDom()
	let submits = 0
	button.addEventListener('click', () => {
		submits += 1
	})
	// 写入成功但按钮还没变可用（等 React 重渲染），此时第二个 pointerdown 必须被吞掉。
	document.execCommand = (command, ui, text) => {
		editor.textContent = text
		return true
	}
	const { clock } = bootComposer(dom)

	const first = pointerDown(dom, button)
	assert.equal(first.defaultPrevented, true)
	const second = pointerDown(dom, button)
	assert.equal(second.defaultPrevented, true, '重入的 pointerdown 也要拦下')
	assert.equal(submits, 0, '按钮还没变可用，不应点击')

	button.disabled = false
	clock.flush(1) // 推进一次轮询：按钮可用 → 程序化点击一次
	assert.equal(submits, 1, '只提交一次')

	// 同一次手势在 pointerup 之后还可能补发一个原生 click：短暂窗口内吞掉，避免二次提交。
	const late = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })
	button.dispatchEvent(late)
	assert.equal(late.defaultPrevented, true, '迟到的原生 click 必须被吞掉')
	assert.equal(submits, 1, '不会提交第二次')

	clock.flush()
	assert.equal(clock.pending, 0, '守卫与轮询都到点清理干净')
})

domTest('等待按钮可用超时：只 warn 一次、不点击、不崩', () => {
	const { dom, document, editor, button } = makeComposerDom()
	let submits = 0
	button.addEventListener('click', () => {
		submits += 1
	})
	document.execCommand = (command, ui, text) => {
		editor.textContent = text
		return true
	}
	const { clock, warnings } = bootComposer(dom)

	const event = pointerDown(dom, button)
	assert.equal(event.defaultPrevented, true)
	assert.doesNotThrow(() => clock.flush())
	assert.equal(submits, 0, '按钮一直不可用就不该点击')
	assert.equal(warnings.length, 1, `只 warn 一次：${JSON.stringify(warnings)}`)
	assert.match(warnings[0], /超时/)
})

domTest('写入失败不崩：只 warn 一次、不点击', () => {
	const { dom, document, editor, button } = makeComposerDom()
	let submits = 0
	button.addEventListener('click', () => {
		submits += 1
	})
	document.execCommand = () => {
		throw new Error('execCommand 不可用')
	}
	// 三级兜底都写不进去：连 DOM 兜底的 textContent 也拒绝写入。
	Object.defineProperty(editor, 'textContent', {
		configurable: true,
		get: () => '',
		set: () => {
			throw new Error('没有写入权限')
		}
	})
	const { warnings } = bootComposer(dom)

	let event
	assert.doesNotThrow(() => {
		event = pointerDown(dom, button)
	})
	assert.equal(event.defaultPrevented, true, '已接管的手势仍要拦下')
	assert.equal(submits, 0)
	assert.equal(warnings.length, 1, `只 warn 一次：${JSON.stringify(warnings)}`)
	assert.match(warnings[0], /写入文本失败/)
})

domTest('坐标兜底：pointerdown 落在父节点（disabled 按钮事件被重定向）也能接管', () => {
	const { dom, document, editor, button, card } = makeComposerDom()
	let submits = 0
	button.addEventListener('click', () => {
		submits += 1
	})
	document.elementFromPoint = () => button
	const calls = stubInsertText(document, editor, { enableButton: button })
	bootComposer(dom)

	const event = pointerDown(dom, card)
	assert.equal(event.defaultPrevented, true)
	assert.equal(editor.textContent, EMPTY_SEND_TEXT)
	assert.equal(calls.length, 1)
	assert.equal(submits, 1)
})

domTest('双击：冷却窗口内的第二次点击被吞掉，不会把「继续任务」发两遍', () => {
	const { dom, document, editor, button } = makeComposerDom()
	let submits = 0
	button.addEventListener('click', () => {
		submits += 1
	})
	const calls = stubInsertText(document, editor, { enableButton: button })
	const { clock } = bootComposer(dom)

	pointerDown(dom, button)
	assert.equal(submits, 1, '第一次点击提交')
	assert.equal(calls.length, 1)

	// 冷却窗口内用户又点了一次（此时输入框可能已被清空、按钮又变回 disabled）。
	button.disabled = true
	const second = pointerDown(dom, button)
	assert.equal(second.defaultPrevented, true, '冷却期内仍要拦下，避免重复发送')
	assert.equal(submits, 1, '不会提交第二次')
	assert.equal(calls.length, 1, '也不会再写一次文案')

	clock.flush()
	// 冷却结束后恢复正常：下一次点击可以照常接管（宿主提交后已把草稿清空）。
	editor.textContent = ''
	button.disabled = true
	pointerDown(dom, button)
	assert.equal(submits, 2, '冷却结束后重新可接管')
})

domTest('卸载后不再接管：监听、轮询与守卫都清理干净', () => {
	const { dom, document, editor, button } = makeComposerDom()
	let submits = 0
	button.addEventListener('click', () => {
		submits += 1
	})
	const calls = stubInsertText(document, editor, { enableButton: button })
	const { clock, dispose } = bootComposer(dom)
	dispose()

	const event = pointerDown(dom, button)
	assert.equal(event.defaultPrevented, false)
	assert.equal(calls.length, 0)
	assert.equal(submits, 0)
	assert.equal(clock.pending, 0)
})