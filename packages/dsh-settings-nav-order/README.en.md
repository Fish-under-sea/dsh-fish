<div align="center">

# @fish-under-sea/dsh-settings-nav-order

**Reorder the DSH settings panel's sidebar menu and hide items you never use.**

[![npm](https://img.shields.io/npm/v/@fish-under-sea/dsh-settings-nav-order?style=flat-square&label=npm&color=cb3837)](https://www.npmjs.com/package/@fish-under-sea/dsh-settings-nav-order)
![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square)
![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.0--rc.2-4b6ef6?style=flat-square)
![plugin](https://img.shields.io/badge/plugin-client%20%2B%20host-6b7280?style=flat-square)

[简体中文](README.md) · **English**

</div>

## What Problem Does This Solve

The sidebar menu in the DSH settings panel (General / Models / Built-in Plugins / Agent Presets / Archived Sessions / Git Sync / …) has its order baked into each plugin's own `settings.section` registration (a numeric `order`). The GUI offers no way to rearrange items or hide the ones you don't need. Moving a frequently used item to the top—or tucking away one you haven't touched in a year—means editing someone else's plugin package. Packages inside the asar are lost on every upgrade, and packages under the profile directory get overwritten by plugin updates.

This plugin never touches third-party code. Reordering is done by applying CSS `order` to the navigation buttons; hiding is done by applying `display:none`. The DOM order, every other plugin's code, and React keys all stay untouched.

## What You Get

- Drag the `⋮⋮` grip to reorder, or tap `↑` / `↓` for fine-grained adjustments.
- Tap "Hide" to collapse an item from the sidebar—the plugin itself keeps working.
- Changes take effect immediately after saving; hidden items appear as grayed-out strikethrough entries in the panel—tap "Show" to bring them back.
- Uncheck "Enable manual ordering and hiding" or tap "Reset to Default" to instantly restore every plugin's original layout.
- **Preferences survive machine changes** (since 0.1.2): saving writes a snapshot to the host file `$DSH_HOME/dsh-settings-nav-order/state.json`, which [`dsh-git-sync`](https://github.com/Fish-under-sea/dsh-fish/tree/main/packages/dsh-git-sync) carries into the config repository. Open the settings page on a new machine and everything is restored—no manual reordering needed.

## Installation

```sh
# Recommended: install via the bundle (see the repository root README)
dsh plugin --profile <profile> add @fish-under-sea/dsh-settings-nav-order
```

Replace `<profile>` with your DSH profile name: `desktop` for the desktop app, `web` for the web app.

Use `link:<absolute path to this directory>` only when you need to modify the source.

You must **restart DSH** after installing: the plugin entry in `cordis.patch.yml` is only expanded at startup—refreshing the page is not enough.

## Usage

1. Open "Settings" and click "Settings Nav Order" at the bottom of the sidebar menu.
2. **Reorder**: drag the `⋮⋮` grip on each row, or tap `↑` / `↓` for fine adjustments.
3. **Hide**: tap "Hide" on any item you don't want to see—it disappears from the sidebar, but the plugin itself keeps working.
4. Tap "Save". The sidebar updates immediately.

Notes:

- Hidden rows appear as grayed-out strikethrough entries in the panel; tap "Show" to restore them.
- Unchecking "Enable manual ordering and hiding" and saving = fully restore every plugin's original layout.
- Tapping "Reset to Default" = clear the saved order and hidden items, also restoring the original layout.
- The "Settings Nav Order" page **cannot hide itself**: it is the only entry point for unhiding items—hiding it would lock you out permanently.

## Configuration

**There is nothing for you to fill in**—no `config` block is needed in the plugin entry; the path is fixed.

Data lives in two halves, each with its own role:

| Half | Location | Role |
| --- | --- | --- |
| Browser half | `localStorage` key `dsh-settings-nav-order/v1` | **Working copy**: drives the current render; reads and writes never touch the network |
| Browser half | `localStorage` key `dsh-settings-nav-order/v1.synced` | Fingerprint: the **verbatim text** of the last snapshot that was successfully aligned with the host, used to distinguish "local hasn't changed" from "local has unsaved changes" |
| Host half | `$DSH_HOME/dsh-settings-nav-order/state.json` | **Mirror**: written on save, read back on startup; whitelisted by `dsh-git-sync` |

All three share the same shape:

```json
{ "enabled": true, "order": [{ "name": "Models", "index": 0 }], "hidden": [{ "name": "Web Plugins", "index": 0 }] }
```

- The shape guard accepts only the three keys `{enabled, order, hidden}`; extra fields are discarded.
- `enabled` counts as disabled only when it is explicitly `false`; any other case (missing, `null`, non-boolean) is treated as enabled.
- Each item in `order` / `hidden` is `{name, index}`—items with the same name are distinguished by their position within the group, so adding or removing menu items won't shift existing entries around.

### Why the Host Half Exists

The preference actually takes effect in the browser's `localStorage`, but `dsh-git-sync` runs in the host process and cannot reach it. The host half writes it to a file so the sync plugin can carry it by relative path. Without this step, the sidebar order and hidden items could not be restored after switching machines.

### Cross-Machine Restoration (Since 0.1.2)

1. Adjust the order / hidden items on this machine and **tap Save**—the plugin pushes the snapshot to the host, writing the `state.json` file above.
2. Settings → **Git Sync** → one-click sync (requires `dsh-git-sync` ≥ 0.2.3, whose whitelist includes this file).
3. After restoring the config repository on the new machine, **open the settings page** and the order and hidden items are restored automatically—no manual reordering needed.

Startup reconciliation (`reconcile`) handles four scenarios, each mapping to a real-world situation:

| Scenario | Action |
| --- | --- |
| Host has no snapshot (first sync, new machine, file cleared) | Push the local preference up (so pre-existing order from before the upgrade also enters the repository) |
| Local has no config (new machine, site data cleared) | Adopt the host snapshot—**this is the restoration path** |
| Local matches the fingerprint verbatim (local hasn't changed) | Adopt the host's updated copy (another machine made changes) |
| Local differs from the fingerprint (unsaved changes exist) | **Keep local** and push to host—never silently discard your recent adjustments |

The fingerprint key stores the verbatim text of the last successfully aligned snapshot, compared **character by character**—no semantic equivalence. Losing this key at worst causes one extra push.

Any failure along the way (host not running, route missing, 500 response, body is not JSON) simply means "no reconciliation this time": the local order stays as-is, and the next startup retries on its own. A malformed snapshot from the host is treated the same way—as if there were no snapshot at all.

### Save Receipts (No False Success)

After tapping "Save" or "Reset to Default", a line appears in the panel reporting the outcome for the **host file**:

| Receipt | Meaning |
| --- | --- |
| Host file: writing… | Request sent, response not yet received |
| Host file: synced—Git Sync will carry this preference; restorable on another machine. | File written successfully, fingerprint recorded |
| Host file: not synced—local changes are in effect; the host channel will auto-retry when it recovers. | Write failed (host not running / disk full / permission change); local changes still work, fingerprint not recorded, next startup auto-retries |

When the host side fails to write, it also logs a line in the DSH host log: `dsh-settings-nav-order: failed to write preference file (…)`. The browser half silently retries on failure—if the host side stayed silent too, the only symptom would be "the order never gets restored" with no way to diagnose it. Reading a corrupted file also leaves a log entry (treated as "no snapshot", never used to overwrite local data).

The browser's **startup reconciliation** also distinguishes two kinds of failure: host unreachable / 500 / non-JSON body are expected paths (that's just what it looks like when the host hasn't restarted yet) and are never logged—otherwise every page open would flood the console. Only when "the response was received but a later step threw" does a line appear in the browser console—that's no longer an environment issue, it's a code defect and shouldn't be swallowed silently.

The host half reads and writes **only this single fixed path** (`state.json`): atomic write (write `.tmp-<pid>` then `rename`, so a half-written JSON never gets synced into the repository), shape guard (accepts only `{enabled, order, hidden}`, rejects bad data), request body limit of 64 KB, same-origin guardrail (rejects `sec-fetch-site: cross-site`), and does not accept caller-specified paths—otherwise it would be an arbitrary write interface.

The atomic write's read-only target fallback is "clear the read-only bit, then rename"—**never delete the original file first**. If a second rename were to fail after deletion (file in use, transient I/O error), the user's preference would be truly lost.

## Compatibility and Edge Cases

- **No DOM reordering, no third-party plugin code touched**: the container is flex column; applying `style.order` to children changes only the visual order. Hiding is just `display:none`—nodes are never removed, and unhiding brings them back instantly.
- **Drag is self-implemented**: Pointer Events + `setPointerCapture` + per-row vertical midpoint drop calculation (`dropIndex` + `adjustDrop`), no third-party library, works on touch screens. Both arrow buttons and drag end up going through the same `moveTo`, so the two interactions always produce identical results.
- **Substring match via `[class*="navList"]`**: the real DOM class names are CSS Modules hashes (`ZiQlkq_navList` / `ZiQlkq_navLabel`), so an exact `.navList` selector wouldn't match. Matching "class name contains the original name" survives DSH hash-prefix changes.
- **Same-name items distinguished by group index**: menu items have no id or data attribute, so they can only be identified by label text. The config stores `{name, index}` rather than bare names, so adding or removing menu items won't shift existing entries.
- **MutationObserver on `document.body` subtree**: the settings panel is mounted via a portal on `document.body`, so reordering runs as soon as the panel appears. Callbacks are coalesced per frame (`requestAnimationFrame`), so streaming output in the chat area doesn't turn this into a performance issue.
- **Self-lock prevention**: "Settings Nav Order" itself can never be hidden—it's the only entry point for unhiding items.
- **Failures fall back to the original layout**: if the panel can't be read, styles can't be applied, or the config is corrupted (bad JSON, wrong field types, `localStorage` throwing in private mode), the only result is that ordering / hiding doesn't take effect—no blank screen, no missing items.
- **Hiding removes only the entry, not the plugin**: hidden plugins keep working normally; to fully disable one, go to the plugin management page.
- **UI language affects recognition**: menu items are identified by their displayed text. Switching to an English interface makes the Chinese names in the config temporarily unmatched; other items are unaffected. Switching back to Chinese restores matching.
- **Tied to the browser profile**: switching browsers, clearing site data, or using private mode all make the local copy unreadable—in these cases, each plugin's original layout is shown. The host file still exists, and opening the settings page auto-fills from it (unless local has unsaved changes, in which case local takes priority).
- **Installing / uninstalling plugins**: menu items that no longer exist in the config are treated as stale and ignored; newly installed plugins' menu items are appended after the saved order and are not hidden by default.

## Development and Testing

```sh
node test/client.test.mjs   # Browser half: loading → order computation → applying to elements → settings page interaction → host reconciliation → save receipts
node test/host.test.mjs     # Host half: state.json read / write / rejection / abort / guardrails / failure logging
```

Zero dependencies: a hand-written fake DOM + fake React drive the full pipeline—53 client test cases; the host half uses a fake `ctx.webServer` + fake req / res—17 test cases (`DSH_HOME` points to a temporary directory, never touches the real home). **All 70 test cases pass.**

The reconciliation rules for cross-machine restoration (adopt host / keep local / push up / retry on failure) each have corresponding test cases, as do every posture of host unreachable and bad data; "report sync results truthfully after saving", "never falsely report success", and "log unexpected errors while keeping expected failures quiet" each have their own cases too.

The pointer-follows-finger drag effect can't be tested with a fake DOM (fake elements have no layout); tests cover the pure functions it depends on (`moveTo` / `dropIndex` / `adjustDrop`) and result consistency with arrow buttons. For feel, test on a real device.

> Don't use `node --test test/`: the test runner spawns child processes and captures pipe output, which fails with `EPERM` in restricted sandboxes. Run the test files directly instead.

## Relationship with the Bundle

> This package is one of the members of the [`@fish-under-sea/dsh-fish`](https://github.com/Fish-under-sea/dsh-fish) bundle; installing it alone affects only this item.
>
> Cross-machine restoration depends on [`dsh-git-sync`](https://github.com/Fish-under-sea/dsh-fish/tree/main/packages/dsh-git-sync) (≥ 0.2.3): this plugin's host half writes the preference to `$DSH_HOME/dsh-settings-nav-order/state.json`, and `dsh-git-sync`'s whitelist picks it up by that relative path. This plugin only writes the file; the sync plugin handles the transport—responsibilities stay cleanly separated.

## License

MIT © Fish-under-sea
