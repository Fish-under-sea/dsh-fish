# @fish-under-sea/dsh-session-archive-fish

**1.0.1 · Session Archive**

[简体中文](README.md)

## Features

Central session inventory and filtering, batch archive/unarchive, guarded cascade physical deletion, and optional automatic archival and retention rules.

## Installation

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-session-archive-fish@1.0.1
```

Also included in `@fish-under-sea/dsh-fish@1.0.1`. Do not expand duplicate rows through both aggregate and standalone bundles. Restart DSH after installation; use the desktop plugin manager when no CLI is available.

## Configuration and Safety

Physical deletion is irreversible. Running, current or in-flight sessions protect the whole family. Unknown archive times never qualify for auto-deletion. Archive age comes only from $DSH_HOME/dsh-session-archive/archive-ledger.json, not file timestamps.

Node requirement: `^22.19.0 || >=24.0.0`. Host compatibility follows this package manifest; the aggregate does not override Host checks.

## Maintenance and Attribution

1.0.1 is a coordinated release number, not a claim that all latest upstream commits are merged. Historical documentation remains in Git; see [aggregate changelog](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.en.md).

Forked from [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web). Original authorship, LICENSE and NOTICE are preserved; Fish maintains naming and integration adaptations. License: Apache-2.0.
