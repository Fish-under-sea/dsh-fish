import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { exportPrivateConfig, PRIVATE_EXPORT_DIR_NAME, PRIVATE_EXPORT_FILES, resolveExportDir, WHITE_LIST } from '../lib/index.js'

const SECRET = 'SENTINEL-TOKEN-DO-NOT-LOG-abc123'
const tempRoot = () => mkdtempSync(path.join(os.tmpdir(), 'dsh-private-export-'))
const writeFixture = (home, rel, content) => {
  const file = path.join(home, ...rel.split('/'))
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, content, 'utf8')
  return file
}
const cleanup = (t, root) => t.after(() => rmSync(root, { recursive: true, force: true }))

test('只导出 .credentials.yaml，不生成 README 或其他文件', (t) => {
  const root = tempRoot()
  cleanup(t, root)
  const home = path.join(root, 'home')
  const target = path.join(root, 'custom-export-location')
  const source = writeFixture(home, '.credentials.yaml', `DEEPSEEK_API_KEY: ${SECRET}\n`)
  writeFixture(home, 'channel-pack/state.json', `{"token":"${SECRET}"}`)
  writeFixture(home, 'channel-pack/auto-checkin.json', '{}')
  writeFixture(home, 'channel-pack/token-ledger.json', '{}')
  writeFixture(home, 'our-free-model/eac-user.json', `{"token":"${SECRET}"}`)

  assert.deepEqual(PRIVATE_EXPORT_FILES.map(({ rel }) => rel), ['.credentials.yaml'])
  assert.equal(WHITE_LIST.some((entry) => '.credentials.yaml' === entry || '.credentials.yaml'.startsWith(`${entry}/`)), false)
  assert.equal(resolveExportDir({ exportDir: target }), path.resolve(target))

  const result = exportPrivateConfig(home, { exportDir: target })
  const outDir = path.join(target, PRIVATE_EXPORT_DIR_NAME)
  assert.equal(result.ok, true)
  assert.deepEqual(result.exported, ['.credentials.yaml'])
  assert.deepEqual(result.missing, [])
  assert.equal(result.outDir, undefined)
  assert.deepEqual(readdirSync(outDir), ['.credentials.yaml'])
  assert.equal(readFileSync(path.join(outDir, '.credentials.yaml'), 'utf8'), readFileSync(source, 'utf8'))
  assert.equal(existsSync(path.join(outDir, 'README.md')), false)
  const log = result.log.join('\n')
  assert.equal(log.includes(SECRET), false)
  assert.equal(log.includes(root), false)
  assert.equal(log.includes('README'), false)
  if (process.platform !== 'win32') assert.equal(statSync(path.join(outDir, '.credentials.yaml')).mode & 0o777, 0o600)
})

test('默认位置动态解析桌面，桌面不可用时回退用户目录', () => {
  const expected = existsSync(path.join(os.homedir(), 'Desktop'))
    ? path.join(os.homedir(), 'Desktop')
    : os.homedir()
  assert.equal(resolveExportDir({}), expected)
})

test('缺少凭据时明确失败，且不生成空说明文件', (t) => {
  const root = tempRoot()
  cleanup(t, root)
  const home = path.join(root, 'empty-home')
  const target = path.join(root, 'target')
  mkdirSync(home, { recursive: true })

  const result = exportPrivateConfig(home, { exportDir: target })
  const outDir = path.join(target, PRIVATE_EXPORT_DIR_NAME)
  assert.equal(result.ok, false)
  assert.deepEqual(result.exported, [])
  assert.deepEqual(result.missing, ['.credentials.yaml'])
  assert.deepEqual(readdirSync(outDir), [])
  assert.equal(result.log.join('\n').includes(root), false)
})

test('导出目标不可创建时返回不含本机路径的错误', (t) => {
  const root = tempRoot()
  cleanup(t, root)
  const home = path.join(root, 'home')
  const parentFile = writeFixture(home, 'not-a-directory', 'x')
  const result = exportPrivateConfig(home, { exportDir: path.join(parentFile, 'child') })
  assert.equal(result.ok, false)
  assert.equal(result.log.join('\n').includes(root), false)
})
