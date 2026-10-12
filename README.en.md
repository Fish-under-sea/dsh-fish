<div align="center">

<img src="icon.png" alt="@fish-under-sea/dsh-fish" width="120">

# @fish-under-sea/dsh-fish

**One package to install every Fish-made DSH plugin**

[![npm](https://img.shields.io/npm/v/@fish-under-sea/dsh-fish?style=flat-square&label=npm&color=cb3837)](https://www.npmjs.com/package/@fish-under-sea/dsh-fish)
![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square)
![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.0--rc.2-4b6ef6?style=flat-square)
![bundle](https://img.shields.io/badge/kind-bundle-6b7280?style=flat-square)

[简体中文](README.md) · **English**

</div>

---

> **🆕 0.8.2 (2026-10-12):** **`dsh-usage` 0.4.7 → 0.4.9 — the scenario line now counts DeepSeek consumption on every API, and its explanatory sub-line is gone.**
>
> - **Why**: the 0.4.7 line counted only the **official family routes** (`deepseek-official` / `deepseek-account`) and therefore dropped DeepSeek usage served by aggregators and free channels entirely. On this machine that omission was large: a single channel, `bailian`, carries **2.74 billion DeepSeek tokens**, against 260 million on the official account.
> - **New scope**: a row counts when its route is in the official family **or** its model id contains `deepseek` (case-insensitive); non-DeepSeek models (MiMo / Qwen / GLM / GPT / Claude …) stay excluded. Relay and aggregator traffic counts — a DeepSeek model served by an aggregator is still DeepSeek consumption.
> - **Aggregated host-side**: the wire caps each provider's model list at `SUMMARY_MODEL_CAP = 12`, so a browser-side sum would silently undercount once an aggregator serves more models than the cap. The host now aggregates over the uncapped per-model maps and the client only reads the result; an older host that does not send it gets **one fewer line** rather than a figure that only ever saw the official account.
> - **How the numbers move** (this machine's real ledger, 2026-09-11 → 10-12): ¥22.06 / ¥11.03 → **¥1478.77 / ¥739.39** (4.93 billion DeepSeek tokens, 57.9% of all traffic).
> - The explanatory sub-line under the scenario line has been **removed** as requested.
>> **🆕 0.8.1 (2026-10-12):** **three sub-packages updated** (the bundle itself only widens its dependency ranges).
>
> - **`dsh-skill-lens-fish` 0.1.0 → 0.1.1**: fixes two reported problems in the dependency graph. ① Node labels now show the **filename** instead of the full path — the old 24-character truncation turned `skill-refs/ai-asset-forge/...` paths into identical strings, making several nodes in one directory look like duplicates; the full path stays in the hover tooltip. ② **Referenced resources and flat-skill entries are now clickable**: a read-only preview dialog was added (close button, Escape, read-failure state); previously `clickable` hard-excluded those node kinds, so clicking did nothing. In-directory files still open in the editable file tab.
> - **`dsh-usage` 0.4.6 → 0.4.7**: the Token Bank gains a **price-book scenario line** — the **DeepSeek official family's** tokens are repriced at the current Flash book twice, once assuming every call ran in peak hours and once off-peak, giving two figures that bracket the hypothetical cost. It is explicitly labelled **not an actual charge**, counts only the official family (MiMo and relay traffic have no official price book and are excluded), and never reuses the fold-time `cost`.
> - **`dsh-agent-teams-fish` 0.6.1 → 0.7.0**: vendor namespace **17 → 18**, adding **MiMo (Xiaomi MiMo)** in the same tier as `stepfun` / `jev` (a vendor-generic portrait plus an HD one). Recognition matches `mimo` / `mimo-*` / `xiaomi` / 小米, with a **boundary** requirement that `mimo` be followed by a word boundary or separator — avoiding both swallowing `minimax` / `mistral` and misreading ordinary words such as `mimosa`.
>> **🆕 0.8.0 (2026-10-12):** **6 upstream family plugins (forked) + 1 in-house plugin merged in; member count 7 → 14.**
>
> - **6 new upstream forks**: the **task board, Git graph, model capabilities, SSH, usage and session archive** plugins from [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web) (Apache-2.0) are forked into this repository under `packages/`, published independently as `@fish-under-sea/*`.
>   - **Why fork instead of merely depending**: those upstream packages bake the npm scope and package name into the client bundle's module registration id, while the host claims a package by its `package.json` `name` — when the two disagree, the browser half (settings page, panels) does not load at all. Renaming therefore requires editing sources and rebuilding the bundle, which is also what makes independent releases and future kernel tracking possible.
>   - **What changed**: scope and telemetry only; behaviour is equivalent to upstream `0.4.6`. **Install telemetry has been removed** (upstream reports the package name to `dsh-market.com` once a day); each package's `NOTICE` records the modifications and its origin.
>   - **⚠️ Coexistence with `@linxin666/dsh-web-all`**: see [Coexistence with `dsh-web-all`](#coexistence-with-dsh-web-all-important) below.
> - **1 new in-house plugin**: `@fish-under-sea/dsh-skill-lens-fish` (Skill Lens, Fish edition — based on x-feichen/dsh-skill-lens: follows `$DSH_HOME`, recognises flat skills, resolves `skill-refs/` references into the dependency graph).
> - **Member count 7 → 14** (5 in-house + 6 upstream forks + 3 external companion forks); the bundle patch inserts **14 entries**.
>
> Older releases are recorded in [CHANGELOG.en.md](CHANGELOG.en.md).

---

## What is this

An aggregate package for Fish-made [DSH](https://github.com/Fish-under-sea/DSH) (DeepSeek Harness) plugins. The repository root is the **bundle package**; sub-plugin sources live under `packages/`. The bundle uses its own bundle layer (`cordis.patch.yml`) to **insert all fourteen plugin entries at once** into the profile's roster — eleven are local sub-plugins under `packages/` in this repository, and three are **external companion forks**: `dsh-agent-teams-fish`, `dsh-better-reasoning-effort-fish` and `dsh-our-free-model` (each in its own repository, not sub-packages of this one).

> **Installing `@fish-under-sea/dsh-fish` once = installing all fourteen plugins.**

**Naming difference (easy to trip on):** npm package names `@fish-under-sea/*` carry a scope, but the repository directory name (`dsh-fish/`) and the GitHub repository name (`Fish-under-sea/dsh-fish`) **do not**.

## Included plugins

| Sub-package | Version | Description |
|-------------|:-------:|-------------|
| [`dsh-approval-guide`](packages/dsh-approval-guide) | 0.2.2 | Appends **Chinese explanations** to approval dialogs: what this approval will do, what risks are involved, and what it is based on |
| [`dsh-git-sync`](packages/dsh-git-sync) | 0.4.0 | **One-click Git sync**: collect the plugin list, enable states, local settings, Skills, the task-board/usage ledgers, the settings-nav-order preference, the **free-model plugin config and usage ledger**, and the **wallpaper engine whole-machine snapshot** (`$DSH_HOME/FISH.json`, payloads embedded) into your own private git repository. **0.4.0 adds "Export private config"**: copies the credential-bearing files (`channel-pack/` roster / check-in / ledger, `.credentials.yaml`, `our-free-model/eac-user.json`) **purely locally** into a `DSH私钥配置` folder under a chosen directory (Desktop by default), together with an explanatory README — it never touches git, makes no network request, and never logs credential contents. **That path is entirely separate from git sync**, because credentials sit on the sync hard blacklist and never travel with the repository |
| [`dsh-settings-nav-order`](packages/dsh-settings-nav-order) | 0.1.5 | **Settings nav reordering**: arrange the left sidebar menu in the settings panel to your own order and hide items you don't want to see; preferences **restore across machines** via the Git sync plugin |
| [`dsh-visual-companion`](packages/dsh-visual-companion) | 0.1.7 | **Visual Companion wake**: preview prototypes / compare layouts on the web, select + annotate, then press "Submit to assistant" — the session automatically receives a user message and starts a new round, no need to go back to the terminal to repeat; **the selection process is silent, only the submission wakes the session once** (since 0.1.7 the version in the load log is read live from `package.json`, no longer hard-coded) |
| [`dsh-skill-lens-fish`](packages/dsh-skill-lens-fish) | 0.1.1 | **Skill Lens, Fish edition**: browse every Agent Skill on this machine from a session tab. Based on [x-feichen/dsh-skill-lens](https://github.com/x-feichen/dsh-skill-lens) (MIT): upstream only recognises `<name>/SKILL.md` and hard-codes the global root to `~/.dsh` (this machine's DSH_HOME is `~/.dsh-beta`, so its scan is always empty); this edition follows `$DSH_HOME`, recognises flat `<name>.md` skills, and resolves skill references to out-of-directory shared resources such as `skill-refs/` into real paths, shown as a dedicated "referenced resources" group in the dependency graph |
| [`dsh-client-ui-task-board`](packages/dsh-client-ui-task-board) | 0.4.6 | **Task board** (**fork** of upstream `@linxin666/dsh-client-ui-task-board@0.4.6`, Apache-2.0): host-authoritative ledger, five-column board (drag or switch by status), subtask-tree cascading execution, host cron scheduling, an **acceptance gate before execution** (goal form, A/B two-round scoring), Agent Team execution, tags and freeze-snapshot "continuation cards", and a permission confirmation gate for execution. **Install telemetry removed** |
| [`dsh-client-ui-git-graph`](packages/dsh-client-ui-git-graph) | 0.4.6 | **Git graph & branch switching** (**fork** of upstream `@linxin666/dsh-client-ui-git-graph@0.4.6`, Apache-2.0): interactive commit graph plus a branch selector capsule in blank sessions (the host really runs `git switch`), with worktree conflict guards and readable errors; the opt-in `git_worktree` model tool acts on the managed `$DSH_HOME/worktrees/` directory. **Install telemetry removed** |
| [`dsh-client-ui-model-capabilities`](packages/dsh-client-ui-model-capabilities) | 0.4.6 | **Model capability declarations** (**fork** of upstream `@linxin666/dsh-client-ui-model-capabilities@0.4.6`, Apache-2.0): edit **per-model reasoning efforts** (off→max plus the wire value) and **image input declarations** directly on the provider cards of the official Models page, writing the official `llm-pi-ai` settings namespace; one-click provider disable/enable (archives then takes the route offline, credentials untouched) |
| [`dsh-ssh`](packages/dsh-ssh) | 0.4.6 | **SSH operations** (**fork** of upstream `@linxin666/dsh-ssh@0.4.6`, Apache-2.0): host library (one-click import of `~/.ssh/config`), persistent connection pool with multi-level jump hosts, exec, an xterm web terminal, SFTP upload/download, local port forwarding and cluster execution; plus six model tools (`ssh_list` / `ssh_exec` / `ssh_upload` / `ssh_download` / `ssh_tunnel` / `ssh_cluster`). Host config lives in `$DSH_HOME/dsh-ssh.json`. **Install telemetry removed** |
| [`dsh-usage`](packages/dsh-usage) | 0.4.9 | **Usage statistics** (**fork** of upstream `@linxin666/dsh-usage@0.4.6`, Apache-2.0): a per-provider/per-model token ledger (input/output/cache-read/cache-write bucketed separately), balances and **coding-plan quotas** (Kimi / GLM / OpenCode Go / MiniMax / Codex), DeepSeek peak/off-peak cost estimates, the "token bank" whale vouchers, and a compact glance card at the bottom of the sidebar. The ledger lives in `$DSH_HOME/dsh-usage/` |
| [`dsh-session-archive`](packages/dsh-session-archive) | 0.4.6 | **Session archive management** (**fork** of upstream `@linxin666/dsh-session-archive@0.4.6`, Apache-2.0): a complete inventory (including subagent sessions and sessions outside any workspace), filter/search/sort, cross-result-set multi-select, batch archive/unarchive, **physical deletion (with cascade and protection rules)**, and optional auto-archive / auto-cleanup policies. **Fixes an upstream dependency-declaration bug** (the source imports the scoped `@deepseek-ai/schemastery`, while upstream's `dependencies` declared the unscoped `schemastery`, breaking type resolution at build time) || [`dsh-agent-teams-fish`](https://github.com/Fish-under-sea/dsh-agent-teams-fish) | 0.7.0 | **AgentTeams multi-agent collaboration** (companion fork of upstream [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams)): natural-language team building, member/task dependency DAG, mailbox communication, right-sidebar tree monitoring; **vendor avatar assets shipped in-package** (**17 vendors** × 10 roles + vendor-generic art + portraits + captain + brand SVGs, **286 files / ~29.3 MB**, including a 1024×1024 HD WebP family), available immediately after install, no `artworkDir` dependency across machines; custom directory still overrides the full set; brand SVGs served by extension; **the captain avatar follows the captain's own model route**; `0.5.1` fixed the degradation-chain order (`vendor+role → vendor → role`); `0.6.0` merged upstream v0.1.23 (member tool policies, quality-gate contract and amendment binding, lineage identity across forks, workspace audit, degraded reads of a corrupt `team.json`); **⚠️ `0.6.1` fixes "the plugin gets its whole row disabled after upgrading DSH to 0.2.1-alpha.2"** — that build's host allowlist did not yet declare the new runtime, so DSH judged it incompatible and disabled the plugin row (symptom: shows as broken, team collaboration does nothing) |
| [`dsh-better-reasoning-effort-fish`](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish) | 0.5.8 | **Reasoning effort & input modality** (fork of upstream [HaoyueQin/dsh-better-reasoning-effort](https://github.com/HaoyueQin/dsh-better-reasoning-effort)): edit per-model `reasoningEfforts` and `input` declarations directly in the official Models page edit card, with one-click auto-adaptation; this fork yields the `settings.models.provider-card` slot entirely to the model capabilities panel; 0.5.8 merges upstream's three installation routes (pin a version under the release-age window, the release tarball, GitHub source install) |
| [`dsh-our-free-model`](https://github.com/Fish-under-sea/dsh-our-free-model-fish) | 2.1.0 | **Free models & channel aggregation** (fork of upstream [Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model)): folds 13 free channels (CodeArts / CodeBuddy / Loomy / Raccoon / MiniMax / Gemini and more) and free models into the official model picker, and ships its own channel gateway for other local harnesses to proxy. This fork adds a **"hide channel model groups" master switch** — the channel groups mix with your own configured providers and stretch the picker, and turning it on collapses all 13 at once; **display only, never routing** (gateway requests go through `resolveModelInfo()`, so hidden models keep working), and the channel settings page's "show list / disable all" reads `listAllModels()`, also unaffected; off by default, so an upgrade never silently changes the list you see. **2.1.0 merges upstream v2.1.0** — combos, token-saver, a native Anthropic gateway, the `standalone` split, channel packs and the Kilo channel, and an updater snapshot-SHA fix, with Fish's hide-channel-groups switch and area-based pricing fully retained |

## Coexistence with `dsh-web-all` (important)

The 6 new forks in this bundle are **the same plugins** as the upstream aggregate `@linxin666/dsh-web-all`. Enabling both mounts those 6 plugins **twice** (two task boards fighting over one sidebar seat, the same host services registered twice), which misbehaves.

**Entry ids do not collide**, so this does **not** trigger the "same id inserted twice" startup failure:

| Plugin | This bundle's id | `dsh-web-all`'s id |
|---|---|---|
| Task board | `ui-task-board` | `web-ui-task-board` |
| Git graph | `ui-git-graph` | `web-ui-git-graph` |
| Model capabilities | `ui-model-capabilities` | `web-ui-model-capabilities` |
| SSH | `ssh` | `web-ui-ssh` |
| Usage | `usage` | `web-ui-usage` |
| Session archive | `session-archive` | `web-ui-session-archive` |

**What to do**: when this bundle and `dsh-web-all` are both installed, set the six `web-ui-*` entries in the right-hand column to `disabled: true` **in your own profile patch layer**, keeping only this bundle's six entries:

```yaml
# profiles/<profile>/cordis.patch.yml
- { id: web-ui-task-board,         disabled: true }
- { id: web-ui-git-graph,          disabled: true }
- { id: web-ui-model-capabilities, disabled: true }
- { id: web-ui-ssh,                disabled: true }
- { id: web-ui-usage,              disabled: true }
- { id: web-ui-session-archive,    disabled: true }
```

> This bundle deliberately **does not rewrite other packages' entries** — cross-package interference creates coupling, and would also produce `entry not found` warnings when the other package is absent (that exact noise was observed on this machine). So this is documentation only; the decision stays with the installer.

## This package no longer disables any built-in plugin

**Behavior change as of 0.7.8** — the bundle used to explicitly disable DSH's built-in session title provider (`session-title-llm`) to make room for `dsh-session-title-refresh` (the session title service accepts only **one provider per process**; a second registration throws immediately).

Now that the plugin has moved out, that disable is **withdrawn as well** and the built-in provider is active again. **This matters**: removing the plugin while keeping the disable would switch the built-in provider off with nothing replacing it, so **sessions would stop being named automatically**.

If you still want the old plugin, install it on its own — its own patch re-disables the built-in provider:

```powershell
dsh plugin --profile <profile> add @fish-under-sea/dsh-session-title-refresh
```

## Installation

### Option 1: Install from npm (recommended, one package is enough)

```powershell
dsh plugin --profile <profile> add @fish-under-sea/dsh-fish
```

The bundle declares all fourteen plugin dependencies. They are installed as transitive dependencies to the profile top level by pnpm (this profile uses `nodeLinker: hoisted`), and plugin entries resolve by package name.

**Why duplicate entries don't appear**: the reconciliation logic (`reconcile` in `dsh-plugin-manager`) only walks **the profile's own `dependencies`**, not transitive dependencies recursively, so sub-packages are not promoted to bundle layers and entries don't stack.

> ⚠️ **If installation reports `[NOT_FOUND]`**: this package and **all fourteen** of its member packages are published to the npm **official registry**. If your machine points the registry at a domestic mirror (e.g. `registry.npmmirror.com`), the mirror's **lazy sync** may not have picked up one of the sub-packages yet, so `dsh plugin add` fails with
> `404 Not Found … {"error":"[NOT_FOUND] @fish-under-sea/<sub-package> not found"}`.
> **This does not mean the package doesn't exist** — pick any of the following:
>
> - **Trigger mirror sync** (public endpoint, idempotent, no login required; wait ~10 seconds then install):
>   ```sh
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-approval-guide/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-git-sync/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-settings-nav-order/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-visual-companion/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-client-ui-task-board/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-client-ui-git-graph/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-client-ui-model-capabilities/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-ssh/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-usage/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-session-archive/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/dsh-agent-teams-fish/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/dsh-better-reasoning-effort-fish/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/dsh-our-free-model/syncs
>   ```
>   A response of `{"ok":true,"state":"waiting"}` means accepted; verify with
>   `curl.exe https://registry.npmmirror.com/@fish-under-sea%2Fdsh-approval-guide` — when `"latest"` appears, sync is complete.
> - Or switch the machine's registry to the official source `https://registry.npmjs.org/`.
> - Or use the `link:` local path from [Option 3](#option-3-local-development-install-source-changes-take-effect-immediately).

### Option 2: Install from GitHub (when you don't want to use the npm registry)

```jsonc
// profiles/<profile>/package.json
"dependencies": {
  "@fish-under-sea/dsh-fish": "github:Fish-under-sea/dsh-fish"
},
"devDependencies": {
  "@fish-under-sea/dsh-approval-guide": "github:Fish-under-sea/dsh-fish#path:packages/dsh-approval-guide",
  "@fish-under-sea/dsh-git-sync": "github:Fish-under-sea/dsh-fish#path:packages/dsh-git-sync",

  "@fish-under-sea/dsh-settings-nav-order": "github:Fish-under-sea/dsh-fish#path:packages/dsh-settings-nav-order",
  "@fish-under-sea/dsh-visual-companion": "github:Fish-under-sea/dsh-fish#path:packages/dsh-visual-companion",
  "@fish-under-sea/dsh-skill-lens-fish": "github:Fish-under-sea/dsh-fish#path:packages/dsh-skill-lens-fish",

  "@fish-under-sea/dsh-client-ui-task-board": "github:Fish-under-sea/dsh-fish#path:packages/dsh-client-ui-task-board",
  "@fish-under-sea/dsh-client-ui-git-graph": "github:Fish-under-sea/dsh-fish#path:packages/dsh-client-ui-git-graph",
  "@fish-under-sea/dsh-client-ui-model-capabilities": "github:Fish-under-sea/dsh-fish#path:packages/dsh-client-ui-model-capabilities",
  "@fish-under-sea/dsh-ssh": "github:Fish-under-sea/dsh-fish#path:packages/dsh-ssh",
  "@fish-under-sea/dsh-usage": "github:Fish-under-sea/dsh-fish#path:packages/dsh-usage",
  "@fish-under-sea/dsh-session-archive": "github:Fish-under-sea/dsh-fish#path:packages/dsh-session-archive",

  "dsh-agent-teams-fish": "github:Fish-under-sea/dsh-agent-teams-fish",
  "dsh-better-reasoning-effort-fish": "github:Fish-under-sea/dsh-better-reasoning-effort-fish"
}
```

`#path:` is pnpm's sub-directory syntax, letting one repository provide multiple packages — the eleven sub-packages point to this repository; the three external companion forks point to their respective repositories: [`dsh-agent-teams-fish`](https://github.com/Fish-under-sea/dsh-agent-teams-fish), [`dsh-better-reasoning-effort-fish`](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish) and [`dsh-our-free-model`](https://github.com/Fish-under-sea/dsh-our-free-model-fish) (all three are at their repository root, no `#path:` needed). After `pnpm install` on a new machine, packages download directly from the repository with **no dependency on any machine-specific absolute paths**. Only `"@fish-under-sea/dsh-fish"` needs to be listed in `bundles` (its patch handles inserting all fourteen entries).

### Option 3: Local development install (source changes take effect immediately)

```jsonc
// profiles/<profile>/package.json
"dependencies": {
  "@fish-under-sea/dsh-fish": "link:<this-repo-path>"
},
"devDependencies": {
  "@fish-under-sea/dsh-approval-guide": "link:<this-repo-path>/packages/dsh-approval-guide",
  "@fish-under-sea/dsh-git-sync": "link:<this-repo-path>/packages/dsh-git-sync",

  "@fish-under-sea/dsh-settings-nav-order": "link:<this-repo-path>/packages/dsh-settings-nav-order",
  "@fish-under-sea/dsh-visual-companion": "link:<this-repo-path>/packages/dsh-visual-companion",
  "@fish-under-sea/dsh-skill-lens-fish": "link:<this-repo-path>/packages/dsh-skill-lens-fish",

  "@fish-under-sea/dsh-client-ui-task-board": "link:<this-repo-path>/packages/dsh-client-ui-task-board",
  "@fish-under-sea/dsh-client-ui-git-graph": "link:<this-repo-path>/packages/dsh-client-ui-git-graph",
  "@fish-under-sea/dsh-client-ui-model-capabilities": "link:<this-repo-path>/packages/dsh-client-ui-model-capabilities",
  "@fish-under-sea/dsh-ssh": "link:<this-repo-path>/packages/dsh-ssh",
  "@fish-under-sea/dsh-usage": "link:<this-repo-path>/packages/dsh-usage",
  "@fish-under-sea/dsh-session-archive": "link:<this-repo-path>/packages/dsh-session-archive",

  "dsh-agent-teams-fish": "link:<dsh-agent-teams-fish repo path>",
  "dsh-better-reasoning-effort-fish": "link:<dsh-better-reasoning-effort-fish repo path>"
}
```

**Do not use `file:` to point at this repository** — pnpm caches `file:` directory dependencies as "directory dependencies without a hash," and after source changes, `pnpm install` (even with `--force`) **will not re-copy**. You must manually delete `node_modules/dsh-*` and reinstall. `link:` does not have this problem.

> **Restart DSH** after installation for changes to take effect.

## Two pitfalls when declaring dependencies manually

> You can skip this section if using Option 1 (npm) — the bundle handles it for you.

**① Sub-packages must be resolvable at the profile top level**

DSH's client-side scanner (`locatePkgJson` in `@deepseek-ai/dsh-client-modules`) resolves plugin directories by the **package name** in the plugin entry at the profile top level. The entry name must be the full package name:

- ✅ Correct: `@fish-under-sea/dsh-approval-guide` (two-segment `@scope/name` scoped name)
- ❌ Wrong: adding a sub-path causes `exactPackageSpecifier()` to judge it as "not a package" and **skip it directly**

When a sub-package is not at the profile top level, the entry cannot resolve to a `package.json`, and **the plugin's settings page and UI will not load**.

**② When declaring manually, sub-packages go in `devDependencies`**

`dsh plugin` reconciles on every run, automatically appending any package in the profile's `dependencies` that declares `dsh.bundle` into `dsh.profile.bundles`. All fourteen packages declare `dsh.bundle`, and the bundle's patch already restates all fourteen entry insertions —

> Once a sub-package is promoted to a bundle layer, entry insertions will **duplicate**, and **duplicate mounting causes application startup failure**.

**This matters most for `dsh-our-free-model`**: its own `cordis.patch.yml` inserts the id `our-free-model`, the **same id** this bundle inserts (`composeEntries` only pushes, it does not dedupe). So you **must** always remove it from `dsh.profile.bundles` (or move it from the profile's `dependencies` into `devDependencies`).

Placing them in `devDependencies` still installs them at the profile top level (entry names still resolve correctly), but they won't be promoted to bundle layers by the reconciliation logic.

## Runtime configuration of sub-plugins

The local sub-plugins' parameters are **not written in `cordis.patch.yml`** — they live in their respective `config.json` under `$DSH_HOME` and are modified in the **GUI settings page** (the external companion forks and `dsh-visual-companion` are the opposite: their configuration is written in the plugin entry's `config`):

| Plugin | Settings entry | Config file |
|--------|---------------|-------------|
| `approval-guide` | No configuration | — |

| `git-sync` | Settings → Git sync | `$DSH_HOME/dsh-git-sync/config.json` |
| `settings-nav-order` | Settings → Settings nav order | No config file; preferences live in browser `localStorage` (key `dsh-settings-nav-order/v1`) and are mirrored to `$DSH_HOME/dsh-settings-nav-order/state.json` (collected by `git-sync`) |
| `dsh-visual-companion` | No settings page (configuration is in its own profile patch plugin entry) | Same as above (`watchDir`: visual companion root directory, used for "auto-bind on load") |
| `dsh-agent-teams-fish` | No settings page (configuration is in the bundle's `cordis.patch.yml` plugin entry) | Same as above (`stateDir` / `memberProvider` / `artworkDir`) |
| `dsh-better-reasoning-effort-fish` | No settings page (capabilities embed directly into the official Models page edit card) | Same as above (`autofill` / `modalityAutofill` / `probeTimeoutMs` / `bootRetryDelaysMs` / `defaultGuard`, written in the plugin entry's `config` or the plugin `config` block in `settings.yaml`) |
| `dsh-our-free-model` | Settings → Free models (includes the **hide channel model groups** switch under Preferences) | `$DSH_HOME/our-free-model/settings.json` (in the `git-sync` allowlist, restored across machines) |

**Config directory names are unscoped short names** (`$DSH_HOME/dsh-git-sync/` etc.), decoupled from npm package names — so **renaming the package does not affect existing configuration**.

The external companion fork `dsh-agent-teams-fish` is the **exception**: its parameters are written in the bundle's `cordis.patch.yml` plugin entry `config` (`stateDir` / `memberProvider`), with an additional `artworkDir` pointing to a **custom art directory**:

```yaml
- id: agent-teams
  name: 'dsh-agent-teams-fish'
  config:
    stateDir: .agent-teams        # Team state directory (relative to session workspace)
    memberProvider: spawn         # Member spawn mode: spawn or fork
    # artworkDir: <absolute path> # Optional: custom avatar/brand directory (machine-specific, defaults to in-package art)
```

> `artworkDir` is a **machine-specific** absolute path, so it is not written into the bundle (a machine change won't point at someone else's directory). To customize art, override the same `id: agent-teams` entry in **your own profile's patch layer**.

### About `settings-nav-order`

The order of the left column menu in the settings panel (General / Models / Built-in plugins / Agent presets / …) was originally **hard-coded in each plugin's own `settings.section` registration** (an `order` number). The GUI had neither a reorder entry nor a way to collapse unused items. This plugin adds a "Settings nav order" page to solve this:

- **Reorder**: drag the `⋮⋮` handle, or click `↑`/`↓`
- **Hide**: click "Hide" to collapse items you don't want to see
- **How**: applies CSS `order` to nav buttons (container is flex column) and `display:none` to hidden items (**nodes are not deleted, fully reversible**) — neither changes DOM order nor modifies any third-party plugin code, so **plugin upgrades won't wipe these preferences**
- **Data**: primary copy lives in browser `localStorage` (key `dsh-settings-nav-order/v1`), additionally mirrored by the host side to `$DSH_HOME/dsh-settings-nav-order/state.json` — **this file is in `git-sync`'s allowlist**, so order and hidden items restore across machines with the config repo (open the settings page on a new machine and it auto-backfills). This has been the case since 0.1.2; previously these preferences lived only in the browser and didn't travel with the repo
- **Honest reporting after save**: the panel states whether the host file has synced (if it can't write, it says "not synced, will auto-retry next time" — it doesn't pretend success); when there are unsaved reorders and you click the "Enable" toggle, it still shows "unsaved" rather than falsely reporting "saved"
- **Revert**: turn off "Enable manual reorder and hide," or click "Restore default"
- **Self-lock prevention**: the "Settings nav order" page **cannot hide itself** — it is the only entry point that can unhide
- **Identification**: real class names are CSS Modules hashes (`ZiQlkq_navList`), so it matches by `[class*="navList"]` substring — **DSH changing its hash prefix won't break this**

## Repository structure

```text
dsh-fish/                 # Repository directory name (npm package name is @fish-under-sea/dsh-fish)
├── package.json          # Bundle manifest (version 0.7.6, dsh.bundle.patch points to cordis.patch.yml)
├── cordis.patch.yml      # Bundle layer: inserts fourteen plugin entries
├── CHANGELOG.en.md       # Full release history (the README keeps only the latest release)
├── pnpm-workspace.yaml   # Workspace declaration (local development only)
├── lib/                  # Bundle's own empty implementation (this package registers nothing)
│   ├── index.js
│   └── client.js
└── packages/
    ├── dsh-approval-guide/

    ├── dsh-git-sync/
    ├── dsh-settings-nav-order/
    └── dsh-visual-companion/
```

> The three external companion forks are **not** under `packages/` — `dsh-agent-teams-fish` source lives in [its own repository](https://github.com/Fish-under-sea/dsh-agent-teams-fish), `dsh-better-reasoning-effort-fish` in [another repository](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish), and `dsh-our-free-model` in [a third](https://github.com/Fish-under-sea/dsh-our-free-model-fish); all three are installed at the profile top level as **npm dependencies** of the bundle.

> **Why sub-packages are not bundled in the aggregate's `files`**: the bundle only carries `lib/`, `cordis.patch.yml`, and `README*.md`. The eleven sub-packages and three external companion forks are all installed at the profile top level as **npm dependencies** (see Option 1). Only when "one repository provides multiple packages, installed from GitHub" do you need to declare them explicitly with `#path:` in the installer's profile (see Option 2).

## Development

```bash
pnpm install                                                          # Install workspace dependencies

node packages/dsh-approval-guide/test/guide.test.mjs                  # Run tests

node packages/dsh-git-sync/test/client.test.mjs
node packages/dsh-git-sync/test/test-sync-engine.mjs
node packages/dsh-git-sync/test/commit-identity.test.mjs
node packages/dsh-settings-nav-order/test/client.test.mjs
node packages/dsh-settings-nav-order/test/host.test.mjs
node packages/dsh-visual-companion/test/visual-companion.test.mjs
```

> The bundle itself implements no functionality and **registers nothing** — its sole purpose is to carry `cordis.patch.yml`.

## Five places to update when renaming the package

A package name is not just a string in `package.json` — **five places must be updated together**, or it will break at runtime:

| # | Location | Consequence of missing it |
|:-:|----------|--------------------------|
| 1 | `name` in six `package.json` files | Installer's dependency keys won't match |
| 2 | Entry `name` in the bundle and four sub-package `cordis.patch.yml` files | Entry can't resolve the package; plugin doesn't load at all |
| 3 | ⚠️ **`id` in `__ModuleLoader__.load({ id })` inside `lib/client.js` for packages with a client side (eleven sub-packages in this repo + three external companions)** | **Client side reports `loaded without registering "<package name>"`; plugin fails to load** |
| 4 | Installer's profile dependency keys and `bundles` | Dependencies won't install; bundle layer won't expand |
| 5 | Sub-package placement in the profile | Must go in `devDependencies` (see pitfall ② above) |

**#3 is the most insidious**: the loader uses the **package name parsed from the entry** to claim the factory in `factories` (`if (!this.factories.has(id)) throw ... loaded without registering` in `@deepseek-ai/dsh-client-modules/lib/client.js`), so the **registration name must strictly equal the package name** — if the package name has a scope, the registration name must too.

Good news: client tests for the sub-packages with a client side assert this, and the assertions **read `package.json`'s `name`** rather than hard-coded strings — if you rename and miss a spot in the future, **tests will catch it directly**.

**Same applies to external companion forks**: `dsh-agent-teams-fish` ([repository](https://github.com/Fish-under-sea/dsh-agent-teams-fish)), `dsh-better-reasoning-effort-fish` ([repository](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish)) and `dsh-our-free-model` ([repository](https://github.com/Fish-under-sea/dsh-our-free-model-fish)) all come from independent repositories. When renaming, you must similarly synchronize `package.json`'s `name` / `cordis.patch.yml`'s entry `name` / `lib/client.js`'s registration `id` — the former's art routing chain test asserts "registration name = `package.json`'s `name`", and the latter's constant `PLUGIN_ID` also equals the package name (`src/constants.ts`). Missing a spot will be caught the same way.

## License

**MIT** (consistent across the bundle and all in-house sub-packages).

The three external companion forks are also distributed under **MIT**, with **copyright belonging to their respective upstream original authors**:

- `dsh-agent-teams-fish` → [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams) (程序员阿江 / Relakkes)
- `dsh-better-reasoning-effort-fish` → [HaoyueQin/dsh-better-reasoning-effort](https://github.com/HaoyueQin/dsh-better-reasoning-effort) (**HaoyueQin**)
- `dsh-our-free-model` → [Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model) (**Ebony-Vinyl**)

See each companion fork's `NOTICE.md` for provenance, attribution, and scope of changes.

> A `LICENSE` file is placed at the repository root, consistent with the `license` field in `package.json` (MIT) and the in-house sub-packages.

---

<sub>Bundle <code>@fish-under-sea/dsh-fish</code> v0.8.2 · DSH ≥ 0.2.0-rc.2 · Node ≥ 20</sub>
