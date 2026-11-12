# @fish-under-sea/dsh-approval-guide

**2.0.2 · Approval Guide**

Adds Chinese action, risk and rationale notes to approval prompts.

[简体中文](README.md)

## Features

Adds Chinese action, risk and rationale explanations to approval prompts for files, commands, network access and privilege changes.

### Empty-input send

When the composer is empty, clicking Send fills in and sends “继续任务，并梳理进度” (continue the task and summarize progress). Non-empty input, the Stop button, attachments, pending uploads and IME composition are untouched; re-entry is guarded and the button wait is bounded to about 816 ms before a single warning.

## Installation

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-approval-guide@2.0.2
```

Also included in `@fish-under-sea/dsh-fish@2.0.2`. Do not expand duplicate rows through both aggregate and standalone bundles. Restart DSH after installation; use the desktop plugin manager when no CLI is available.

## Configuration and Safety

Explanatory only: never grants approval or changes sandbox policy.

Node requirement: `>=24.9`. Host compatibility follows this package manifest; the aggregate does not override Host checks.

## Maintenance and Attribution

2.0.2 is a coordinated release number, not a claim that all latest upstream commits are merged. Historical documentation remains in Git; see [aggregate changelog](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.en.md).

Fish-native plugin. License: MIT.
