# @fish-under-sea/dsh-approval-guide

**1.0.1 · Approval Guide**

[简体中文](README.md)

## Features

Adds Chinese action, risk and rationale explanations to approval prompts for files, commands, network access and privilege changes.

## Installation

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-approval-guide@1.0.1
```

Also included in `@fish-under-sea/dsh-fish@1.0.1`. Do not expand duplicate rows through both aggregate and standalone bundles. Restart DSH after installation; use the desktop plugin manager when no CLI is available.

## Configuration and Safety

Explanatory only: never grants approval or changes sandbox policy.

Node requirement: `^22.19.0 || >=24.0.0`. Host compatibility follows this package manifest; the aggregate does not override Host checks.

## Maintenance and Attribution

1.0.1 is a coordinated release number, not a claim that all latest upstream commits are merged. Historical documentation remains in Git; see [aggregate changelog](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.en.md).

Fish-native plugin. License: MIT.
