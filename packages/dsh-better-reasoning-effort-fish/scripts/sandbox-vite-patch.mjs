/**
 * 本地开发辅助：让 vite 的 Windows 网络驱动器探测在 DSH 文件沙箱下不再中断启动。
 *
 * 症状：`vitest` 启动即失败 ——
 *   Error: spawn EPERM
 *     at exec (node:child_process)
 *     at optimizeSafeRealPathSync (vite/dist/node/chunks/node.js)
 *
 * 原因：vite 在 Windows 上无条件执行一次 `exec("net use")`（管道捕获输出）来
 * 建立 UNC → 盘符映射表。DSH 沙箱禁止子进程使用管道 stdio，该调用**同步**抛出
 * EPERM；而它位于 vite 自己那个 `try` 块（只包住 realpathSync.native）之外，
 * 于是异常逃逸成配置加载失败。
 *
 * 处理：把那三行探测包进 try/catch —— 探测不到映射时回退到 `fs.realpathSync.native`
 * 的普通语义，这正是 vite 自己在“没有映射”分支上的选择。补丁幂等，重装依赖后
 * 需重跑本脚本：
 *
 *   node scripts/sandbox-vite-patch.mjs
 *
 * 只改本地 node_modules（该目录不入包、不入库），不影响发布产物。
 */
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const MARK = '// [dsh-sandbox-patch]'
const START = '\texec("net use", { windowsHide: true }, (error, stdout) => {'

// 结束锚用块终止符本身（`\n\t});`）：探测块内部没有这一缩进层级的序列，
// 而按内部文案匹配会踩到构建产物里不可见的字符差异。
const TERMINATOR = '\n\t});'

const require = createRequire(import.meta.url)
// 从 vite 包根拼 chunk 路径（入口是 <pkg>/dist/node/index.js，不能直接 dirname 一次）。
const vitePkg = require.resolve('vite/package.json')
const chunk = join(dirname(vitePkg), 'dist', 'node', 'chunks', 'node.js')

const code = await readFile(chunk, 'utf8')
if (code.includes(MARK)) {
  console.log(`already patched: ${chunk}`)
  process.exit(0)
}

const start = code.indexOf(START)
if (start === -1) {
  console.error('patch anchor not found — vite 版本可能已变，请人工核对 optimizeSafeRealPathSync')
  process.exit(1)
}
const end = code.indexOf(TERMINATOR, start)
if (end === -1) {
  console.error('patch terminator not found — vite 版本可能已变')
  process.exit(1)
}

const block = code.slice(start, end + TERMINATOR.length)
const replacement = `${MARK}\n\ttry {\n\t${block}\n\t} catch {\n\t\tsafeRealpathSync = fs.realpathSync.native;\n\t}`
await writeFile(chunk, code.slice(0, start) + replacement + code.slice(end + TERMINATOR.length))
console.log(`patched: ${chunk}`)