# @fish-under-sea/dsh-agent-teams-fish

**2.0.1 · Upstream v0.1.29 synced · dsh-fish bundle member · Durable teams with Fish vendor artwork**

[简体中文](README.md)

## Installation and Compatibility

Since 2.0.1 this package lives in the [Fish-under-sea/dsh-fish](https://github.com/Fish-under-sea/dsh-fish) bundle repository as the workspace member `packages/dsh-agent-teams-fish`, built, versioned and released together with the other members; the former standalone repository no longer evolves separately.

```sh
# Bundle install (recommended, includes every member)
dsh plugin --profile <profile> add @fish-under-sea/dsh-fish@2.0.1

# Or install this member alone
dsh plugin --profile <profile> add @fish-under-sea/dsh-agent-teams-fish@2.0.1
```

The bundle already includes this member; do not mount twice. Restart DSH after installation. Requires Node `>=24.9`. Recommended Host: `0.2.2-rc.1`; older targets such as `0.2.1-rc.2` and `0.2.1-alpha.2` remain supported. [compatibility.json](compatibility.json) is the exact support authority; desktop and core versions are distinct.

## Features

- Plan and approve before execution: member orchestration, task DAGs, durable mailboxes and progress monitoring.
- Persistent members, failure handling, capability-based reassignment, stop/resume and Host-enforced route/model policies.
- Optional quality gates for requirements, implementation, verification, review, repair and integration, binding judgments to artifacts.
- Fish artwork: eighteen vendor identities, role and vendor portraits, custom artworkDir, brand marks and route-aware captain portraits. Missing art falls back vendor+role → vendor → role; not every vendor has every role.
- Preset-only Hosts receive member persona and tool restrictions inside the child context; missing or corrupt restrictions refuse dispatch.

## Migration and Configuration

The old unscoped npm name `dsh-agent-teams-fish` moves to this scope. Update direct dependencies, bundle names and profile override `name` values, keeping `id: agent-teams`; never load both sources. State defaults to workspace `.agent-teams`, memberProvider to `spawn`; artworkDir is machine-local. Neither the rename nor the repository merge changes configuration fields or the team data format.

Back up securely first. Members consume real model quota. Tool policies are deployment-owned and cannot be bypassed by renaming. The plugin does not auto-repair logs, delete historical events or replay interrupted work; diagnose old corruption separately.

## Development Checks

Build artifacts under `lib/` are committed with the source, so publishing does not depend on a local build; `src/` and the build configuration are kept in full for rebuilds. Inside the bundle repository, run these commands manually as needed:

```sh
pnpm install --frozen-lockfile
pnpm --filter @fish-under-sea/dsh-agent-teams-fish typecheck
pnpm --filter @fish-under-sea/dsh-agent-teams-fish build
pnpm --filter @fish-under-sea/dsh-agent-teams-fish verify
```

Maintainers decide when to build and check before a release. Runtime approvals and optional quality-task rules are unchanged. The `dsh-agent-teams-doctor` command inspects manifests and dependency closure only; it does not prove runtime behavior or identify the current process. Real Host and UI acceptance are separate.

## Attribution and History

Based on [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams) (original author Relakkes / 程序员阿江). MIT. Upstream READMEs, NOTICE and release history are preserved. The source baseline follows upstream tag v0.1.29 (commit 369c278); since 2.0.1 the package is vendored into the dsh-fish bundle repository and versioned with it.

- [2.0.1](release-notes/v2.0.1.md)
- [1.1.0](release-notes/v1.1.0.md)
- [1.0.2](release-notes/v1.0.2.md)
- [1.0.1](release-notes/v1.0.1.md)
- [1.0.0](release-notes/v1.0.0.md)
- [Historical notes](https://github.com/Fish-under-sea/dsh-fish/tree/main/packages/dsh-agent-teams-fish/release-notes)
- [NOTICE](NOTICE.md)