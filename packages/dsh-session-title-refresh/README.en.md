<div align="center">

# @fish-under-sea/dsh-session-title-refresh

**Session titles that evolve with the conversation — no longer stuck on the first message.**

[![npm](https://img.shields.io/npm/v/@fish-under-sea/dsh-session-title-refresh?style=flat-square&label=npm&color=cb3837)](https://www.npmjs.com/package/@fish-under-sea/dsh-session-title-refresh)
![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square)
![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.0--rc.2-4b6ef6?style=flat-square)
![plugin](https://img.shields.io/badge/plugin-client%20%2B%20host-6b7280?style=flat-square)

[简体中文](README.md) · **English**

</div>

> **Note: This plugin disables the built-in DSH session-title provider (`session-title-llm`) and takes over title generation entirely.** The switch is applied automatically via `cordis.patch.yml` at install time.

## What problem does it solve

DSH's built-in title mechanism generates a title once — after the very first message — and never recomputes it. Long sessions end up with a title stuck on that opening line, growing more and more misleading as the conversation drifts.

This plugin replaces the built-in provider and becomes the **sole title provider**. It keeps the first-message naming behavior and adds periodic refreshes: after N human turns it summarizes the session's direction and names it, then refreshes every M turns. N, M, and their adjustable bounds are all configured under **Settings → Session Title Auto-Refresh**, with preset profiles and tunable hard limits.

## How it works

| Mechanism | Detail |
| --- | --- |
| Trigger | Counts human turns only (plugin-injected messages are excluded); first summary at turn N, then every M turns |
| Generation | A **standalone auxiliary model call** (`ctx.llm.stream`, `purpose: 'session-title'`) |
| Persistence | Written as a `session/title` event; the client list row and title bar update accordingly |
| Blast radius | **Does not enter the main conversation context, does not add tokens to the main request, does not block the main response** |
| Sampling | First message + the most recent human messages (default window: 8) — the first anchors the session's original intent, the tail captures its current direction |
| Budget overflow | Drops middle messages and truncates long ones when the input budget is exceeded; **the first and latest messages are never dropped** |
| Failure | Timeout / no route / no text from the model → keeps the old title, logs one line in the settings page, does not affect the conversation |

Three iron rules:

1. **Respect manual naming** — sessions whose title was set by the user stop auto-refreshing by default (toggleable).
2. **Never touch subagent sessions** — subagent conversations are never auto-titled.
3. **Never backfill history** — trigger points align to an absolute grid (turns N, N+M, N+2M, …). Hot-reloading the plugin, restoring old sessions, or changing parameters never fires a burst of catch-up title calls, so quota is never burned repeatedly.

## Installation

```sh
# Install from npm (recommended)
# Replace <profile> with your actual profile name: desktop for the desktop app, web for the web app
dsh plugin --profile <profile> add @fish-under-sea/dsh-session-title-refresh
```

**Restart DSH** after installation (the plugin row and settings page take effect on next launch), then open **Settings → Session Title Auto-Refresh**.

Use `link:` to point at a local clone only when you need to modify the source (the repo source becomes the install source; restart DSH after changes to see them). This writes the `link:` path into `profiles/<profile>/package.json` — remember to `remove` it before moving to another machine.

### Uninstall / revert

```sh
dsh plugin --profile <profile> remove @fish-under-sea/dsh-session-title-refresh
```

After removal, the patch in `cordis.patch.yml` that disables the built-in first-message provider is undone, and DSH reverts to its **factory-single-first-message naming** behavior. No manual file edits needed.

## Usage

| Section | Content |
| --- | --- |
| **Preset profiles** | Conservative / Balanced (recommended) / Aggressive. Click to fill parameters, then click **Save Settings** to apply |
| **Sliders** | First summary turn, refresh interval — the slider ceiling is the adjustable cap set under **Advanced** |
| **Toggles** | Enable auto-refresh; "Keep refreshing after I manually rename" |
| **Title model (optional)** | A dropdown: `Follow session's current model (default)` / model list grouped by provider / `Custom… (enter provider / model manually)`. The list is **sourced from the same data** as the Models page (the host calls `ctx.llm.listProviders()` + `listModels()`), advisory only — combinations outside the catalog can still be entered via **Custom…** |
| **Advanced** | Adjustable caps for first turn and interval, sample window size, input byte budget, output token limit, timeout, target word/character counts |
| **Active sessions** | Current turn, next trigger turn, refresh count, current title, and per-session **Refresh now** |
| **Recent auto-naming** | Last 20 records (titles for successes, reasons for failures) |

### Title model dropdown

Starting in v0.3.0, the two bare provider/model text inputs that used to live at the bottom of the **Advanced** collapsible section have moved into a dedicated **Title model (optional)** card, with a new dropdown on top:

- **Follow session's current model (default)** — leave blank to follow; title generation uses the same route as the main conversation.
- **Model list grouped by provider** — **sourced from the same data** as the official DSH Models page: the host calls `ctx.llm.listProviders()` + `ctx.llm.listModels(provider)` and exposes the result through a new read-only same-origin route `GET /dsh-session-title-refresh/api/models`. The implementation mirrors DSH's own `buildModelCatalog` exactly.
- **Custom… (enter provider / model manually)** — the catalog is advisory, not restrictive: DSH itself allows calling unlisted model ids, so combinations outside the catalog fall through to manual entry. The UI hints but never blocks or prevents saving.

Degradation paths (**the settings page never breaks**):

- A single provider's catalog read fails → recorded in `skipped` only; the UI shows "These providers' model catalogs could not be read — you can still enter them manually via Custom…", and the remaining providers list normally.
- The entire `ctx.llm` is unavailable → returns `{ ok: false, reason }` with the cause; the UI falls back to manual entry.

Blank = follow the session's current model. Once selected, the title is always generated with that model, regardless of which model the main conversation uses.

Cost note: the extra call is billed per session turn. For a 30-turn long session, Balanced fires roughly 6 auxiliary calls, Aggressive about 10, Conservative about 3. Push toward Conservative to save quota.

## Configuration

Config file path: `$DSH_HOME/dsh-session-title-refresh/config.json`. It is not synced to any repository — each machine has its own settings.

### Default parameters (Balanced profile)

| Parameter | Default | Range |
| --- | --- | --- |
| First summary turn | 3 | 1 – adjustable cap (default 10) |
| Refresh interval | 5 turns | 1 – adjustable cap (default 20) |
| Sample window | 8 | 2 – 40 |
| Input byte budget | 4096 | 256 – 65536 |
| Output token limit | 64 | 16 – 512 |
| Timeout | 60 s | 5 – 300 s |
| Target length | 5 words / 10 CJK characters | 1 – 20 words / 2 – 40 characters |
| Route | Follow session's current model | Pick a fixed combination from the **Title model** dropdown, or enter provider + model manually via **Custom…** |

## Compatibility and boundaries

- **DSH allows only one title provider per process.** This plugin's `cordis.patch.yml` disables the built-in `@deepseek-ai/dsh-session-title-first-prompt-llm` (row id `session-title-llm`) and takes over. Behavior is preserved — this plugin also registers at `first-prompt` cadence, so turn 1 still gets a title. If another title-provider plugin is installed at the same time, the two will fight for the slot; disable one of them.
- **Failed title generation preserves the old title** — it is never cleared and never falls back to the first message.
- **`enabled: false` only stops auto-refresh**; the turn-1 title is still generated by this plugin's provider.
- The active session list comes from the **current process**: sessions restored after a DSH restart reappear only after they emit another human message (the titles themselves are persistent and remain in the session log).
- Generating a title on the first turn requires the session to have recorded a main-request route at least once. In the rare case of "refresh title immediately after creating a session", it may fail because no route is available — pin a provider/model in the **Title model** dropdown to work around this. When the model catalog cannot be read (the llm service is not ready), the card shows the reason and keeps the manual entry path available; the settings page stays functional.
- **`FinishReason` is an object, not a string** (`{ kind: 'stop' }`). The assembler parses by `kind`; `error` / `aborted` carry `failure.message` and `failure.code` into the error text. Test fakes must also feed objects — the 0.1.0 fakes fed the string `'stop'`, which masked this defect and caused all real-session auto-naming to fail with "abnormal finish reason ([object Object])" (fixed in 0.1.1).

## Development and testing

```sh
# Run all tests (core 18 + host 20 + client 13 = 51 cases)
node test/run-all.mjs

# Or run a single file
node test/core.test.mjs
```

> **Do not** use `node --test test/` — the test runner spawns child processes and captures pipe output, which fails with EPERM in confined sandboxes.

| File | Responsibility |
| --- | --- |
| `lib/core.js` | Pure logic: config clamping, turn scheduling, message sampling, stream assembly, title cleaning, model catalog normalization (`normalizeModelCatalog`) |
| `lib/index.js` | Host half: registers the title provider, listens to session events, same-origin HTTP API (including the read-only `GET /models` catalog route), `buildModelCatalog` |
| `lib/client.js` | Web half: settings page (no JSX, only `require('react')`) |
| `cordis.patch.yml` | Bundle layer: disables the built-in provider + inserts this plugin's row |
| `test/*.test.mjs` | Test suite, zero dependencies (only `node:test` and built-in modules) |

Design notes:

- **Zero npm dependencies** — the host loader passes `config` through as-is when the plugin does not export a `Config` schema, so schemastery is not imported; HTTP request body parsing is also hand-written.
- **Turn counts are derived from the session log** (`session.ownEvents()`, which excludes the prefix inherited from forks), so counts remain accurate across restarts, restores, and hot-reloads.
- **Trigger points align to an absolute grid**; mid-stream takeovers never backfill.
- Changing rules (saving settings) re-aligns all active sessions' trigger points to the new rules, again without backfilling history.
- **The model catalog is advisory only** — `normalizeModelCatalog` only cleans (drops empty ids, deduplicates within a provider, drops providers with zero models, falls back to `id` when `name` is missing). It never produces any "rejected" information. A single provider's `listModels` failure is recorded in `skipped`; a full `ctx.llm` chain failure returns `{ ok: false, reason }` — in both cases the UI falls back to manual entry and the settings page never fails to open.

## Relationship with the bundle

> This package is one of the members of the [`@fish-under-sea/dsh-fish`](https://github.com/Fish-under-sea/dsh-fish) bundle. Installing it standalone affects only this item.

## License

MIT © Fish-under-sea
