# @fish-under-sea/dsh-settings-nav-order

**1.0.2 · Settings Navigation and Command Menu Order**

[简体中文](README.md)

## Features

Reorders and hides settings navigation entries and persists presentation preferences.

Version `1.0.2` adds icons, localized titles and a default order for four extension commands. Each row displays an icon, a localized title and its original command name, matching the desktop pet commands.

| Default order | English title | Command |
| --- | --- | --- |
| 1 | Agent Teams | `agent-teams` |
| 2 | Visual Companion | `companion` |
| 3 | Context Compression | `acp` |
| 4 | Cache Statistics | `acp-cache` |

The `acp` and `acp-cache` descriptions also follow the Chinese or English interface locale. Original command names, arguments and execution remain intact. Entries that already have Host-provided icons retain their existing presentation.

## Installation

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-settings-nav-order@1.0.2
```

Also included in `@fish-under-sea/dsh-fish@1.0.2`. Do not expand duplicate rows through both aggregate and standalone bundles. Restart DSH after installation; use the desktop plugin manager when no CLI is available.

## Configuration and Safety

Open **Settings → 设置导航顺序 → 斜杠菜单顺序**, move the four rows with ↑ / ↓ and select “保存命令顺序” to save. The command section has its own enable toggle and restore-default button. Search keeps the Host relevance order, and other commands retain their positions and sections.

State is stored in `$DSH_HOME/dsh-settings-nav-order/state.json` with browser-local preferences. Navigation and command preferences are saved and reset independently. Existing navigation order and hidden entries survive upgrades. Restore the Host state file on another machine and install this plugin to recover the preferences; future updates use the published plugin implementation.

Hiding a section does not disable its plugin.

Node requirement: `>=20`. Host compatibility follows this package manifest; the aggregate does not override Host checks.

## Maintenance and Attribution

1.0.2 is a coordinated release number, not a claim that all latest upstream commits are merged. Historical documentation remains in Git; see [aggregate changelog](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.en.md).

Fish-native plugin. License: MIT.
