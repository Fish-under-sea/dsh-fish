import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { discoverWorkspacePackages, inspectResolvedCohort, parseSourceArguments, selectSourceCandidate } from './harness-source-verify.mjs';

const baseArgs = ['--host-dir', '/host', '--artifact', '/plugin.tgz', '--report-dir', '/report'];
const commit = 'a'.repeat(40);
const candidate = { version: '0.2.0', commit, repository: 'https://github.com/deepseek-ai/deepseek-harness' };

test('source invocation cannot masquerade as an npm host-version verification', () => {
    assert.throws(() => parseSourceArguments([...baseArgs, '--host-version', '0.2.0']), /Unknown/);
    assert.throws(() => parseSourceArguments([...baseArgs, '--runtime-dir', '/existing-profile']), /Unknown/);
    assert.throws(() => parseSourceArguments(['--host-dir', '--artifact', 'file']), /Missing value/);
    assert.throws(() => parseSourceArguments([...baseArgs, '--artifact', 'other']), /duplicate/);
    assert.throws(() => parseSourceArguments(baseArgs.slice(0, -2)), /report-dir required/);
    assert.throws(() => parseSourceArguments([...baseArgs, '--scenario', 'pretend-pass']), /Unknown scenario/);
});

test('candidate acceptance requires the policy SHA and a clean source checkout', () => {
    const policy = { supportedHosts: [{ version: '0.1.7-rc.2' }], sourceCandidates: [candidate] };
    assert.equal(selectSourceCandidate(policy, undefined, commit, true), candidate);
    assert.equal(selectSourceCandidate(policy, '0.2.0', commit, true), candidate);
    assert.throws(() => selectSourceCandidate(policy, '0.1.7-rc.2', commit, true), /No matching/);
    assert.throws(() => selectSourceCandidate(policy, '0.2.0', 'b'.repeat(40), true), /does not match/);
    assert.throws(() => selectSourceCandidate(policy, '0.2.0', commit, false), /clean tracked/);
    assert.throws(() => selectSourceCandidate({ supportedHosts: ['0.2.0'] }, '0.2.0', commit, true), /No matching/);
});

function sandbox(t) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'agentteams-source-verifier-test-')));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    return root;
}

function manifest(root, path, name, extra = {}) {
    const directory = join(root, path);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ name, version: '0.1.7-rc.2', ...extra }));
    return directory;
}

test('workspace discovery ignores generated residue and rejects duplicate identities', t => {
    const root = sandbox(t);
    const paths = ['apps/cli', 'packages/boot/app-boot', 'vendor/cordis'];
    ['@deepseek-ai/dsh', '@deepseek-ai/dsh-app-boot', '@deepseek-ai/cordis'].forEach((name, index) => manifest(root, paths[index], name));
    manifest(root, 'packages/old/orphan', '@deepseek-ai/dsh-old');
    const files = paths.map(path => path + '/package.json');
    const discovered = discoverWorkspacePackages(root, [...files, 'packages/old/orphan/lib/package.json']);
    assert.equal(discovered.size, 3);
    assert.equal(discovered.has('@deepseek-ai/dsh-old'), false);
    manifest(root, 'packages/boot/duplicate', '@deepseek-ai/dsh-app-boot');
    assert.throws(() => discoverWorkspacePackages(root, [...files, 'packages/boot/duplicate/package.json']), /Duplicate/);
});

test('declared closure reports resolved versions and rejects a registry DSH duplicate', t => {
    const root = sandbox(t);
    const host = manifest(root, 'host', '@deepseek-ai/dsh', { dependencies: { '@deepseek-ai/dsh-agent': '*' } });
    const actual = manifest(root, 'host/node_modules/@deepseek-ai/dsh-agent', '@deepseek-ai/dsh-agent');
    const workspaces = new Map([
        ['@deepseek-ai/dsh', { directory: host }],
        ['@deepseek-ai/dsh-agent', { directory: actual }],
    ]);
    const result = inspectResolvedCohort(workspaces, [host]);
    assert.equal(result.count, 2);
    assert.equal(result.packages.find(pkg => pkg.name === '@deepseek-ai/dsh-agent').directory, actual);
    assert.equal(result.edges[0].directory, actual);
    workspaces.set('@deepseek-ai/dsh-agent', { directory: join(root, 'expected-source') });
    assert.throws(() => inspectResolvedCohort(workspaces, [host]), /Mixed source closure/);
    workspaces.delete('@deepseek-ai/dsh-agent');
    assert.throws(() => inspectResolvedCohort(workspaces, [host]), /outside tracked source workspace/);
});

test('missing required dependencies fail while unavailable optional platforms remain explicit', t => {
    const root = sandbox(t);
    const host = manifest(root, 'host', '@deepseek-ai/dsh', { optionalDependencies: { 'missing-platform-addon': '1.0.0' } });
    const workspaces = new Map([['@deepseek-ai/dsh', { directory: host }]]);
    const result = inspectResolvedCohort(workspaces, [host]);
    assert.equal(result.edges[0].missing, true);
    assert.equal(result.edges[0].optional, true);
    manifest(root, 'host', '@deepseek-ai/dsh', { dependencies: { 'missing-required-package': '1.0.0' } });
    assert.throws(() => inspectResolvedCohort(workspaces, [host]), /Cannot resolve/);
});

test('closure reads the package identity when export maps hide or redirect package.json', t => {
    const root = sandbox(t);
    const host = manifest(root, 'host', '@deepseek-ai/dsh', { dependencies: { 'esm-only-library': '*', 'redirected-library': '*' } });
    const esm = manifest(root, 'host/node_modules/esm-only-library', 'esm-only-library', { exports: { '.': { import: './entry.js' } } });
    const redirected = manifest(root, 'host/node_modules/redirected-library', 'redirected-library', { exports: { './*': './dist/*' } });
    mkdirSync(join(redirected, 'dist'));
    writeFileSync(join(redirected, 'dist/package.json'), JSON.stringify({ type: 'commonjs' }));
    const result = inspectResolvedCohort(new Map([['@deepseek-ai/dsh', { directory: host }]]), [host]);
    assert.equal(result.packages.find(pkg => pkg.name === 'esm-only-library').directory, esm);
    assert.equal(result.packages.find(pkg => pkg.name === 'redirected-library').directory, redirected);
    assert.equal(result.packages.length, 3);
});
