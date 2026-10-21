# @fish-under-sea/dsh-visual-companion

**1.0.1 · Visual Companion**

[简体中文](README.md)

## Features

Binds a visual-companion directory and delivers submitted selections and notes as a user message that wakes the target session; exposes arm, disarm, status and wake.

## Installation

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-visual-companion@1.0.1
```

Also included in `@fish-under-sea/dsh-fish@1.0.1`. Do not expand duplicate rows through both aggregate and standalone bundles. Restart DSH after installation; use the desktop plugin manager when no CLI is available.

## Configuration and Safety

The bound directory contains state/pending.json. Selection alone does not send a message; submission wakes the session. Keep watchDir and session ids machine-local.

Node requirement: `^22.19.0 || >=24.0.0`. Host compatibility follows this package manifest; the aggregate does not override Host checks.

## Maintenance and Attribution

1.0.1 is a coordinated release number, not a claim that all latest upstream commits are merged. Historical documentation remains in Git; see [aggregate changelog](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.en.md).

Fish-native plugin. License: MIT.
