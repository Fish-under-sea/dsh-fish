<div align="center">

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

> **🆕 0.6.10 (2026-10-10):** `@fish-under-sea/dsh-git-sync` **0.3.1** (dependency range `^0.3.0` → **`^0.3.1`**) — the sync scope now includes the **config surface of the free-model plugin (`our-free-model`)**, three files: `settings.json` (enable switch / probe interval / forwarding / egress / channel gateway / default maxTokens), `catalog.json` (model catalog snapshot), and `availability.json` (availability snapshot). **Two files are deliberately excluded:** `stats.json` is the local cumulative usage ledger — syncing it would let machines overwrite each other and distort both sides' numbers, with no restoration value after a machine switch; `eac-user.json` carries a **real login token and GitHub login name**, i.e. credentials — copied by **USB stick** like `.credentials.yaml`, and additionally added to `NEVER_COPY` as defense in depth (so a future whole-directory allowlist entry still cannot carry it). Sync-engine cases went from 120 to **152**, all passing (32 new ones covering "carry config only, never the ledger or the credentials"). Also: the README now keeps only the **latest release**, with older entries archived in [CHANGELOG.en.md](CHANGELOG.en.md).
>
> Older releases are recorded in [CHANGELOG.en.md](CHANGELOG.en.md).

---

## What is this

An aggregate package for Fish-made [DSH](https://github.com/Fish-under-sea/DSH) (DeepSeek Harness) plugins. The repository root is the **bundle package**; sub-plugin sources live under `packages/`. The bundle uses its own bundle layer (`cordis.patch.yml`) to **insert all seven plugin entries at once** into the profile's roster — five are local sub-plugins under `packages/` in this repository, and two are **external companion forks**: `dsh-agent-teams-fish` and `dsh-better-reasoning-effort-fish` (each in its own repository, not sub-packages of this one).

> **Installing `@fish-under-sea/dsh-fish` once = installing all seven plugins.**

**Naming difference (easy to trip on):** npm package names `@fish-under-sea/*` carry a scope, but the repository directory name (`dsh-fish/`) and the GitHub repository name (`Fish-under-sea/dsh-fish`) **do not**.

## Included plugins

| Sub-package | Version | Description |
|-------------|:-------:|-------------|
| [`dsh-approval-guide`](packages/dsh-approval-guide) | 0.2.2 | Appends **Chinese explanations** to approval dialogs: what this approval will do, what risks are involved, and what it is based on |
| [`dsh-session-title-refresh`](packages/dsh-session-title-refresh) | 0.3.1 | **Auto-refresh session titles**: summarize and name at round N, then refresh every M rounds; the "Title model (optional)" dropdown is sourced from the same provider/model list as the official Models page; the title call **explicitly disables thinking**, the default output budget is 256, and a `max-tokens` result is accepted when it carries text |
| [`dsh-git-sync`](packages/dsh-git-sync) | 0.3.1 | **One-click Git sync**: collect plugin list, enable states, local settings, Skills, ledger, settings-nav-order preferences, and **free-model plugin configuration** into your own private repository; supports **extra scan roots** — allowlist entries may use a root prefix to point at directories outside `$DSH_HOME` |
| [`dsh-settings-nav-order`](packages/dsh-settings-nav-order) | 0.1.5 | **Settings nav reordering**: arrange the left sidebar menu in the settings panel to your own order and hide items you don't want to see; preferences **restore across machines** via the Git sync plugin |
| [`dsh-visual-companion`](packages/dsh-visual-companion) | 0.1.7 | **Visual Companion wake**: preview prototypes / compare layouts on the web, select + annotate, then press "Submit to assistant" — the session automatically receives a user message and starts a new round, no need to go back to the terminal to repeat; **the selection process is silent, only the submission wakes the session once** (since 0.1.7 the version in the load log is read live from `package.json`, no longer hard-coded) |
| [`dsh-agent-teams-fish`](https://github.com/Fish-under-sea/dsh-agent-teams-fish) | 0.4.0 | **AgentTeams multi-agent collaboration** (companion fork of upstream [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams)): natural-language team building, member/task dependency DAG, mailbox communication, right-sidebar tree monitoring; **vendor avatar assets shipped in-package** (15 vendors × 10 roles + vendor-generic art + portraits + captain + brand SVGs, 280 files / ~28.6 MB, including a 1024×1024 HD WebP family), available immediately after install, no `artworkDir` dependency across machines; custom directory still overrides the full set; brand SVGs served by extension |
| [`dsh-better-reasoning-effort-fish`](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish) | 0.5.7 | **Reasoning effort & input modality** (fork of upstream [HaoyueQin/dsh-better-reasoning-effort](https://github.com/HaoyueQin/dsh-better-reasoning-effort)): edit per-model `reasoningEfforts` and `input` declarations directly in the official Models page edit card, with one-click auto-adaptation; this fork yields the `settings.models.provider-card` slot entirely to the model capabilities panel |

## This package disables a built-in DSH plugin

**This is behavior you must know before using** — `cordis.patch.yml` explicitly disables DSH's built-in session title provider:

```yaml
- id: session-title-llm
  name: '@deepseek-ai/dsh-session-title-first-prompt-llm'
  disabled: true
```

**Reason**: the session title service accepts only **one provider per process**; a second registration throws immediately. So the built-in must yield to `dsh-session-title-refresh` first.

**Behavioral difference**: this plugin also registers at `first-prompt` cadence, and **round 1 still generates a title** — no perceptible difference in daily use, but you should know that this built-in plugin is disabled by this bundle.

## Installation

### Option 1: Install from npm (recommended, one package is enough)

```powershell
dsh plugin --profile <profile> add @fish-under-sea/dsh-fish
```

The bundle declares all seven plugin dependencies. They are installed as transitive dependencies to the profile top level by pnpm (this profile uses `nodeLinker: hoisted`), and plugin entries resolve by package name.

**Why duplicate entries don't appear**: the reconciliation logic (`reconcile` in `dsh-plugin-manager`) only walks **the profile's own `dependencies`**, not transitive dependencies recursively, so sub-packages are not promoted to bundle layers and entries don't stack.

> ⚠️ **If installation reports `[NOT_FOUND]`**: this package and all seven member packages are published to the npm **official registry**. If your machine points the registry at a domestic mirror (e.g. `registry.npmmirror.com`), the mirror's **lazy sync** may not have picked up one of the sub-packages yet, so `dsh plugin add` fails with
> `404 Not Found … {"error":"[NOT_FOUND] @fish-under-sea/<sub-package> not found"}`.
> **This does not mean the package doesn't exist** — pick any of the following:
>
> - **Trigger mirror sync** (public endpoint, idempotent, no login required; wait ~10 seconds then install):
>   ```sh
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-approval-guide/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-git-sync/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-session-title-refresh/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-settings-nav-order/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/@fish-under-sea/dsh-visual-companion/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/dsh-agent-teams-fish/syncs
>   curl.exe -X PUT https://registry.npmmirror.com/-/package/dsh-better-reasoning-effort-fish/syncs
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
  "@fish-under-sea/dsh-session-title-refresh": "github:Fish-under-sea/dsh-fish#path:packages/dsh-session-title-refresh",
  "@fish-under-sea/dsh-settings-nav-order": "github:Fish-under-sea/dsh-fish#path:packages/dsh-settings-nav-order",
  "@fish-under-sea/dsh-visual-companion": "github:Fish-under-sea/dsh-fish#path:packages/dsh-visual-companion",
  "dsh-agent-teams-fish": "github:Fish-under-sea/dsh-agent-teams-fish",
  "dsh-better-reasoning-effort-fish": "github:Fish-under-sea/dsh-better-reasoning-effort-fish"
}
```

`#path:` is pnpm's sub-directory syntax, letting one repository provide multiple packages — the five sub-packages point to this repository; the two external companion forks point to their respective repositories: [`dsh-agent-teams-fish`](https://github.com/Fish-under-sea/dsh-agent-teams-fish) and [`dsh-better-reasoning-effort-fish`](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish) (the latter is at the repository root, no `#path:` needed). After `pnpm install` on a new machine, packages download directly from the repository with **no dependency on any machine-specific absolute paths**. Only `"@fish-under-sea/dsh-fish"` needs to be listed in `bundles` (its patch handles inserting all seven entries).

### Option 3: Local development install (source changes take effect immediately)

```jsonc
// profiles/<profile>/package.json
"dependencies": {
  "@fish-under-sea/dsh-fish": "link:<this-repo-path>"
},
"devDependencies": {
  "@fish-under-sea/dsh-approval-guide": "link:<this-repo-path>/packages/dsh-approval-guide",
  "@fish-under-sea/dsh-git-sync": "link:<this-repo-path>/packages/dsh-git-sync",
  "@fish-under-sea/dsh-session-title-refresh": "link:<this-repo-path>/packages/dsh-session-title-refresh",
  "@fish-under-sea/dsh-settings-nav-order": "link:<this-repo-path>/packages/dsh-settings-nav-order",
  "@fish-under-sea/dsh-visual-companion": "link:<this-repo-path>/packages/dsh-visual-companion",
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

`dsh plugin` reconciles on every run, automatically appending any package in the profile's `dependencies` that declares `dsh.bundle` into `dsh.profile.bundles`. All seven packages declare `dsh.bundle`, and the bundle's patch already restates all seven entry insertions —

> Once a sub-package is promoted to a bundle layer, entry insertions will **duplicate**, and **duplicate mounting causes application startup failure**.

Placing them in `devDependencies` still installs them at the profile top level (entry names still resolve correctly), but they won't be promoted to bundle layers by the reconciliation logic.

## Runtime configuration of sub-plugins

The five local sub-plugins' parameters are **not written in `cordis.patch.yml`** — they live in their respective `config.json` under `$DSH_HOME` and are modified in the **GUI settings page** (the external companion forks and `dsh-visual-companion` are the opposite: their configuration is written in the plugin entry's `config`):

| Plugin | Settings entry | Config file |
|--------|---------------|-------------|
| `approval-guide` | No configuration | — |
| `session-title-refresh` | Settings → Session title auto-refresh | `$DSH_HOME/dsh-session-title-refresh/config.json` |
| `git-sync` | Settings → Git sync | `$DSH_HOME/dsh-git-sync/config.json` |
| `settings-nav-order` | Settings → Settings nav order | No config file; preferences live in browser `localStorage` (key `dsh-settings-nav-order/v1`) and are mirrored to `$DSH_HOME/dsh-settings-nav-order/state.json` (collected by `git-sync`) |
| `dsh-visual-companion` | No settings page (configuration is in its own profile patch plugin entry) | Same as above (`watchDir`: visual companion root directory, used for "auto-bind on load") |
| `dsh-agent-teams-fish` | No settings page (configuration is in the bundle's `cordis.patch.yml` plugin entry) | Same as above (`stateDir` / `memberProvider` / `artworkDir`) |
| `dsh-better-reasoning-effort-fish` | No settings page (capabilities embed directly into the official Models page edit card) | Same as above (`autofill` / `modalityAutofill` / `probeTimeoutMs` / `bootRetryDelaysMs` / `defaultGuard`, written in the plugin entry's `config` or the plugin `config` block in `settings.yaml`) |

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
├── package.json          # Bundle manifest (version 0.6.10, dsh.bundle.patch points to cordis.patch.yml)
├── cordis.patch.yml      # Bundle layer: disables built-in title plugin + inserts seven plugin entries
├── CHANGELOG.en.md       # Full release history (the README keeps only the latest release)
├── pnpm-workspace.yaml   # Workspace declaration (local development only)
├── lib/                  # Bundle's own empty implementation (this package registers nothing)
│   ├── index.js
│   └── client.js
└── packages/
    ├── dsh-approval-guide/
    ├── dsh-session-title-refresh/
    ├── dsh-git-sync/
    ├── dsh-settings-nav-order/
    └── dsh-visual-companion/
```

> The two external companion forks are **not** under `packages/` — `dsh-agent-teams-fish` source lives in [its own repository](https://github.com/Fish-under-sea/dsh-agent-teams-fish), and `dsh-better-reasoning-effort-fish` in [another repository](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish); both are installed at the profile top level as **npm dependencies** of the bundle.

> **Why sub-packages are not bundled in the aggregate's `files`**: the bundle only carries `lib/`, `cordis.patch.yml`, and `README*.md`. The five sub-packages and two external companion forks are all installed at the profile top level as **npm dependencies** (see Option 1). Only when "one repository provides multiple packages, installed from GitHub" do you need to declare them explicitly with `#path:` in the installer's profile (see Option 2).

## Development

```bash
pnpm install                                                          # Install workspace dependencies

node packages/dsh-approval-guide/test/guide.test.mjs                  # Run tests
node packages/dsh-session-title-refresh/test/run-all.mjs
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
| 2 | Entry `name` in the bundle and five sub-package `cordis.patch.yml` files | Entry can't resolve the package; plugin doesn't load at all |
| 3 | ⚠️ **`id` in `__ModuleLoader__.load({ id })` inside `lib/client.js` for packages with a client side (four sub-packages in this repo + two external companions)** | **Client side reports `loaded without registering "<package name>"`; plugin fails to load** |
| 4 | Installer's profile dependency keys and `bundles` | Dependencies won't install; bundle layer won't expand |
| 5 | Sub-package placement in the profile | Must go in `devDependencies` (see pitfall ② above) |

**#3 is the most insidious**: the loader uses the **package name parsed from the entry** to claim the factory in `factories` (`if (!this.factories.has(id)) throw ... loaded without registering` in `@deepseek-ai/dsh-client-modules/lib/client.js`), so the **registration name must strictly equal the package name** — if the package name has a scope, the registration name must too.

Good news: client tests for all four sub-packages with a client side assert this, and the assertions **read `package.json`'s `name`** rather than hard-coded strings — if you rename and miss a spot in the future, **tests will catch it directly**.

**Same applies to external companion forks**: `dsh-agent-teams-fish` ([repository](https://github.com/Fish-under-sea/dsh-agent-teams-fish)) and `dsh-better-reasoning-effort-fish` ([repository](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish)) both come from independent repositories. When renaming, you must similarly synchronize `package.json`'s `name` / `cordis.patch.yml`'s entry `name` / `lib/client.js`'s registration `id` — the former's art routing chain test asserts "registration name = `package.json`'s `name`", and the latter's constant `PLUGIN_ID` also equals the package name (`src/constants.ts`). Missing a spot will be caught the same way.

## License

**MIT** (consistent across the bundle and all five sub-packages).

The two external companion forks are also distributed under **MIT**, with **copyright belonging to their respective upstream original authors**:

- `dsh-agent-teams-fish` → [NanmiCoder/dsh-agent-teams](https://github.com/NanmiCoder/dsh-agent-teams) (程序员阿江 / Relakkes)
- `dsh-better-reasoning-effort-fish` → [HaoyueQin/dsh-better-reasoning-effort](https://github.com/HaoyueQin/dsh-better-reasoning-effort) (**HaoyueQin**)

See each companion fork's `NOTICE.md` for provenance, attribution, and scope of changes.

> A `LICENSE` file is placed at the repository root, consistent with the `license` field in `package.json` (MIT) and all five sub-packages.

---

<sub>Bundle <code>@fish-under-sea/dsh-fish</code> v0.6.10 · DSH ≥ 0.2.0-rc.2 · Node ≥ 20</sub>
