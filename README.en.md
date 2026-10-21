# @fish-under-sea/dsh-fish

<img src="icon.png" alt="Fish" width="96">

**1.0.3 · Twelve plugins, one bundle**

[简体中文](README.md)

## Installation

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-fish@1.0.3
```

Restart DSH after installation. With no desktop CLI, add the same package in the plugin manager. Requires Node `^22.19.0 || >=24`. AgentTeams recommends Host `0.2.0-rc.2`; `0.2.1-rc.2` remains preview-supported. Jailbreak targets `dshTarget` `0.2.1-rc.2` (upstream 1.1.71 baseline, with that release’s prompt-variable incompatibility fixed here). Every member retains its own Host compatibility declaration.

## What's New

Adds a twelfth member, **Jailbreak** (`@fish-under-sea/dsh-purge-fish`): injects replaceable cleaning prompts for every model, with one preset per model, plus a red-team bench (presets, skills, SQLite fact store and HTTP bridge). It is the only member that rewrites the host prompt — it disables the harness identity section, clears `personaPrefix`, replaces `personaSuffix` with a non-interpolating sentence, and disables five legacy red-team rows.

Retained from the previous release: Settings Navigation owns icons, localized titles and ordering for four extension commands, defaulting to **Agent Teams → Visual Companion → Context Compression → Cache Statistics** (`agent-teams → companion → acp → acp-cache`). Adjust and save under **Settings → 设置导航顺序 → 斜杠菜单顺序**; preferences live in the browser and `$DSH_HOME/dsh-settings-nav-order/state.json`.

All twelve members are currently **1.0.2**; the aggregate itself is **1.0.3** and still pins every dependency exactly.

## Included Plugins

All twelve members are currently **1.0.2**, with exact dependency pins. Ten members live here; AgentTeams and Jailbreak have their own repositories. The aggregate itself is **1.0.3**.

| Plugin | npm | Capabilities |
| --- | --- | --- |
| [Approval Guide](https://www.npmjs.com/package/@fish-under-sea/dsh-approval-guide) | `@fish-under-sea/dsh-approval-guide` | Adds Chinese action, risk and rationale explanations to approval prompts for files, commands, network access and privilege changes. |
| [Git Sync](https://www.npmjs.com/package/@fish-under-sea/dsh-git-sync) | `@fish-under-sea/dsh-git-sync` | Previews, commits, pulls and restores selected DSH configuration through a private Git repository; exports only `$DSH_HOME/.credentials.yaml` locally to a user-selected or dynamically resolved Desktop folder, never through Git sync. |
| [Settings Navigation](https://www.npmjs.com/package/@fish-under-sea/dsh-settings-nav-order) | `@fish-under-sea/dsh-settings-nav-order` | Reorders and hides settings entries; manages four extension commands’ icons, localized titles, descriptions and persisted default order. |
| [Visual Companion](https://www.npmjs.com/package/@fish-under-sea/dsh-visual-companion) | `@fish-under-sea/dsh-visual-companion` | Binds a visual-companion directory and delivers submitted selections and notes as a user message that wakes the target session; exposes arm, disarm, status and wake. |
| [Skill Lens](https://www.npmjs.com/package/@fish-under-sea/dsh-skill-lens-fish) | `@fish-under-sea/dsh-skill-lens-fish` | Lists, inspects, edits, creates, imports and deletes skills; graphs dependencies, supports directory SKILL.md and flat .md skills plus shared references, and follows DSH_HOME. |
| [Task Board](https://www.npmjs.com/package/@fish-under-sea/dsh-client-ui-task-board-fish) | `@fish-under-sea/dsh-client-ui-task-board-fish` | Host-authoritative task ledger, Kanban and subtasks; real DSH session execution, recurring cron and one-shot schedules with run budgets, opt-in goals, acceptance, team execution and idle-sleep protection. |
| [Git Graph](https://www.npmjs.com/package/@fish-under-sea/dsh-client-ui-git-graph-fish) | `@fish-under-sea/dsh-client-ui-git-graph-fish` | Visual commit history, blank-session branch selection, branch creation and switching, worktree management and conflict guards; the optional git_worktree agent tool is off by default. |
| [SSH Operations](https://www.npmjs.com/package/@fish-under-sea/dsh-ssh-fish) | `@fish-under-sea/dsh-ssh-fish` | Host inventory, pooled connections, persistent Web PTY terminals, SFTP, loopback tunnels and cluster execution; six agent tools share the GUI host configuration. |
| [Usage Monitor](https://www.npmjs.com/package/@fish-under-sea/dsh-usage-fish) | `@fish-under-sea/dsh-usage-fish` | Tracks token usage by provider and model, balances, subscription quotas, peak/off-peak cost estimates, Token Bank and a sidebar summary. |
| [Session Archive](https://www.npmjs.com/package/@fish-under-sea/dsh-session-archive-fish) | `@fish-under-sea/dsh-session-archive-fish` | Central session inventory and filtering, batch archive/unarchive, guarded cascade physical deletion, and optional automatic archival and retention rules. |
| [AgentTeams](https://www.npmjs.com/package/@fish-under-sea/dsh-agent-teams-fish) | `@fish-under-sea/dsh-agent-teams-fish` | Approved member dispatch, task DAGs, mailboxes, quality gates and repair rounds, durable recovery, Fish vendor/role artwork, eighteen vendor identities and route-aware captain avatars. |
| [Jailbreak](https://www.npmjs.com/package/@fish-under-sea/dsh-purge-fish) | `@fish-under-sea/dsh-purge-fish` | Injects replaceable cleaning prompts for every model with per-model presets; ships a red-team bench (presets, skills, SQLite fact store, HTTP bridge) and one-click rollback. Disables the harness identity section and legacy red-team rows. |

## Migration

- Securely back up `$DSH_HOME`, profile manifests and patches; separately back up local linked plugin source.
- AgentTeams moves to `@fish-under-sea/dsh-agent-teams-fish`. Replace old direct dependencies and bundle references, including any profile row overriding the old `name`. The `agent-teams` row id, `.agent-teams` state directory and configuration keys stay unchanged. Never mount old and new packages together.
- Jailbreak comes from upstream [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge) (MIT) v1.1.71, maintained here as `@fish-under-sea/dsh-purge-fish`; the `dsh-purge` row id and the `$DSH_HOME/redteam` data directory are unchanged. If the unscoped `dsh-purge` was installed standalone, remove that dependency in the plugin manager before adding this bundle so the row is not mounted twice.
- Better Reasoning Effort is no longer bundled. Use `dsh-better-reasoning-effort` from [HaoyueQin upstream](https://github.com/HaoyueQin/dsh-better-reasoning-effort), not the Fish fork.
- Video Preview is discontinued. OFM and the retired session-title plugin are not included and have no replacement dependency here. This release does not delete existing user data.
- Updating the aggregate does not automatically remove old standalone dependencies, bundles or profile overrides. Review and remove those entries in the plugin manager before restarting.
- Version migration does not repair corrupted historical sessions. Do not delete log events as an upgrade step.

## Coexistence and Data

Do not co-enable equivalent upstream `dsh-web-all` and Fish rows: distinct ids can still register the same services twice. Upstream Skill Lens shares the `skill-lens` id. This bundle inserts its own fifteen rows (Jailbreak alone accounts for four) and additionally disables five legacy red-team row ids (`redteam-store`, `redteam-ui`, `redteam-mode`, `redteam-mode/store`, `redteam-mode/ui`) and rewrites the `system-prompt` row to drop the harness identity section. Turn off the single `dsh-purge` row to skip Jailbreak. It never disables another package or the built-in title service.

Configuration and data stay in `$DSH_HOME` or the workspace without hard-coded machine paths. SSH credentials may be plaintext; physical session deletion is irreversible; Git sync is not a full backup; scheduling and teams consume real model quota. Read each member safety section.

## Development and Attribution

The following checks are optional manual commands, not commit or release gates. This repository has no push/PR verification workflow, and tag releases run neither builds nor tests. All in-repository packages share this policy; runtime permissions and data protection remain unchanged.

```sh
pnpm install --frozen-lockfile
pnpm test:release
pnpm -r --if-present typecheck
pnpm -r --if-present test
pnpm -r --if-present build
```

The aggregate has no runtime implementation: `cordis.patch.yml` mounts independently built and published members. Rebuild client modules for their real package identity. The aggregate version moves separately from member versions: 1.0.3 is the bundle’s own version, members stay pinned to their published versions, and no claim is made that every upstream HEAD is merged.

Fish-native: Approval Guide, Git Sync, Settings Navigation and Visual Companion. Fork sources:

- [x-feichen/dsh-skill-lens](https://github.com/x-feichen/dsh-skill-lens) · MIT
- [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web) · Apache-2.0
- [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams) · MIT
- [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge) · MIT

Original copyrights, member LICENSE files and NOTICE files are preserved. The aggregate is MIT. Historical changes are in [Changelog](CHANGELOG.en.md).
