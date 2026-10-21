# @fish-under-sea/dsh-settings-nav-order

**1.0.1 · Settings Navigation**

[简体中文](README.md)

## Features

Reorders and hides settings navigation entries, persists presentation preferences and leaves other plugins unchanged.

## Installation

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-settings-nav-order@1.0.1
```

Also included in `@fish-under-sea/dsh-fish@1.0.1`. Do not expand duplicate rows through both aggregate and standalone bundles. Restart DSH after installation; use the desktop plugin manager when no CLI is available.

## Configuration and Safety

State is stored in $DSH_HOME/dsh-settings-nav-order/state.json with browser-local preferences. Hiding a section does not disable its plugin.

Node requirement: `>=20`. Host compatibility follows this package manifest; the aggregate does not override Host checks.

## Maintenance and Attribution

1.0.1 is a coordinated release number, not a claim that all latest upstream commits are merged. Historical documentation remains in Git; see [aggregate changelog](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.en.md).

Fish-native plugin. License: MIT.
