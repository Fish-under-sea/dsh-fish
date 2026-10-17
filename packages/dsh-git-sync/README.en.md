<div align="center">

# @fish-under-sea/dsh-git-sync

**One-click sync of your DSH configuration surface to a private Git repo — restore on a new machine**

[![npm](https://img.shields.io/npm/v/@fish-under-sea/dsh-git-sync?style=flat-square&label=npm&color=cb3837)](https://www.npmjs.com/package/@fish-under-sea/dsh-git-sync)
![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square)
![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.0--rc.2-4b6ef6?style=flat-square)
![plugin](https://img.shields.io/badge/plugin-client%20%2B%20host-6b7280?style=flat-square)

[简体中文](README.md) · **English**

</div>

---

## What problem does this solve

DSH keeps all user state in a single home directory (`$DSH_HOME`, `~/.dsh` by default). Syncing it by hand means remembering a string of paths — and making sure you never push a secret. This plugin turns the whole thing into a few buttons under **Settings → Git Sync**: collect your DSH environment (installed plugins, per-plugin enable/disable, plugin config, local settings, Skills, task-board ledger, the wallpaper engine's whole-machine snapshot) into your own **private** Git repo and push, or restore it on a new machine with one click.

## Highlights

- **Allowlist-only collection**: only the configuration surface is copied. Secret files (`.credentials.yaml`) sit on a hard deny-list and can never be collected.
- **Three safety gates**: file-level hard deny-list → pre-commit staging-area review → secret scan (generic regex + exact match against `.credentials.yaml` values).
- **Remote merge**: before every collect / push, `git fetch` runs first. If the remote is ahead and the local side has no commits, it fast-forwards; if both sides have commits, it rebases automatically; on conflict it rolls back and reports the error — no half-merged state is ever left behind.
- **Retry-push semantics**: whether to push is decided by "is the local side ahead of the remote", not "did this run produce a new commit". After a push failure, just click **One-click sync** again.
- **Per-file fault tolerance**: a single unreadable file (locked, permission denied, or rejected by the file policy) is skipped and logged — the rest of the sync continues.
- **Extra scan roots** (0.3.0, **table empty as of 0.3.3**): allowlist entries can use a "root prefix" to point at directories outside `$DSH_HOME`, landing as same-named subdirectories in the repo. Its only consumer (the wallpaper engine) collapsed into the single in-home `FISH.json` entry in 0.3.3, so the table is currently empty — the mechanism is kept for plugins that store data outside home.
- **Zero npm dependencies**: only `node:` built-in modules.

## Installation

```sh
# Option 1 (recommended): install from npm
# --profile should be the local profile name: desktop for the desktop app, web for the web app
dsh plugin --profile <profile> add @fish-under-sea/dsh-git-sync

# Option 2: link install (for developing the source) — the repo source IS the install source; restart DSH after changes
dsh plugin --profile <profile> add "link:<repo-path>/packages/dsh-git-sync"

# Option 3: copy install (file:) — you must re-run `add` after every source change
dsh plugin --profile <profile> add "file:<repo-path>/packages/dsh-git-sync"
```

**Which to pick**: day-to-day use → option 1 (npm — versions are traceable and `update` works). To modify the source → option 2 (`link:` creates a directory junction; the repo source is the install source, restart DSH and changes take effect). `file:` is a pnpm **directory copy** — after install, changes to `lib/*.js` are **not** reflected in the installed copy, not even after a restart; you must `add` again. Only suitable for one-off trials.

**Restart DSH** after installation (the plugin row and settings page take effect on next launch).

> **Moving to a new machine**: installation writes the **local absolute path** into `profiles/<profile>/package.json` (`"@fish-under-sea/dsh-git-sync": "link:D:/…/plugin"`). This file is synced to the other machine, where that directory doesn't exist, so `dsh plugin install` will fail on this entry. Either clone to the same path on both machines, or on the new machine first `dsh plugin --profile web remove @fish-under-sea/dsh-git-sync` and then `add` it back with the local path.

## Usage

Open **Settings → Git Sync**:

| Button | Action |
| --- | --- |
| **One-click sync** | `git fetch` + auto-merge remote first, then collect → commit → push — the only button you need day-to-day |
| **Collect & commit only** | Allowlisted content from `$DSH_HOME` → repo directory, then `git add` / `commit` (**no push**) |
| **Restore from repo** | Repo directory → `$DSH_HOME`; existing files are backed up to `_backup/` in the repo before overwrite |
| **Secret scan** | Scan text files about to be uploaded + exact-match against real key values from `.credentials.yaml` |
| **Refresh** | Re-read the repo state |

### Reading the status cards

| Card | Meaning |
| --- | --- |
| **Pending** | **Content diff between local ↔ repo** (added / changed / only in repo). 0 means both sides agree |
| **Files in repo** | Payload size of what's been synced (file count · size). **This is not a to-do count** |
| **Workspace** | Whether the repo's git working tree is clean, and whether it's ahead of the remote |
| **Branch / Remote** | Current branch and `origin` URL |
| **Last run** | Previous action, time, and outcome |

> **Read "Pending" and "Workspace" together**: Pending = 0 and Workspace clean ⇒ your local config is fully committed and pushed — nothing to sync. Earlier versions labeled "Files in repo" as "Pending files", making it look like dozens of files were queued for upload — fixed.

### Key semantics

- **"One-click sync" retries pushes that failed before.** Whether to push is decided by "is the local side ahead of the remote", not "did this run produce a new commit". After a push failure (TLS interception, network drop, expired credentials), just **click "One-click sync" again** — there used to be a subtle bug: the old code only pushed when the current run produced a new commit, so after a push failure, clicking the button again would skip the push (because "no local changes") and still report success. Fixed, with a regression test.
- **"Collect & commit only" is the "look before you push" gate.** It commits but doesn't push, so you can review the diff before deciding whether to send it to GitHub. (The `pushgit` action is still exposed on the API as an emergency channel.)
- **Cross-machine sync no longer needs manual firefighting.** Before collect and push, `git fetch` runs first: if the remote is ahead and there are no local commits, fast-forward merge; if both sides have commits, automatic `rebase` (keeping linear history); on conflict, roll back to the pre-operation state and report the error honestly — no half-merged state is ever left behind. Previously the plugin only did `push`, which meant any new remote commit would permanently stall with `! [rejected] main -> main (fetch first)`; more subtly, when the local side had no commits, the stale `@{u}` ref would **falsely report** "local and remote are fully in sync" and do nothing at all.

## Configuration

Change the **repo directory** directly in the panel and click **Save settings**. It's stored at `$DSH_HOME/dsh-git-sync/config.json` — **deliberately outside the sync scope**, so each machine can point to its own clone path without overwriting the others.

### Sync scope (allowlist)

The allowlist lists paths relative to `$DSH_HOME`. `<profile>` is enumerated dynamically from the directory.

| Path | Meaning |
| --- | --- |
| `settings.yaml` | Global settings in the 0.1.x layout; since 0.2.0 the file under `$DSH_HOME` has been renamed to `settings.yaml.imported` by the patch layer — this entry is only useful when migrating from a 0.1.x machine |
| `skin-center-active.json` | Currently active skin-center item |
| `skills/` | **Skill directory** (`$DSH_HOME/skills`) |
| `skill-refs/` | Skill ref criteria, runnable scripts, and test samples (added in 0.2.7) |
| `AGENTS.md` | User-level global instructions |
| `task-board/ledger-v2.json` | Task-board ledger |
| `task-board/scheduler-v2.json` | Task-board scheduler state |
| `dsh-usage/` | Usage ledger |
| `dsh-settings-nav-order/state.json` | Settings navigation order preference (see dedicated section below) |
| `dsh-session-title-refresh/config.json` | Title auto-refresh user settings: **which model writes the title** (`provider` / `model`) plus every tuning knob (first-round rounds, interval, window, output budget, timeout, target length, skip-subagent-sessions). The sibling `history.json` is a machine-local run log and is **not** on the allowlist |
| `our-free-model/settings.json` | Free-model plugin (`dsh-our-free-model-fish`) user settings: enable switch, probe interval, forwarding, egress, channel gateway, default maxTokens (see dedicated section below) |
| `our-free-model/catalog.json` | Free-model catalog snapshot (model id list + timestamp), no secrets |
| `our-free-model/availability.json` | Free-model availability snapshot (egress IP + per-model probe results), no secrets |
| `our-free-model/stats.json` | Free-model usage ledger (see the dedicated section below for the cross-machine caveat) |
| `profiles/<profile>/package.json` | Which plugins are installed + bundle-layer order |
| `profiles/<profile>/cordis.patch.yml` | **Per-plugin enable/disable** (`disabled:` lines) + config overrides |
| `profiles/<profile>/cordis.patch.yml.bak-plugin-manager` | Config backup written by the plugin manager (exact-path allow; all other `*.bak*` remain denied) |
| `profiles/<profile>/pnpm-lock.yaml` | Exact versions for reproducibility |
| `profiles/<profile>/pnpm-workspace.yaml` | pnpm configuration |
| `FISH.json` | **Wallpaper engine's whole-machine configuration snapshot** (new in 0.3.3 — see the dedicated section below). This is the file produced by the wallpaper engine's "Export preset": all look-and-behaviour settings, with font and mascot asset payloads embedded |

> **`<profile>` is enumerated dynamically**: every profile directory under the local `profiles/` is covered — `desktop` for the desktop app, `web` for the web app. Hard-coding a profile name would miss the three most important things — "which plugins are installed / which are enabled / exact versions". The 0.2.0 desktop edition learned this the hard way: after the profile was renamed, not a single allowlist entry matched, and the repo was left with only a 0.1.x `profiles/web` snapshot.

### Settings navigation order

The settings menu order and hidden items **actually take effect in the browser's `localStorage`** (key `dsh-settings-nav-order/v1`), which the host process cannot reach. The host half of [`dsh-settings-nav-order`](https://github.com/Fish-under-sea/dsh-fish/tree/main/packages/dsh-settings-nav-order) therefore mirrors it to `$DSH_HOME/dsh-settings-nav-order/state.json` — written every time the user saves, via its own same-origin route. This plugin is only responsible for carrying that file by relative path. Without it, the settings menu order and hidden items cannot be restored on a new machine (everything else can).

### Title auto-refresh settings

> ⚠️ **As of 0.7.8 this plugin has moved out of the bundle and is unmaintained**: DSH has shipped built-in automatic session renaming since **v0.2.1-alpha.2**. This section still applies if you installed the plugin on its own.

[`dsh-session-title-refresh`](https://github.com/Fish-under-sea/dsh-fish/tree/main/packages/dsh-session-title-refresh) stores its user settings in `$DSH_HOME/dsh-session-title-refresh/config.json` — that is **which model writes the title** (`provider` / `model`) plus the whole set of tuning knobs (first-round rounds, interval, window, output budget, timeout, target length, skip-subagent-sessions). Without this entry, a machine switch means **re-setting the title model and every one of those knobs in the original UI**.

The sibling `history.json` is a **machine-local run log** (per-refresh success/failure and session ids). It only grows, it overwrites its counterpart across machines, and it has no restoration value — so the allowlist names **only `config.json`** and never the directory.

### Wallpaper engine: a single whole-machine snapshot (collapsed in 0.3.3)

`dsh-plugin-wallpaper-engine` keeps its data directory at `~/.dsh-wallpaper-engine`, a **sibling** of `$DSH_HOME`. Since 0.3.0 this plugin used **extra scan roots** to collect its `config.json` plus three asset directories.

**As of 0.3.3 those four entries collapse into one**: `FISH.json` — which lives **inside** `$DSH_HOME`, so an ordinary relative path reaches it.

The reason lies on the wallpaper engine's side: its ADR-0011 promoted "presets" from a **glass-subset snapshot** to a **whole-machine configuration snapshot**, and added import / export. Clicking "Export preset…" in its panel produces exactly this file:

```jsonc
{
  "$schema": "dsh-we/profile-preset@1",
  "id": "preset-mv3uxy23-hemr",
  "name": "FISH",
  "values": { /* 116 keys: every look-and-behaviour setting */ },
  "assets": {
    "font":   { "name": "默认", "values": { /* font set body */ } },
    "mascot": { "file": "mascot-….webp", "box": "96x96", "data": "<base64 image payload>" }
  }
}
```

**Why one file is enough** (measured 2026-10-11): `FISH.json`'s `values` has 116 keys, `config.json.settings` has 132, and the **difference is exactly the 12 hard-excluded keys plus 4 asset pointers** — the exclusions being the current wallpaper / hidden list / rotation list / `userProps` (digests of machine-local absolute paths) / runtime failure memory / version number. Those describe "which wallpaper is on right now", not "how this plugin is configured", and they are supposed to go stale across machines. ⇒ The snapshot's settings segment is **exactly equal** to this plugin's configuration surface.

**Why the three asset directories can be dropped**: the `assets` segment **embeds the asset payloads**. Collecting `fontsets/` and `mascot/` separately in 0.3.2 existed to close the "settings file keeps only a pointer, the real thing is stored alongside" gap — now the payloads are inside the snapshot, so those directories, along with `config.json`, are redundant.

**Why "one entry" rather than "four"**: this project's hard-won lesson is that **a hand-copied list inevitably drifts** (see the `isBakAllowed` and `entriesOf` comments). Four entries = four drift points; one entry = one.

**⚠️ Dropping the directories also fixes a real defect**: collection is a **one-way copy** (home → repo only, never deleting on the repo side), so files you delete locally inside an allowlisted **directory** stay in the repo forever and are honestly reported as "extra in repo N". Measured on this machine at the time: `4 files differ (added 0 · changed 1 · extra in repo 3)` — all 3 extras sat inside the dropped directories (two old-format glass presets plus an old mascot). Dropping the directories stops that class of residue. **Note this only cures the wallpaper-engine spot**: directory-level entries such as `skills/` still grow-only.

**⚠️ Restore is not automatic — this step is manual**: this plugin only carries the file back to `$DSH_HOME/FISH.json`; **it takes effect when you click "Import preset…" in the wallpaper engine's panel and pick it**. And "imported ≠ applied" — you still have to click that preset in the preset list to apply it. An `assets` segment that is **absent** from the snapshot (say you did not tick avatars when exporting) **leaves the receiving machine's current values untouched** on apply — it does not fall back to defaults.

**Extra scan roots (0.3.0) today**: the mechanism is kept but **the table is currently empty**. Allowlist entries may still use a "root prefix" to point outside `$DSH_HOME` (an `EXTRA_ROOTS` table in code); the wallpaper engine simply no longer needs it. Adding a root takes two steps: add a row to the table, then add `<key>/…` entries to `WHITE_LIST`.

Explicitly **not** collected: the wallpaper engine's `cache/` (~2.8 GB of derived cache), `ffmpeg/` binaries, `bin/`, `diag/`, `avatars/`, `config.json`, `fontsets/`, `glass-presets/`, and `mascot/` (the last four are covered by `FISH.json`).

> **Implementation note**: 0.3.0 consolidates the allowlist loop that was previously scattered across five places (collect / restore / diff / secret scan / panel stats) into a **single entry point**, `entriesOf(base, side)` — otherwise "a new scan scope taking effect in only one or two of those places" would be an inevitable outcome; this project has already been bitten twice by "multiple defense layers drifting apart" (see the `isBakAllowed` and `.gitignore` comments), so the scan scope must have exactly one place to land. The 0.3.3 collapse leans on exactly that: the change lands in `WHITE_LIST` alone and all five consumers follow automatically.

### Free-model plugin (`our-free-model`)

`dsh-our-free-model-fish`'s config directory `$DSH_HOME/our-free-model/` lives **inside** home, so it is named by an ordinary relative path and needs no extra scan root. Four files are collected:

- `our-free-model/settings.json` — user settings: enable switch, probe interval, forwarding, egress, channel gateway, default maxTokens;
- `our-free-model/catalog.json` — model catalog snapshot (model id list + timestamp);
- `our-free-model/availability.json` — availability snapshot (egress IP + per-model probe results);
- `our-free-model/stats.json` — the usage ledger.

**Only one file is excluded**:

- `eac-user.json` — contains a **real login token** and the GitHub login name, i.e. credentials. Same rule as `.credentials.yaml`: it **never travels over git**; copy it yourself when needed. It is also in `NEVER_COPY`, so even if the allowlist were ever mistakenly changed to the whole `'our-free-model'` directory, that gate still holds.

> **The cross-machine semantics of `stats.json` (collecting it has a cost, and that cost is known)**: it is a **machine-local cumulative tally** (`days` / `models` / `requests` / `failedRequests` / `samples`). Two machines each accumulate locally and then overwrite each other through the repo — **whichever synced last wins**. With the current implementation you cannot have "both machines complete"; all you get is "one copy follows the repo". Making both correct requires turning it into a mergeable ledger (union or max per day / per model) — **not implemented**.

> The `forward.key` / `egress.url` / `chanGateway.relay.key` fields in `settings.json` are currently empty strings. If real secrets are ever filled in, the secret scan will report them and block the commit **rather than** loosening the scan rules.

### Skill location

DSH reads Skills from multiple root directories: `<project-root>/.dsh/skills`, `<project-root>/.agents/skills`, `<DSH_HOME>/skills`, `~/.agents/skills`. This plugin only covers **`<DSH_HOME>/skills`** (i.e., `~/.dsh/skills`) — so Skills must be placed in the user-level directory to be synced. Those in project-level `.dsh/skills` are not in scope.

### Never copied

Any path segment matching is denied:

- **Exact filenames**: `.credentials.yaml` / `credentials.yaml` / `credentials.json` / `.env` / `node_modules` / `.pnpm` / `.git` / `session_projcache` / `.anonymous-user-id` / `.dshw-size.json` / `.dshw-usage.json` / `cordis.yml` / `workspace-local-paths.json`
- **Suffix rules**: `*.bak*` / `*.pem` / `*.key` / `.credentials*`
- **Sole exception**: `profiles/<profile>/cordis.patch.yml.bak-plugin-manager` (config backup written by the plugin manager, useful for cross-machine restore) is allowed by exact full-path match; all other `*.bak*` remain denied

**Out of scope**: `sessions/`, `attachments/` (permanently excluded since 0.2.0), **`.agent-presets/`, `pet.json`, `storages/workspace.json` (removed in 0.2.5)**, **`dsh-session-archive/` (removed in 0.2.6)**, `node_modules`, secret files, derived artifacts (`cordis.yml`, `storages/session_projcache`), local-only state (`.anonymous-user-id`, etc.).

**Three entries removed in 0.2.5, each for its own reason**:

- `.agent-presets/` — no custom agent presets in use;
- `pet.json` — the desktop-pet plugin isn't enabled, purely dead file;
- `storages/workspace.json` — contains **machine-specific absolute paths** that would need manual editing on another machine anyway (see "Compatibility & boundaries" below); syncing it only creates noise from "workspace pointing to non-existent locations after the move".

**One more entry removed in 0.2.6**:

- `dsh-session-archive/` — the **archive ledger and runtime state** of [`@linxin666/dsh-session-archive`](https://www.npmjs.com/package/@linxin666/dsh-session-archive) (`archive-ledger.json` + `state.json`). It's **purely local state**: recording "which sessions were archived when", while sessions themselves are never synced across machines (`sessions/`, `attachments/` already excluded), making the ledger meaningless on a new machine; the auto-archive **policy** lives in `profiles/<profile>/cordis.patch.yml`, which is synced, so the new machine will start its own ledger. Previously it also created an illusion: the config repo's `.gitignore` happened to exclude it too, so it was "copied into the repo but never committed", while the panel showed pending = 0.

Removed content **remains in the repo history** (`git log -- <path>` to retrieve); to re-enable sync, add the corresponding line back to `WHITE_LIST`.

> Side note (a lesson from hands-on testing on 2026-10-06): **any** allowlist entry that's also excluded by the config repo's `.gitignore` becomes "copied locally, never committed, yet the panel shows synced". When modifying the allowlist, it's worth cross-checking the repo's `.gitignore`.

**Since 0.2.0, the sync scope narrowed to "configuration surface"**: session logs and attachments **are no longer uploaded**. `sessions/` is zstd binary — append-only, impossible for git to diff or line-merge, and simultaneous edits on two machines would inevitably conflict; `attachments/` is the same and also local private data. After a machine switch, the configuration surface plus each machine's own session copies are enough to recover. **Old session files already committed to the repo are not deleted** (only new ones stop being added); history is preserved.

### Export private config (new in 0.4.0, purely local)

**This is a second, entirely separate path from "sync to a git repository"** — do not conflate the two:

| | Sync (one-click sync / collect / restore) | Export private config |
|---|---|---|
| Destination | your private git repository (pushed to a remote) | a folder on this machine's disk |
| May it carry credentials? | **Never** — credentials sit on the hard blacklist | **Yes** — it is never uploaded |
| Network | fetches / pushes | **no network at all** |

The "Export private config" button copies the files below into a `DSH私钥配置` folder under the **target directory** (editable in the panel; **blank means Desktop**), **preserving the original relative layout**, and writes a `README.md` explaining what each file is and where it goes on the new machine:

| File | Needed? | What it is |
|------|---------|------------|
| `channel-pack/state.json` | required | Channel-account roster and credential index (provider / nickname / enabled / `credentialRef`). No plaintext secrets itself, but without it the account list is empty |
| `channel-pack/auto-checkin.json` | optional | Auto check-in record. Skipping it just re-counts today on the new machine |
| `channel-pack/token-ledger.json` | optional | Usage ledger. Skipping it restarts the statistics from zero |
| `.credentials.yaml` | required | ⚠️ **The credentials themselves** — every channel account's key lives in this one file |
| `our-free-model/eac-user.json` | depends | ⚠️ The co-build channel's GitHub login token and username (unrelated to channel accounts). Skip it and you re-authorise on the new machine |

**Why a separate path is necessary**: `.credentials.yaml` and `eac-user.json` are both on the sync hard blacklist (see the previous section), so "one-click sync" can never touch them — by design. That means these files can **only be moved by hand** on a machine switch, and this feature exists to make that hand-move hard to get wrong.

**Three implementation constraints** (do not relax them when editing this code):

1. **Purely local** — never touches git, never makes a network request;
2. **No content parsing** — byte copies only; the contents of `.credentials.yaml` / `eac-user.json` must **never** reach the log or the README (content in a log is a leak);
3. **No permission loosening** — uses `fs.copyFileSync` rather than the internal `copyFileRobust` (which chmods the target to `0666`), and tightens the target to `0600` on POSIX.

**How to import**: this feature **only exports** — there is no "import" button. Follow the table in the README inside the export folder, copy the files back to their `$DSH_HOME` locations on the new machine, and restart DSH. Neither this plugin nor DSH ever reads those credential files to upload or compare them.

> Tests live in `test/test-private-export.mjs` (32 assertions), including explicit ones that neither the log nor the README may contain credential contents, and that no path in the list is ever on the sync allowlist.

### Safety design (three gates)

> **New machine? You don't need to touch API settings**: `DEEPSEEK_API_KEY`, `BAILIAN_API_KEY`, `BAILIAN_HE_API_KEY`, and other secrets are not in the sync scope — just configure them directly on the new machine.

1. **File-level hard deny-list**: any path segment matching is denied. This is the only gate that doesn't depend on content analysis — `.credentials.yaml` is therefore structurally impossible to collect.
2. **Pre-commit staging-area review**: after `git add`, checks `git diff --cached --name-only`; if any secret-like filename appears → `git reset` and abort the commit.
3. **Secret scan**: reads `.credentials.yaml` to extract real key values for **exact matching**, combined with generic regexes (`sk-…`, GitHub tokens, AWS keys, private key blocks, Bearer headers, `api_key:` assignments).

Of the three gates, the first two hard-block and the third only warns. Regex cannot exhaustively capture all secret forms — the scan is an aid, not the primary gate; the primary gate is the file-level deny-list in gate 1.

Other constraints: **no force push, no history rewriting**; git runs non-interactively (`GIT_TERMINAL_PROMPT=0`), so no credential popup will stall the host; API routes only accept same-origin requests (rejecting `sec-fetch-site: cross-site`).

## Compatibility & boundaries

- **Workspace mapping no longer synced** (since 0.2.5): `storages/workspace.json` contains absolute paths (e.g., `D:\Fish-code\DSH`) — on a new machine it should be generated by that machine; this plugin neither collects it nor overwrites it during restore.
- **Sessions are zstd-compressed binary** — git can't diff or line-merge them. Simultaneous edits to the same session on two machines will produce a binary conflict; this plugin does not do content-level merging.
- **Repo only grows**: session data is append-only; deleting local sessions won't shrink the repo.
- **Restart DSH** after installing the plugin to see it in the settings page.
- Requires `git` on PATH. If your machine uses an HTTPS-intercepting accelerator (e.g., Watt Toolkit / SteamTools), git may report TLS errors — see the repo's `AGENT-GUIDE.md` §9.1 for the fix.
- **Sync works even without a git identity configured**: before committing, it probes `user.name` / `user.email`; if neither is set, it temporarily uses the origin's GitHub owner name for the commit (see "Three bugs already fixed" below). To pin your own identity, run `git config user.name` / `user.email` in the repo.
- The host half's `ctx.webServer` routes are protected by **loopback + same-origin** — no additional auth layer.
- **Only user-level Skills** (`$DSH_HOME/skills`) are covered. Project-level `.dsh/skills`, `.agents/skills`, and `~/.agents/skills` are out of scope.
- Deliberately not synced: `skin-center/` (the **wallpaper projects** imported into the wallpaper library — hundreds of MB, and re-importable from the local Wallpaper Engine; its `.cache/we-tokens.json` holds nothing but machine-local Steam paths) and `*.bak*`. As for lock files such as `task-board/ledger-v2.lock`: they are simply **not in the whitelist**, so they are never carried over either — there is no separate "lock file rule".

### Three bugs already fixed

**Missing git identity would fail the entire sync.** On a brand-new machine with neither `user.name` nor `user.email`, `git commit` refuses outright (`Author identity unknown … unable to auto-detect email address`) — and a brand-new machine is precisely when "restore on a new machine" most needs the sync to succeed. In 0.2.3 and earlier, this error was lumped into a generic "push failed", with the panel only showing "push doesn't work" — the real cause was completely invisible. Now: before committing, it probes the identity (`git var GIT_AUTHOR_IDENT`, the same resolution `git commit` uses); if none is found, it commits using the **origin's GitHub owner name** (formatted as `<owner>@users.noreply.github.com`, consistent with the repo's existing commits); if origin isn't available, it falls back to "local login name @ hostname", and logs in the panel who was used and how to pin it. **Machines with a configured identity are completely unaffected** (not even `-c` is injected — the author is whoever you configured).

**Windows read-only targets would break overwrite.** `copyFileSync` carries the source file's **read-only attribute to the target**, and Windows's `CopyFileW` returns `ERROR_ACCESS_DENIED` when the target exists and has `ReadOnly`. Combined, the result was "first collect succeeds, every subsequent one fails". Fix: clear the target's read-only bit before copying; if that still fails, delete the target and retry; after copying, keep it writable. (Measured: 108 read-only files in the repo before the fix, 0 after, 0 skips during collect.)

**A single file failure shouldn't blow up the entire sync.** The plugin runs inside the DSH host process, while sessions and attachments **are being written by that very process** — `EBUSY` / `EPERM` is the norm. Now each file gets its own `try/catch`; failures are recorded in `skipped` and listed in the panel log, while the rest of the files sync as usual.

## Development & testing

- **Zero npm dependencies**: only `node:` built-in modules. The host loader passes `config` through as-is when the plugin doesn't export a `Config` schema (`if (!runtime.Config) return config`), so schemastery isn't introduced here.
- The web half is hand-written with `react.createElement`, only `require('react')`, with no dependency on any `@deepseek-ai/*` client package.
- Host exports: `name` / `inject = ['webServer']` / `apply(ctx, config)`.
- Web exports: `inject = ['slots']` / `apply(ctx)`, registering a page under `settings.section`.

**Tests**: the sync engine passes all **120 cases** (`node test/test-sync-engine.mjs`); the settings-page client passes all **37 cases** (`node test/test-client.mjs`).

This package has no `scripts.test` configured; test entry points are six files:

```sh
node test/test-sync-engine.mjs      # Sync engine: allowlist / collect / restore / diff / deny gate
node test/test-client.mjs           # Web half rendering and copy assertions
node test/client.test.mjs           # Web half load smoke test (node:test)
node test/commit-identity.test.mjs  # Commit fallback without git identity (real temp repo + real commit)
node test/test-push-retry.mjs       # Retry-push semantics (real remote)
node test/test-remote-merge.mjs     # Fast-forward / rebase on remote divergence (real remote)
```

> Just `node <test-file>` is fine — do **not** use `node --test test/`: the test runner spawns child processes and captures pipe output, which fails with `EPERM` in a confined sandbox.
>
> The last three cases (`commit-identity.test.mjs` / `test-push-retry.mjs` / `test-remote-merge.mjs`) spawn child processes to call `git`, which fails with `spawn EPERM` in a confined sandbox — this is an **environment limitation**, not a code issue; please run them in a normal terminal.

## Relationship with the umbrella package

> This package is one of the members of the [`@fish-under-sea/dsh-fish`](https://github.com/Fish-under-sea/dsh-fish) umbrella package; installing it individually only affects this one item.

## License

MIT © Fish-under-sea
