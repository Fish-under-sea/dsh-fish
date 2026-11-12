import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const json = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'))
const require = createRequire(new URL('packages/dsh-skill-lens-fish/package.json', root))
const { parse } = require('yaml')

// 2.0.0 起十一个成员全部在本仓库内，聚合包与成员统一版本。
const MEMBER_VERSION = '2.0.1'
const workspaceMembers = [
  'dsh-approval-guide', 'dsh-better-reasoning-effort-fish',
  'dsh-client-ui-task-board-fish', 'dsh-git-sync', 'dsh-session-archive-fish',
  'dsh-settings-nav-order', 'dsh-skill-lens-fish', 'dsh-ssh-fish',
  'dsh-usage-fish', 'dsh-visual-companion', 'dsh-agent-teams-fish',
].map(name => `@fish-under-sea/${name}`)
const members = workspaceMembers

const parsePatch = path => parse(readFileSync(new URL(path, root), 'utf8'), {
  customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: value => value }],
})

test('aggregate pins exactly eleven scoped members at their published version', () => {
  const pkg = json('package.json')
  assert.equal(pkg.version, '2.0.1')
  assert.equal(pkg.publishConfig.access, 'public')
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), [...members].sort())
  for (const [name, version] of Object.entries(pkg.dependencies)) {
    assert.equal(version, MEMBER_VERSION, name)
  }
})

test('all in-repository packages use scoped member identities', () => {
  const directories = readdirSync(new URL('packages/', root), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
  assert.equal(directories.length, 11)
  for (const entry of directories) {
    const pkg = json(`packages/${entry.name}/package.json`)
    assert.ok(workspaceMembers.includes(pkg.name), pkg.name)
    assert.equal(pkg.version, MEMBER_VERSION, pkg.name)
    assert.equal(pkg.publishConfig.access, 'public', pkg.name)
    for (const name of ['README.md', 'README.en.md']) {
      const body = readFileSync(new URL(`packages/${entry.name}/${name}`, root), 'utf8')
      assert.ok(body.includes(MEMBER_VERSION), `${entry.name}/${name}`)
    }
  }
})

test('release workspace has no local AgentTeams override', () => {
  const workspace = parse(readFileSync(new URL('pnpm-workspace.yaml', root), 'utf8'))
  assert.equal(workspace.overrides?.['@fish-under-sea/dsh-agent-teams-fish'], undefined)
})

// 子入口（如 .../redteam、.../redteam/store、.../redteam/ui）共用同一包名。
const packageRoot = name => name.split('/').slice(0, 2).join('/')

test('bundle rows mount every member under unique row ids', () => {
  const patch = parsePatch('cordis.patch.yml')
  const rows = patch.flatMap(layer => layer.insert ?? [])
  assert.equal(rows.length, members.length)
  const ids = rows.map(row => row.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual([...new Set(rows.map(row => packageRoot(row.name)))].sort(), [...members].sort())
})

test('bundle no longer rewrites the host system prompt', () => {
  const patch = parsePatch('cordis.patch.yml')
  const topLevel = patch.filter(layer => typeof layer.id === 'string')
  assert.equal(topLevel.length, 0)
})

test('in-repository members keep their own patch row id and name', () => {
  const patch = parsePatch('cordis.patch.yml')
  const rows = patch.flatMap(layer => layer.insert ?? [])
  for (const row of rows) {
    const directory = row.name.split('/')[1]
    const pkg = json(`packages/${directory}/package.json`)
    const own = parsePatch(`packages/${directory}/${pkg.dsh.bundle.patch}`)
    assert.ok(
      own.flatMap(layer => layer.insert ?? [])
        .some(candidate => candidate.name === row.name && candidate.id === row.id),
      row.name,
    )
  }
})

test('GitHub workflow only publishes tags without lifecycle checks', () => {
  const directory = new URL('.github/workflows/', root)
  assert.deepEqual(readdirSync(directory), ['release.yml'])
  const text = readFileSync(new URL('release.yml', directory), 'utf8')
  const workflow = parse(text)
  assert.deepEqual(Object.keys(workflow.on), ['push'])
  assert.deepEqual(Object.keys(workflow.on.push), ['tags'])
  assert.ok(text.includes('npm pack --ignore-scripts'))
})
