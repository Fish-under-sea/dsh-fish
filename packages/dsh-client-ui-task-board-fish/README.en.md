# @fish-under-sea/dsh-client-ui-task-board-fish

**1.0.0 · Task Board**

[简体中文](README.md)

## Features

Host-authoritative task ledger, Kanban and subtasks; real DSH session execution, recurring cron and one-shot schedules with run budgets, opt-in goals, acceptance, team execution and idle-sleep protection.

## Installation

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-client-ui-task-board-fish@1.0.0
```

Also included in `@fish-under-sea/dsh-fish@1.0.0`. Do not expand duplicate rows through both aggregate and standalone bundles. Restart DSH after installation; use the desktop plugin manager when no CLI is available.

## Configuration and Safety

The ledger is $DSH_HOME/task-board/ledger-v2.json. Scheduled runs consume real API quota. Above-default permissions require human confirmation. Goals need both global and card opt-in; teamRun requires AgentTeams. The Host owns task lifecycle decisions.

Node requirement: `see package.json`. Host compatibility follows this package manifest; the aggregate does not override Host checks.

## Maintenance and Attribution

1.0.0 is a coordinated release number, not a claim that all latest upstream commits are merged. Historical documentation remains in Git; see [aggregate changelog](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.en.md).

Forked from [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web). Original authorship, LICENSE and NOTICE are preserved; Fish maintains naming and integration adaptations. License: Apache-2.0.
