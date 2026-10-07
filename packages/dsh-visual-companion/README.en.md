<div align="center">

# @fish-under-sea/dsh-visual-companion

**Click on the page and move on — give your DSH session a visual companion: pick, annotate, submit, and the session continues on its own.**

[![npm](https://img.shields.io/npm/v/@fish-under-sea/dsh-visual-companion?style=flat-square&label=npm&color=cb3837)](https://www.npmjs.com/package/@fish-under-sea/dsh-visual-companion)
![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![node](https://img.shields.io/badge/node-%5E22.19.0%20%7C%7C%20%3E%3D24.0.0-339933?style=flat-square)
![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.0--rc.2-4b6ef6?style=flat-square)
![plugin](https://img.shields.io/badge/plugin-host%20only-6b7280?style=flat-square)

[简体中文](README.md) · **English**

</div>

## What problem does this solve

When reviewing prototypes, comparing layouts, or picking options in a browser, two things get in the way:

1. **You have to switch back to the terminal and retype your choices**: "I pick B, and make the colors cooler" — the person reviewing the mockup shouldn't also be a typist;
2. **Or the opposite: every click wakes the assistant**: pick three options, interrupt the assistant three times — noisy and token-wasteful.

This plugin solves both: **picking stays completely silent** (only local page state changes), and **only pressing "Submit to assistant" wakes the session once**, delivering the full set of choices and notes in a single message.

## What you get

- **Silent picking**: clicking, unclicking, and typing notes never fire a request or wake the session;
- **One submit = one wake**: all selections plus notes are composed into a single user message, e.g.
  `[Visual Companion] User picked 2 items on the page: A (single-column layout), C (hybrid). Note: more spacing. Synced to you — just keep going (no need to ask).`
- **Auto-continue**: the session receives the message and starts a new turn immediately, no retyping needed;
- **Adaptive UI**: single-select / multi-select (add `data-multiselect` to the container), note field, waiting screen; the submit bar hides automatically when there are no options on the page.

## Installation

```sh
# Recommended: install from npm (--profile: desktop for the desktop app, web for the web app)
dsh plugin --profile <profile> add @fish-under-sea/dsh-visual-companion

# For source changes only: use link: (repo source is the install source; restart DSH to pick up changes)
dsh plugin --profile <profile> add "link:<repo-path>/packages/dsh-visual-companion"
```

**Restart the profile's host** after installing (new plugin packages require a restart to enter the composition; afterwards, only changes to `cordis.patch.yml` content can be hot-reloaded).

## Usage

This package consists of **two halves**, neither of which touches the model API:

- **Local service** (`bin/visual-companion.mjs`): zero-dependency HTTP server that renders pages, receives clicks, and writes `events.jsonl` and `pending.json`;
- **Host plugin** (`lib/index.js`): watches `state/pending.json` and, on each submit, delivers a user message to the target session and starts a new turn.

### Start the local service

A managed background task; the directory lives in a temporary location inside the workspace:

```sh
node "$DSH_HOME/profiles/<profile>/node_modules/@fish-under-sea/dsh-visual-companion/bin/visual-companion.mjs" \
  --dir "<workspace>/.dsh-visual" --port 0 --session "$DSH_SESSION_ID"
# → prints { url, port, key, screenDir, stateDir, pendingFile, session }
```

### Write a screen

Write HTML fragments into `<dir>/screen/` (use semantic filenames, don't reuse; write a full document — starting with `<!DOCTYPE` or `<html` — only when you need full page control).

### Open the page

Hand the `url` together with `?key=` to the user (in DSH, use `sidebar_open` to open it in the sidebar). Requests without the key are rejected with 403.

### Built-in styles

The service ships a framework stylesheet with these classes — just use them in your fragments:

| Purpose | Class |
| --- | --- |
| Options (single-select; add `data-multiselect` to the container for multi-select) | `.options` > `.option[data-choice]`, click calls `toggleSelect(this)`; `.cards` > `.card` works the same way |
| Visual blocks | `.mockup`, `.split`, `.pros-cons`, `.mock-nav`, `.mock-sidebar`, `.mock-content`, `.mock-button`, `.mock-input`, `.placeholder` |
| Text hierarchy | `h2` / `h3` / `.subtitle` / `.section` / `.label` |

### `visual_companion` tool

The plugin registers a `visual_companion` tool:

| Action | Parameters | Effect |
| --- | --- | --- |
| `arm` | `dir`, `session_id?` | Bind a directory and target session; `session_id` may be omitted (supplied later by `pending.json`) |
| `disarm` | — | Unbind and close the watcher |
| `status` | — | Binding state, wake count, last result, current `pending.json` |
| `wake` | `session_id`, `text` | Immediately probe the wake pipeline (bypasses the page) |

### On-disk files

All persisted files live in `<dir>/state/`:

| File | Content |
| --- | --- |
| `pending.json` | **Written only on submit**: `{type:"submit", selections:[{choice,text}], note, at, sessionId}` — the plugin watches this |
| `events.jsonl` | Appended per event: `click` is the picking process (no wake), `submit` is a full submission (wakes once) |
| `server-info` / `server-stopped` | Service startup info and shutdown reason |

### Slash command `/companion`

Type directly in a session:

```text
/companion [topic to review]
```

The plugin will: **①** start the local service in the background if it isn't running (zero dependencies, auto-assigned port); **②** hand the full URL with the session key to the current session's assistant, which opens it in the sidebar via `sidebar_open`; **③** have the assistant bind the watcher and write the first prototype screen into `screen/`. After that, just pick, write notes, and press "Submit to assistant".

> The command only handles "start the service + hand off" — what appears on the page is still decided by the assistant's HTML fragments. So it's more convenient than running `bin/visual-companion.mjs` by hand, but it won't decide what to show.

## Configuration

| Key | Default | Description |
| --- | --- | --- |
| `watchDir` | `""` | When non-empty, **auto-binds** that directory on load (config hot-reload / restart won't drop the binding); leave empty to `arm` manually via `visual_companion` |

The target session is **not stored in config**: it comes from the `sessionId` written with each submit (set by the service's `--session` at startup), so the same service can serve different sessions and no machine-specific session id ends up in shared config.

Machine-specific absolute paths don't go into the shared bundle. To enable auto-binding, override with the same id in your own profile patch layer:

```yaml
- id: visual-companion
  name: '@fish-under-sea/dsh-visual-companion'
  config:
    watchDir: D:/some/workspace/.dsh-visual
```

## Compatibility and boundaries

Delivery tries each strategy in order (closest to the public surface first) and returns the one that actually succeeds:

1. `agent.followup(createUserMessage(...))` — the same public path used by slash-command user-message injection;
2. `agent.steer(...)` — when the target is currently running;
3. `ctx.subagents[Symbol.for('dsh.subagent.queuePrompt' | 'deliverPrompt')]` — the host-internal delivery hook for renewable subagents.

- **host-only**: a host plugin (no `dsh.client`, no browser half, no frontend build) plus a local service — a zero-dependency HTTP server that serves the interactive browser page. That page comes from the local service, and is **not** a DSH client plugin;
- Zero-dependency service (Node stdlib only), auto-assigned port, URL includes a session key; `--host 0.0.0.0 --url-host <hostname>` supports remote / container use, but **`?key=` must be preserved**;
- Service **auto-exits after 4 hours idle** (tunable via `--idle-minutes`); screen files are temporary artifacts, don't treat them as deliverables;
- Degradation chain: no Node → self-contained HTML + `present`; no sidebar browser → hand the full URL to the user to open manually; plugin not installed → manually read `events.jsonl` next turn;
- Requires Node `^22.19.0 || >=24`, DSH `>=0.2.0-rc.2`; no API key needed;
- **Binding is fault-tolerant** (since 0.1.5): when `<watchDir>/state` doesn't exist yet, it is **created recursively**; if watching fails (path is not a directory, insufficient permissions), only a warning is logged and the state stays honestly "unbound" — **the plugin loads normally**, the tool and `/companion` don't disappear together, and `visual_companion({action:"arm"})` can retry once fixed;
- **Known limitation**: host plugin code is not hot-reloaded — changing `lib/index.js` requires restarting the host; only `cordis.patch.yml` content changes can be hot-reloaded.

## Development and testing

```sh
# Fresh clone: run pnpm install in the package directory first (zero runtime deps, but tests need the 3 DSH packages declared as devDependencies)
node packages/dsh-visual-companion/test/visual-companion.test.mjs   # message rendering + manifest contract + binding fault tolerance (10 cases)
pnpm pack                                                          # artifact check: files cover bin / lib / patch / README
```

`lib/message.js` is a **zero-dependency pure function** (message rendering), so tests and callers can verify the copy without installing `@deepseek-ai/*`; only `lib/index.js` depends on host-provided `@deepseek-ai/dsh-llm`, `dsh-tools`, and `schemastery` (**optional peers at runtime**, provided by DSH; **the same packages are separately declared as `devDependencies` for testing**, so a fresh clone can run tests right after `pnpm install` — no manual stuffing of `node_modules` needed).

## Relationship with the umbrella package

This package is one member of the [`@fish-under-sea/dsh-fish`](https://github.com/Fish-under-sea/dsh-fish) umbrella package: the umbrella's bundle layer inserts this plugin line into the profile, so installing the umbrella is equivalent to installing all Fish-built plugins at once. Installing this package alone affects only this one entry.

## License

MIT © Fish-under-sea
