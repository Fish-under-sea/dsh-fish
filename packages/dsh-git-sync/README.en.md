# @fish-under-sea/dsh-git-sync

**1.0.0 · Git Sync**

[简体中文](README.md)

## Features

Previews, commits, pulls and restores selected DSH configuration through a private Git repository; secret export is separate from normal sync.

## Installation

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-git-sync@1.0.0
```

Also included in `@fish-under-sea/dsh-fish@1.0.0`. Do not expand duplicate rows through both aggregate and standalone bundles. Restart DSH after installation; use the desktop plugin manager when no CLI is available.

## Configuration and Safety

Configuration lives under $DSH_HOME/dsh-git-sync/. Sync is not a full backup. Do not commit tokens, keys, session logs or SSH passwords. Back up before restoring and keep sensitive exports local.

Node requirement: `>=20`. Host compatibility follows this package manifest; the aggregate does not override Host checks.

## Maintenance and Attribution

1.0.0 is a coordinated release number, not a claim that all latest upstream commits are merged. Historical documentation remains in Git; see [aggregate changelog](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.en.md).

Fish-native plugin. License: MIT.
