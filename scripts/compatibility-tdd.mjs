/**
 * 兼容性回归：每个包都必须带顶层 `engines.dsh`，且该范围在 DSH 自己的判定方式
 * （semver.satisfies + includePrerelease）下接受当前及后续 0.2.2 预发布线，
 * 拒绝更旧与下一条主线。
 *
 * 依据：@deepseek-ai/dsh-app-boot 的 plugin-compatibility.ts 只读顶层
 * `engines.dsh` 来决定插件是否可用；没有它时退化为逐个 @deepseek-ai peer 比对，
 * 于是 0.2.2-rc.4 这类新预发布就会把插件整行禁用（agent-teams 因此消失）。
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const semver = require('semver')

const dirs = readdirSync('packages', { withFileTypes: true }).filter(entry => entry.isDirectory())
const manifests = [
  'package.json',
  ...dirs.map(entry => `packages/${entry.name}/package.json`),
].map(path => ({ path, json: JSON.parse(readFileSync(path, 'utf8')) }))

const satisfies = (runtime, range) => semver.satisfies(runtime, range, { includePrerelease: true })

test('every package declares a top-level engines.dsh range', () => {
  for (const { path, json } of manifests) {
    assert.equal(typeof json.engines?.dsh, 'string', `${path} engines.dsh`)
    assert.notEqual(json.engines.dsh.trim(), '', `${path} engines.dsh`)
  }
})

test('engines.dsh accepts the current and next 0.2.2 prereleases', () => {
  for (const { path, json } of manifests) {
    for (const runtime of ['0.2.2-rc.3', '0.2.2-rc.4', '0.2.2', '0.2.2-rc.5', '0.2.3-alpha.1']) {
      assert.ok(satisfies(runtime, json.engines.dsh), `${path} should accept dsh ${runtime}`)
    }
  }
})

test('engines.dsh rejects unsupported and next-major runtimes', () => {
  for (const { path, json } of manifests) {
    for (const runtime of ['0.2.2-rc.2', '0.2.1-rc.2', '0.3.0', '1.0.0']) {
      assert.ok(!satisfies(runtime, json.engines.dsh), `${path} should reject dsh ${runtime}`)
    }
  }
})

test('dsh.engines.dsh mirrors the top-level range', () => {
  for (const { path, json } of manifests) {
    if (json.dsh?.engines?.dsh === undefined) continue
    assert.equal(json.dsh.engines.dsh, json.engines.dsh, `${path} dsh.engines.dsh`)
  }
})

test('compatibility.json lists 0.2.2-rc.4 as a supported host', () => {
  const compatibility = JSON.parse(readFileSync('packages/dsh-agent-teams-fish/compatibility.json', 'utf8'))
  const hosts = compatibility.supportedHosts.map(host => host.version)
  assert.ok(hosts.includes('0.2.2-rc.4'), `supported hosts: ${hosts.join(', ')}`)
  assert.ok(satisfies(compatibility.recommendedHost, '>=0.2.2-rc.3 <0.3.0'))
})
