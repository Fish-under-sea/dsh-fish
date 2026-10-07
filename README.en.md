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

> **🆕 0.6.8 (2026-10-08):** All seven READMEs are now **bilingual (Chinese + English) with a unified layout** (centered badge block, fixed section order, emoji removed from section headings, language switcher). Each sub-package's `files` now includes `README.en.md`.
>
> `@fish-under-sea/dsh-git-sync` **0.3.0**: Adds **extra scan roots** — allowlist entries may use a root prefix to point at directories outside `$DSH_HOME`; this release picks up the wallpaper engine's `config.json` and glass presets (from `~/.dsh-wallpaper-engine`, a **sibling** of the DSH home). At the same time, the allowlist loop that was duplicated across five call sites (collect / restore / diff / key health-check / panel stats) is collapsed into the single entry point `entriesOf()`. Sync engine: 120 cases; settings-page client: 37 cases — all passing.
>
> `@fish-under-sea/dsh-session-title-refresh` **0.3.0**: The settings page gains a "**Title model (optional)**" dropdown, sourced from the same provider/model list as the official Models page (`ctx.llm.listProviders()` + `listModels()`, delivered through the read-only same-origin route `GET …/api/models`). The catalog is advisory, not constraining — combinations outside it go through "Custom…" free-text. A single failed provider is logged as `skipped`; a completely unavailable LLM returns `ok:false`. Both fallback paths return to free-text — **the settings page never breaks**. Core 18 + host 20 + client 13 = 51 cases, all passing.
>
> `@fish-under-sea/dsh-visual-companion` **0.1.7**: The version string in the load log is now **read live from `package.json`** (previously hard-coded as `v0.1.2`, which drifted with every release). The Node requirement comment at the top of `bin/` now matches `engines`.
>
> `@fish-under-sea/dsh-approval-guide` **0.2.2** / `@fish-under-sea/dsh-settings-nav-order` **0.1.5**: Documentation release (bilingual READMEs).
>
> `dsh-agent-teams-fish` **0.4.0**: Second round of art assets — vendor namespace 9 → **15**, role buckets 8 → **10**, in-package assets 123 → **280 files / ~28.6 MB**; adds a 1024×1024 HD family (WebP).
>
> `dsh-better-reasoning-effort-fish` **0.5.7**: Fixes an extra hyphen in the repository name inside `FORK.md`, `NOTICE.md`, and `package.json` (`-dsh-better-reasoning-effort-fish` → `dsh-better-reasoning-effort-fish`; the old links 404'd). Adds the missing `dsh.engines.dsh` declaration.
>
> **🆕 0.6.7 (2026-10-07):** `dsh-agent-teams-fish` **0.3.2** (dependency range `^0.3.1` → **`^0.3.2`**) — **Fixes silent disappearance of vendor badges.** 0.3.1 shipped vendor assets in-package (9 of them `brand-<vendor>.svg`), but the host hard-coded `content-type: image/png` for **in-package** assets → the browser failed to decode SVG → the badge `onError` fell back to the active-state image, making it look like "the SVGs never made it into the package." Only machines with no `artworkDir` (purely in-package assets) saw it; machines with a custom directory used the extension table and were fine. 0.3.2 now **infers media type from the extension** and adds two gate assertions: in-package asset media types must match their extensions, and every vendor logo must be served as an SVG document (mutation-verified: flipping the MIME back to `image/png` immediately fails and names all 9 `brand-*.svg` files). **Range note:** `^0.3.1` already covers 0.3.2; the range is bumped explicitly so the new lock and the table above both land on this version.
>
> **🆕 0.6.6 (2026-10-07):** `dsh-agent-teams-fish` **0.3.1** (dependency range `^0.3.0` → **`^0.3.1`**) — **Vendor avatar assets now shipped in-package.** Previously, 108 vendor assets (9 vendors × 8 roles + vendor-generic art + 512 portraits + captain portrait + brand SVGs) lived only under an **absolute** `artworkDir` on the original machine: the npm package carried just 15 built-in whale images, the repository had none, so **on a different machine every candidate chain missed and the whole team fell back to built-in whale avatars.** 0.3.1 ships them along with the import script and packing gate (15 built-in baselines unchanged, package size +~8 MB); vendor avatars are available immediately after install, no `artworkDir` needed across machines. The gate changes from "directory has exactly 15 names" to "must contain the 15 baselines + only known art families," and adds four assertion groups: **full vendor set present / primary candidate reachable / size-format correct / brand logos self-consistent offline.** **Range note:** `^0.3.0` already covers 0.3.1 (`>=0.3.0 <0.4.0`); the range is bumped explicitly so the new lock and the table above both land on this version.
>
> **🆕 0.6.5 (2026-10-07):** `@fish-under-sea/dsh-visual-companion` **0.1.5** (dependency range `^0.1.4` → **`^0.1.5`**) — **Fixes crash where "auto-bind on load" marks the entire plugin as "abnormal."** Symptom: the plugin panel shows a red dot "abnormal," and the `visual_companion` tool and `/companion` command vanish together. Cause: when `<watchDir>/state` does not yet exist (fresh workspace, the companion service has not created this directory), `arm()` calls `fs.watch` on that path and **throws ENOENT synchronously** — on Windows, `fs.watch` on a non-existent path **throws** rather than emitting an `error` event, so the `.on('error')` handler right after it cannot catch it; the exception propagates to cordis's `apply()`, and the entry is marked "not activated." Now `mkdir -p` runs before binding, and a watch failure degrades to a warning with the status honestly left as "unbound" — **the plugin loads normally**, tool and command both present. `visual_companion({action:"arm"})` also now honestly returns "arm failed" on failure (previously it always returned "bound" regardless). Cases 8 → 10 (two new: directory missing → create and bind; path is not a directory → degrade to warning without crashing).
>
> **🆕 0.6.4 (2026-10-07, retroactive note):** `@fish-under-sea/dsh-git-sync` **0.2.7** (dependency range `^0.2.6` → **`^0.2.7`**) — Allowlist adds **`skill-refs/`** (skill reference/research files restore across machines with the config repo; previously only `skills/` itself was collected). **This is a retroactive note:** the version was published to npm the same day, but no entry or tag was left on the main branch (tags only went up to `v0.6.3-dsh0.2.0rc2`), so the version number is added here.
>
> **🆕 0.6.3 (2026-10-06):** `@fish-under-sea/dsh-git-sync` **0.2.6** (dependency range bumped to `^0.2.6`) — **Removes another item from sync scope:** `dsh-session-archive/` (the archive ledger and runtime state of `@linxin666/dsh-session-archive`). It is **purely local state**: it records "which sessions were archived when," but sessions themselves never sync across machines, so the ledger is meaningless after a machine change. The auto-archive **strategy** lives in `profiles/<profile>/cordis.patch.yml`, which *is* synced; the new machine will re-record on its own. It also created an illusion: the config repo's `.gitignore` happened to exclude it too, so it was "copied into the repo but never committed," yet the panel showed 0 pending. Sync engine cases 83 → 86.
>
> **🆕 0.6.2 (2026-10-06):** **Documentation fix release** (no code changes) — `@fish-under-sea/dsh-settings-nav-order` **0.1.4** corrects the top badge from `client-only` to **`client + host`** (it has had a host side since 0.1.2: the cloud sync bridge is written by the host). This README fixes a **duplicate 0.5.6 entry** and a **0x07 control character that leaked into the body** (an `\a` escape in an early script was written literally, causing that line to render as "gent-teams"). npm READMEs freeze at publish time, so such fixes require a new release to appear on the package page.
>
> **🆕 0.6.1 (2026-10-06):** `dsh-agent-teams-fish` **0.3.0** (dependency range `^0.1.29` → **`^0.3.0`**) — The package version consolidates from `0.1.x` to `0.3.0`, catching up the iterations from `0.1.25`–`0.1.29` (role vocabulary normalization and fallback-avatar fix, client panel dictionary rollback fixing desktop renderer startup failure, slash command descriptions unified to `Chinese label · description`, README restructure) along with matching release notes and GitHub tags. **The only change in this package is the dependency range:** `^0.1.29` is in the `0.1.x` range and **will not resolve to 0.3.0**, so a new release is required for the bundle to pick up 0.3.0.
>
> **🆕 0.6.0 (2026-10-06):** `@fish-under-sea/dsh-git-sync` **0.2.5** (dependency range bumped to `^0.2.5`) — **Removes three items from sync scope:** `agent presets (.agent-presets/)`, `pet save (pet.json)`, `workspace mapping (storages/workspace.json)`. The first two are unused locally (pet plugin not enabled); the last contains **machine-specific absolute paths** and should be generated by the new machine itself — syncing it only creates noise ("workspace points to non-existent locations after machine change"). Neither collect nor restore touches these three anymore (**old committed files remain in repo history**; to re-enable sync, add the corresponding `WHITE_LIST` line back). Sync engine cases 69→83. **Released as a minor version:** 0.5.12 and this were the same batch of changes, merged into 0.6.0 for clarity.
>
> **🆕 0.5.11 (2026-10-06):** `@fish-under-sea/dsh-visual-companion` **0.1.4** (dependency range bumped to `^0.1.4`) — **Dev dependencies only:** the 3 DSH packages this test actually needs (`@deepseek-ai/dsh-llm` / `dsh-tools` / `schemastery`) are now declared as `devDependencies`. Previously they were only **optional peers** (provided at runtime by DSH), but tests relied on the copies manually stuffed into `node_modules`; a fresh `pnpm install` followed by tests would hit `ERR_MODULE_NOT_FOUND`. Now reproducible. **Zero runtime changes** (`lib/` and `cordis.patch.yml` untouched). Also corrects that package's README case count from 7 to 8.
>
> **🆕 0.5.10 (2026-10-06):** `@fish-under-sea/dsh-git-sync` **0.2.4** (dependency range bumped to `^0.2.4`) — Fixes a real-machine issue: "first sync after machine change always fails." On a fresh machine without `user.name` / `user.email`, `git commit` is rejected outright by git (`Author identity unknown`), but the old version reported it generically as "push failed." Now it probes identity before commit; if missing, it commits as the **origin owner's GitHub name** (`<owner>@users.noreply.github.com`, matching existing repo commits); if origin is unreachable, it uses "login @ hostname" and logs who was used in the panel. **Machines with identity configured are completely unaffected.** Every step in the commit chain now logs a single readable line on failure (instead of stuffing the entire git stderr into a 500-char error field). Adds 7 real-repo cases (`test/commit-identity.test.mjs`).
>
> **🆕 0.5.9 (2026-10-06):** `@fish-under-sea/dsh-settings-nav-order` **0.1.3** (dependency range bumped to `^0.1.3`) — Hardening after review: host write/read failures and unexpected errors are all logged (host side uses `ctx.logger.warn`; client side only logs when "throwing after the response has been received"; expected failures like host unreachable do not flood the log). Atomic-write fallback for read-only targets changes to "clear read-only bit first, then rename" — **no longer deletes the original file first** (eliminates the theoretical loss window). `readBody` now handles interruption (tab close / disconnect) settlement to avoid handler hangs. Cases: 47 (client 53, host 17, git-sync engine 69).
>
> **🆕 0.5.8 (2026-10-06):** Adds a **cloud sync bridge** for Settings Nav Order — preferences are now persisted not only in browser `localStorage` but also by the host side of `@fish-under-sea/dsh-settings-nav-order` **0.1.2** to `$DSH_HOME/dsh-settings-nav-order/state.json` (written on save, backfilled on startup; four-scenario reconciliation rules that never silently discard unpushed local changes; honestly reports whether the host file synced, with write failures logged on the host). `@fish-under-sea/dsh-git-sync` **0.2.3**'s allowlist picks up this file: **after a machine change, settings menu order and hidden items restore with the config repo.** The two sub-packages add 46 new cases (settings-nav-order client 36→52, host 17; git-sync engine 56→69).
>
> **🆕 0.5.7 (2026-10-05):** Slash command descriptions change to `Chinese label · description` format (`/agent-teams` → "智能体团队 · …", `/companion` → "视觉伴侣 · …"). The panel **icons** and **Chinese label prefixes** come from the core package dsh-client-ui-commands' hard-coded table (HOST_FACES); plugin commands currently have no extension point, so descriptor text is used as an approximation.
>
> **🆕 0.5.6 (2026-10-05):** `dsh-agent-teams-fish` **0.1.28** — Rolls back the client panel dictionary (it caused desktop renderer startup failure); command label Chinese localization moves to host-side descriptors (the panel uses built-in fallback to display Chinese). Role vocabulary normalization from 0.1.27+ is retained.
>
> **🆕 0.5.5 (2026-10-05):** `dsh-agent-teams-fish` **0.1.27** — Role vocabulary normalization (adds `audio` / `video` role buckets, fills in missing words like `author` / `写手` / `作者`, and publishes the available vocabulary in tool descriptions to prevent custom roles from falling through to vendor fallback avatars). `@fish-under-sea/dsh-visual-companion` **0.1.2** — Adds the **`/companion`** slash command.
>
> **🆕 0.5.4 (2026-10-05):** Adds the seventh member [`dsh-better-reasoning-effort-fish`](https://github.com/Fish-under-sea/dsh-better-reasoning-effort-fish) — edit per-model reasoning effort and input modality declarations directly in the Models page edit card + one-click auto-adaptation (fork of upstream `dsh-better-reasoning-effort`); dependency range `^0.5.5`.
>
> **🆕 0.5.3 (2026-10-05):** Bumps to `dsh-agent-teams-fish` **0.1.25** (README unified beautification and update); dependency range bumped to `^0.1.25`.
>
> **🆕 0.5.2 (2026-10-05):** Adds the sixth member [`dsh-visual-companion`](packages/dsh-visual-companion) — preview prototypes / compare layouts on the web, select + annotate, then submit to the assistant; the session automatically receives a user message and starts a new round, while the selection process itself is silent. Unified beautification of all six READMEs; patch bumps for five sub-packages.

---

## What is this

An aggregate package for Fish-made [DSH](https://github.com/Fish-under-sea/DSH) (DeepSeek Harness) plugins. The repository root is the **bundle package**; sub-plugin sources live under `packages/`. The bundle uses its own bundle layer (`cordis.patch.yml`) to **insert all seven plugin entries at once** into the profile's roster — five are local sub-plugins under `packages/` in this repository, and two are **external companion forks**: `dsh-agent-teams-fish` and `dsh-better-reasoning-effort-fish` (each in its own repository, not sub-packages of this one).

> **Installing `@fish-under-sea/dsh-fish` once = installing all seven plugins.**

**Naming difference (easy to trip on):** npm package names `@fish-under-sea/*` carry a scope, but the repository directory name (`dsh-fish/`) and the GitHub repository name (`Fish-under-sea/dsh-fish`) **do not**.

## Included plugins

| Sub-package | Version | Description |
|-------------|:-------:|-------------|
| [`dsh-approval-guide`](packages/dsh-approval-guide) | 0.2.2 | Appends **Chinese explanations** to approval dialogs: what this approval will do, what risks are involved, and what it is based on |
| [`dsh-session-title-refresh`](packages/dsh-session-title-refresh) | 0.3.0 | **Auto-refresh session titles**: summarize and name at round N, then refresh every M rounds; settings page adds a "Title model (optional)" dropdown sourced from the same provider/model list as the official Models page |
| [`dsh-git-sync`](packages/dsh-git-sync) | 0.3.0 | **One-click Git sync**: collect plugin list, enable states, local settings, Skills, ledger, and settings-nav-order preferences into your own private repository; supports **extra scan roots** — allowlist entries may use a root prefix to point at directories outside `$DSH_HOME` |
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
├── package.json          # Bundle manifest (version 0.6.8, dsh.bundle.patch points to cordis.patch.yml)
├── cordis.patch.yml      # Bundle layer: disables built-in title plugin + inserts seven plugin entries
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

<sub>Bundle <code>@fish-under-sea/dsh-fish</code> v0.6.8 · DSH ≥ 0.2.0-rc.2 · Node ≥ 20</sub>
