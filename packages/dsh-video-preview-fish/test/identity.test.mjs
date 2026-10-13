/**
 * Identity-contract check: the three places the package name must agree.
 *
 * dsh-client-modules claims a browser bundle's factory by the id the plugin row
 * resolved from `package.json` `name`; a mismatch throws
 * `loaded without registering "<name>"` and the whole client half is dropped.
 * The aggregate bundle and this package's own patch must also name the same
 * package, or the row resolves to nothing.
 *
 *   node test/identity.test.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(here, '..')

let pass = 0
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`) }
  else { console.log(`  ✗ FAIL ${name}${extra ? ' — ' + extra : ''}`); process.exitCode = 1 }
}

const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'))
const client = readFileSync(join(pkgRoot, 'client.js'), 'utf8')
const patch = readFileSync(join(pkgRoot, 'cordis.patch.yml'), 'utf8')

console.log('\nidentity contract')
check('package.json name is scoped for the fork', pkg.name === '@fish-under-sea/dsh-video-preview-fish', pkg.name)

const loadId = /__ModuleLoader__\.load\(\{\s*\n?\s*id:\s*"([^"]+)"/.exec(client)
check('client registers a module id', loadId !== null)
check('client registration id equals the package name', loadId?.[1] === pkg.name, `id=${loadId?.[1]}`)

const rowMatch = /-\s*insert:[\s\S]*?-\s*id:\s*(\S+)\s*\n\s*name:\s*'([^']+)'/.exec(patch)
check('patch inserts a row', rowMatch !== null)
check('patch row name equals the package name', rowMatch?.[2] === pkg.name, `row name=${rowMatch?.[2]}`)

console.log('\nhost half contract')
const host = readFileSync(join(pkgRoot, 'index.js'), 'utf8')
const nameExport = /export const name = '([^']+)'/.exec(host)
check('host exports its name', nameExport !== null)
check('host name equals the package name', nameExport?.[1] === pkg.name, `name=${nameExport?.[1]}`)
check('host does not inject the removed webRuntime', !/export const inject = \[[^\]]*'webRuntime'/.test(host))

console.log(`\n${pass} identity checks passed`)
