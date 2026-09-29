/**
 * dsh-git-sync Web 半边（lib/client.js）的装载冒烟测试。
 *
 * DSH 的浏览器侧用 `window.__ModuleLoader__.load({ id, factory })` 装载模块，
 * 而 loader 是按**行里解析出的包名**去 factories 里认领的
 * （见 @deepseek-ai/dsh-client-modules/lib/client.js：
 * `if (!this.factories.has(id)) throw ... loaded without registering`）。
 * 所以 bundle 的注册名必须严格等于 package.json 的 `name`——包名一旦带 scope，
 * 注册名也要跟着带，否则插件在浏览器侧加载失败。
 *
 * 运行：node test/client.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const clientPath = join(here, '..', 'lib', 'client.js')
/** 包清单：注册名必须等于包名，这里直接读 name 而不硬编码，改名后测试不会跟着漂移。 */
const PKG = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'))

/** 在假 window 里执行 bundle，返回它注册给 loader 的那条定义。 */
function loadEntry() {
	let entry
	const sandbox = {
		window: { __ModuleLoader__: { load: (value) => (entry = value) } },
		console
	}
	vm.createContext(sandbox)
	vm.runInContext(readFileSync(clientPath, 'utf8'), sandbox, { filename: clientPath })
	return entry
}

test('bundle 注册名等于包名（loader 按包名认领 factory）', () => {
	const entry = loadEntry()
	assert.ok(entry !== undefined, 'bundle 必须调用 window.__ModuleLoader__.load')
	assert.equal(entry.id, PKG.name)
})

test('bundle 注册的 factory 能实例化并导出 apply / inject', () => {
	const entry = loadEntry()
	const react = {
		createElement: (type, props, ...children) => ({ type, props: { ...(props ?? {}), children }, key: props?.key }),
		useState: (initial) => [initial, () => {}],
		useEffect: () => {},
		useRef: (initial) => ({ current: initial }),
		useCallback: (fn) => fn,
		useMemo: (fn) => fn()
	}
	const requireFn = (spec) => {
		if (spec === 'react') return react
		throw new Error(`测试模块表缺少 "${spec}"`)
	}
	const exports = entry.factory(requireFn)
	assert.equal(typeof exports.apply, 'function')
	// vm 世界里造的数组与本 realm 原型不同，展开后再比较。
	assert.deepEqual(Array.from(exports.inject), ['slots'])
})