/**
 * Self-contained regression test for the host-half /video route.
 *
 * No ffmpeg or external fixtures required: it fabricates a byte file in a temp
 * dir, mounts the host half against a real node http server, and asserts the
 * Range/security semantics (200 full, 206 ranges, suffix range, 416, 403 path
 * escape, cross-site 403, HEAD, POST 405).
 *
 * Fish-fork additions: the trust-list resolution chain is exercised with
 * `webRuntime` absent (the DSH >= 0.2.1-alpha.2 shape), with `connection`
 * present instead, and with neither — all three must mount and fence correctly
 * rather than leaving the row pending.
 *
 * Requests use node:http rather than fetch(): the fence keys on the `Host`
 * header, and fetch() (undici) silently drops `Host` as a forbidden header,
 * which would make the authority assertions test nothing.
 *
 *   node test/route.test.mjs
 */
import { createServer, request as httpRequest } from 'node:http'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const mod = require('../index.js')

// --- fixture: a deterministic byte blob standing in for a video file --------
const root = mkdtempSync(join(tmpdir(), 'dsh-video-preview-'))
const file = join(root, 'clip.mp4')
const bytes = Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 31 + 7) % 256))
writeFileSync(file, bytes)
const size = bytes.length

let pass = 0
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`) }
  else { console.log(`  ✗ FAIL ${name}${extra ? ' — ' + extra : ''}`); process.exitCode = 1 }
}

/** Mount the host half against a fake cordis ctx and expose its handler. */
async function mount(ctxServices) {
  let handler = null
  const fakeCtx = {
    sessions: { get: (id) => (id === 'sess-1' ? { header: { cwd: root } } : undefined) },
    webServer: { register: (entry) => { handler = entry.handler; return () => {} } },
    effect: (fn) => { fn(); return () => {} },
    ...ctxServices,
  }
  await mod.apply(fakeCtx)
  return handler
}

/** Bring up a real server around a handler; resolves to {port, close}. */
async function listen(handler) {
  const server = createServer((r, res) => handler(r, res))
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  return { port: server.address().port, close: () => server.close() }
}

/** Raw request that can set a `Host` header (fetch cannot). */
function raw(port, path, { method = 'GET', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, buf: Buffer.concat(chunks) }))
    })
    req.on('error', reject)
    req.end()
  })
}

const q = (p) => `/video?sessionId=sess-1&path=${encodeURIComponent(p)}`

// ── 1. the DSH >= 0.2.1-alpha.2 shape: no webRuntime at all ────────────────
console.log('\n[1] webRuntime absent (the shape this fork exists for)')
check('inject does not require the removed service', !mod.inject.includes('webRuntime'), `inject = [${mod.inject.join(', ')}]`)

const handler = await mount({ connection: { trustedHosts: [] } })
const s1 = await listen(handler)
const p1 = s1.port

const r1 = await raw(p1, q(file))
check('GET 200', r1.status === 200)
check('content-type video/mp4', r1.headers['content-type'] === 'video/mp4')
check('accept-ranges bytes', r1.headers['accept-ranges'] === 'bytes')
check('full body equals file', r1.buf.equals(bytes))

const r2 = await raw(p1, q(file), { headers: { range: 'bytes=0-99' } })
check('range 206', r2.status === 206)
check('content-range', r2.headers['content-range'] === `bytes 0-99/${size}`)
check('slice 0..99', r2.buf.equals(bytes.subarray(0, 100)))

const r3 = await raw(p1, q(file), { headers: { range: 'bytes=100-' } })
check('open-ended range 206', r3.status === 206)
check('slice 100..end', r3.buf.equals(bytes.subarray(100)))

const r4 = await raw(p1, q(file), { headers: { range: 'bytes=-50' } })
check('suffix range 206', r4.status === 206)
check('suffix slice', r4.buf.equals(bytes.subarray(size - 50)))

const r5 = await raw(p1, q(file), { headers: { range: 'bytes=999999-' } })
check('unsatisfiable 416', r5.status === 416)
check('416 content-range */', r5.headers['content-range'] === `bytes */${size}`)

const r6 = await raw(p1, q('/etc/hosts'))
check('outside-cwd 403', r6.status === 403)

const r7 = await raw(p1, '/video?sessionId=sess-1&path=' + encodeURIComponent('relative.mp4'))
check('relative path 400', r7.status === 400)

const r8 = await raw(p1, q(file), { headers: { 'sec-fetch-site': 'cross-site', origin: 'http://evil.example' } })
check('cross-site 403', r8.status === 403)

const r9 = await raw(p1, q(file), { method: 'HEAD' })
check('HEAD 200', r9.status === 200)
check('HEAD empty body', r9.buf.length === 0)

const r10 = await raw(p1, q(file), { method: 'POST' })
check('POST 405', r10.status === 405)

s1.close()

// ── 2. the trust chain: webRuntime wins, connection is the fallback ────────
console.log('\n[2] trust-list resolution chain')
const viaWebRuntime = await mount({
  webRuntime: { trustedHosts: ['media.example:9000'] },
  connection: { trustedHosts: [] },
})
const s2 = await listen(viaWebRuntime)
const ok2 = await raw(s2.port, q(file), { headers: { host: 'media.example:9000' } })
check('webRuntime authority accepted', ok2.status === 200)
const bad2 = await raw(s2.port, q(file), { headers: { host: 'other.example:9000' } })
check('unknown authority refused', bad2.status === 403, `status=${bad2.status}`)
const bad2b = await raw(s2.port, q(file), { headers: { host: 'media.example:9999' } })
check('wrong port refused', bad2b.status === 403, `status=${bad2b.status}`)
s2.close()

const viaConnection = await mount({ connection: { trustedHosts: ['media.example:9000'] } })
const s3 = await listen(viaConnection)
const ok3 = await raw(s3.port, q(file), { headers: { host: 'media.example:9000' } })
check('connection authority accepted when webRuntime is gone', ok3.status === 200)
const bad3 = await raw(s3.port, q(file), { headers: { host: 'other.example:9000' } })
check('connection fallback still fences', bad3.status === 403, `status=${bad3.status}`)
s3.close()

// ── 3. neither service: must still mount, loopback-only ───────────────────
console.log('\n[3] no trust service at all (loopback-only fallback)')
const bare = await mount({})
check('mounts without any trust service', typeof bare === 'function')
const s4 = await listen(bare)
const loopback = await raw(s4.port, q(file))
check('loopback still served', loopback.status === 200)
const remote = await raw(s4.port, q(file), { headers: { host: 'media.example:9000' } })
check('non-loopback refused (no widening)', remote.status === 403, `status=${remote.status}`)
s4.close()

console.log(`\n${pass} route checks passed (fixture dir ${root})`)
