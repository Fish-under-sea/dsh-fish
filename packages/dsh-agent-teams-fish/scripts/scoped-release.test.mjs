import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const pkg = JSON.parse(text('package.json'))
// Vendored as a dsh-fish workspace member: CI workflows are not part of the
// package (the monorepo owns its own release flow), so workflow assertions
// only run in a standalone checkout that ships its own .github directory.
const hasWorkflows = existsSync(new URL('../.github/workflows/publish.yml', import.meta.url))
  && existsSync(new URL('../.github/workflows/verify.yml', import.meta.url))

test('2.0.0 release uses the Fish scope throughout the install contract', () => {
  assert.equal(pkg.name, '@fish-under-sea/dsh-agent-teams-fish')
  assert.equal(pkg.version, '2.0.0')
  assert.ok(text('cordis.patch.yml').includes("name: '@fish-under-sea/dsh-agent-teams-fish'"))
  assert.ok(text('scripts/doctor.mjs').includes("locatePackage('@fish-under-sea/dsh-agent-teams-fish'"))
})

test('both public READMEs document the scoped 2.0.0 install', () => {
  for (const file of ['README.md', 'README.en.md']) {
    assert.ok(text(file).includes('@fish-under-sea/dsh-agent-teams-fish@2.0.0'), file)
  }
})

test('runtime verification and benchmarks resolve the scoped installation path', () => {
  for (const file of ['scripts/harness-runtime-verify.mjs', 'scripts/harness-runtime-scenarios.mjs', 'scripts/harness-model-benchmark.mjs']) {
    assert.ok(!text(file).includes('node_modules/dsh-agent-teams-fish'), file)
    assert.ok(text(file).includes('node_modules/@fish-under-sea/dsh-agent-teams-fish'), file)
  }
})

test('publish workflow checks the current package identity before publishing', t => {
  if (!hasWorkflows) return t.skip('no .github workflows in the vendored workspace member')
  const workflow = text('.github/workflows/publish.yml')
  assert.ok(workflow.includes('PACKAGE_NAME: ${{ steps.version.outputs.package_name }}'))
  assert.ok(workflow.includes('npm view "${PACKAGE_NAME}@${PACKAGE_VERSION}"'))
  assert.ok(workflow.includes('npm view "${PACKAGE_NAME}" dist-tags.latest'))
})

test('verification is manual-only and tag publishing has no verification dependency', t => {
  if (hasWorkflows) {
    const verify = text('.github/workflows/verify.yml')
    assert.ok(verify.includes('workflow_dispatch:'))
    for (const trigger of ['pull_request:', 'branches: [main]', 'workflow_call:']) assert.ok(!verify.includes(trigger), trigger)
    const publish = text('.github/workflows/publish.yml')
    assert.ok(!publish.includes('uses: ./.github/workflows/verify.yml'))
    assert.ok(!publish.includes('needs: verify'))
    assert.ok(!publish.includes('scripts/release-metadata.mjs'))
  }
  assert.equal(JSON.parse(text('package.json')).scripts.prepublishOnly, undefined)
})