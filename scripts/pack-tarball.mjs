/**
 * Build a publishable npm tarball without `npm pack`.
 *
 * Why: `npm pack` produced tarballs whose gzip CRC is invalid for our two large
 * members (~22 MB / 33 MB) on this machine, so `npm publish` rejected them with
 * `zlib: incorrect data check`. This script stages exactly the files declared by
 * the package's `files` field and asks the system `tar` to archive them, then
 * verifies the gzip stream before anything is published.
 *
 * Usage: node scripts/pack-tarball.mjs <package-dir> <out.tgz>
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import zlib from 'node:zlib'

const [packageDir, outFile] = process.argv.slice(2)
if (packageDir === undefined || outFile === undefined) {
  console.error('usage: node scripts/pack-tarball.mjs <package-dir> <out.tgz>')
  process.exit(2)
}

const root = resolve(packageDir)
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

/** Expand one `files` entry into absolute source paths. */
function expand(entry) {
  const literal = join(root, entry)
  if (existsSync(literal)) {
    const stat = statSync(literal)
    if (stat.isFile()) return [entry]
    const found = []
    const walk = (relative) => {
      for (const child of readdirSync(join(root, relative), { withFileTypes: true })) {
        const next = `${relative}/${child.name}`
        if (child.isDirectory()) walk(next)
        else if (child.isFile()) found.push(next)
      }
    }
    walk(entry)
    return found
  }
  if (!entry.includes('*')) return []
  // Single-segment wildcard such as `docs/*.svg`.
  const dir = dirname(entry)
  const pattern = new RegExp(`^${entry.split('/').pop().replace(/[.]/g, '\\.').replace(/\*/g, '[^/]*')}$`)
  if (!existsSync(join(root, dir))) return []
  return readdirSync(join(root, dir), { withFileTypes: true })
    .filter(child => child.isFile() && pattern.test(child.name))
    .map(child => `${dir}/${child.name}`)
}

const files = new Set(['package.json'])
for (const entry of manifest.files ?? []) {
  for (const file of expand(entry)) files.add(file)
}

const stageRoot = mkdtempSync(join(tmpdir(), 'dsh-pack-'))
const stagePackage = join(stageRoot, 'package')
mkdirSync(stagePackage, { recursive: true })
for (const file of files) {
  const destination = join(stagePackage, ...file.split('/'))
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(join(root, ...file.split('/')), destination)
}

const out = resolve(outFile)
mkdirSync(dirname(out), { recursive: true })
// stdio: 'inherit' — this sandbox forbids capturing a child's piped stdio.
const tar = spawnSync('tar', ['-czf', out, '-C', stageRoot, 'package'], { stdio: 'inherit' })
rmSync(stageRoot, { recursive: true, force: true })
if (tar.status !== 0) {
  console.error(`tar failed with status ${String(tar.status)}`)
  process.exit(1)
}

const bytes = readFileSync(out)
zlib.gunzipSync(bytes) // throws on a bad CRC; npm would reject such a tarball
console.log(`${manifest.name}@${manifest.version}: ${files.size} files, ${(bytes.length / 1048576).toFixed(2)} MiB`)
console.log(out)
