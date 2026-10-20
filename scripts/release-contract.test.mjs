import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const json = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'))
const members = [
  'dsh-approval-guide', 'dsh-client-ui-git-graph-fish',
  'dsh-client-ui-task-board-fish', 'dsh-git-sync', 'dsh-session-archive-fish',
  'dsh-settings-nav-order', 'dsh-skill-lens-fish', 'dsh-ssh-fish',
  'dsh-usage-fish', 'dsh-visual-companion', 'dsh-agent-teams-fish',
].map(name => `@fish-under-sea/${name}`)

test('aggregate pins exactly eleven scoped 1.0.0 members', () => {
  const pkg = json('package.json')
  assert.equal(pkg.version, '1.0.0')
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), [...members].sort())
  for (const version of Object.values(pkg.dependencies)) assert.equal(version, '1.0.0')
})

test('all remaining workspace packages use scoped 1.0.0 identities', () => {
  const directories = readdirSync(new URL('packages/', root), { withFileTypes: true }).filter(entry => entry.isDirectory())
  assert.equal(directories.length, 10)
  for (const entry of directories) {
    const pkg = json(`packages/${entry.name}/package.json`)
    assert.ok(members.includes(pkg.name), pkg.name)
    assert.equal(pkg.version, '1.0.0', pkg.name)
    assert.equal(pkg.publishConfig.access, 'public', pkg.name)
    for (const name of ['README.md', 'README.en.md']) {
      const body = readFileSync(new URL(`packages/${entry.name}/${name}`, root), 'utf8')
      assert.ok(body.includes('1.0.0'), `${entry.name}/${name}`)
    }
  }
})

test('release workspace has no local AgentTeams override', () => {
  const require = createRequire(new URL('packages/dsh-skill-lens-fish/package.json', root))
  const { parse } = require('yaml')
  const workspace = parse(readFileSync(new URL('pnpm-workspace.yaml', root), 'utf8'))
  assert.equal(workspace.overrides?.['@fish-under-sea/dsh-agent-teams-fish'], undefined)
})

test('bundle rows match dependencies without duplicate ids or removed members', () => {
  const require = createRequire(new URL('packages/dsh-skill-lens-fish/package.json', root))
  const { parse } = require('yaml')
  const patch = parse(readFileSync(new URL('cordis.patch.yml', root), 'utf8'))
  const rows = patch.flatMap(layer => layer.insert ?? [])
  assert.equal(rows.length, 11)
  assert.equal(new Set(rows.map(row => row.id)).size, 11)
  assert.deepEqual(rows.map(row => row.name).sort(), [...members].sort())
  for (const row of rows) {
    if (row.name.endsWith('/dsh-agent-teams-fish')) continue
    const pkg = json(`packages/${row.name.split('/')[1]}/package.json`)
    const own = parse(readFileSync(new URL(`packages/${row.name.split('/')[1]}/${pkg.dsh.bundle.patch}`, root), 'utf8'))
    assert.ok(own.flatMap(layer => layer.insert ?? []).some(candidate => candidate.name === row.name && candidate.id === row.id), row.name)
  }
})

test('GitHub workflow only publishes tags without lifecycle checks', () => {
  const require = createRequire(new URL('packages/dsh-skill-lens-fish/package.json', root))
  const { parse } = require('yaml')
  const directory = new URL('.github/workflows/', root)
  assert.deepEqual(readdirSync(directory), ['release.yml'])
  const text = readFileSync(new URL('release.yml', directory), 'utf8')
  const workflow = parse(text)
  assert.deepEqual(Object.keys(workflow.on), ['push'])
  assert.deepEqual(Object.keys(workflow.on.push), ['tags'])
  assert.ok(text.includes('npm pack --ignore-scripts'))
})
