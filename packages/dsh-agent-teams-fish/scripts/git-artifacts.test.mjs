import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { writeGitArtifactStamp, verifyGitArtifacts } from './git-artifacts.mjs'
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'agent-teams-artifact-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const put = (path, value = '') => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), value) }
  put('package.json', JSON.stringify({ name: 'test', version: '1.0.0', devDependencies: { typescript: '5.9.3' }, scripts: { build: 'compile' } }))
  for (const path of ['src/index.ts', 'lib/index.js', 'lib/client.js', 'lib/types/index.d.ts', 'lib/types/client/index.d.ts', 'tsconfig.json', 'tsconfig.client.json', 'tsdown.config.ts', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'scripts/clean-build.mjs', 'scripts/git-artifacts.mjs']) put(path)
  return { root, put }
}
test('complete build matches its stamp and README changes do not invalidate it', t => {
  const { root, put } = fixture(t); writeGitArtifactStamp(root); put('README.md', 'new instructions'); assert.equal(verifyGitArtifacts(root).schema, 1)
})
test('source changes require rebuilding', t => {
  const { root, put } = fixture(t); writeGitArtifactStamp(root); put('src/index.ts', 'changed'); assert.throws(() => verifyGitArtifacts(root), /stale or modified/)
})
test('dependency settings require rebuilding', t => {
  const { root, put } = fixture(t); writeGitArtifactStamp(root); put('pnpm-workspace.yaml', 'changed'); assert.throws(() => verifyGitArtifacts(root), /stale or modified/)
})
test('modified and extra output cannot pass the stamp', t => {
  const { root, put } = fixture(t); writeGitArtifactStamp(root); put('lib/extra.js', 'unexpected'); assert.throws(() => verifyGitArtifacts(root), /stale or modified/)
})
test('missing entry cannot be stamped as a valid build', t => {
  const { root } = fixture(t); rmSync(join(root, 'lib/client.js')); assert.throws(() => writeGitArtifactStamp(root), /Missing Git artifact/)
})
test('a source tree with no build stamp cannot pass', t => {
  const { root } = fixture(t); assert.throws(() => verifyGitArtifacts(root), /Missing Git artifact stamp/)
})
