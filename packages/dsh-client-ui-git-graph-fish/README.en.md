# @fish-under-sea/dsh-client-ui-git-graph-fish

**1.0.2 · Git Graph**

[简体中文](README.md)

## Features

Visual commit history, blank-session branch selection, branch creation and switching, worktree management and conflict guards; the optional git_worktree agent tool is off by default.

## Installation

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-client-ui-git-graph-fish@1.0.2
```

Also included in `@fish-under-sea/dsh-fish@1.0.2`. Do not expand duplicate rows through both aggregate and standalone bundles. Restart DSH after installation; use the desktop plugin manager when no CLI is available.

## Configuration and Safety

Git operations run on the Host. Dirty worktrees, merge conflicts and branch ownership trigger guards; do not bypass them with destructive resets. Managed worktrees live in $DSH_HOME/worktrees/.

Node requirement: `^22.19.0 || >=24.0.0`. Host compatibility follows this package manifest; the aggregate does not override Host checks.

## Maintenance and Attribution

1.0.2 is a coordinated release number, not a claim that all latest upstream commits are merged. Historical documentation remains in Git; see [aggregate changelog](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.en.md).

Forked from [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web). Original authorship, LICENSE and NOTICE are preserved; Fish maintains naming and integration adaptations. License: Apache-2.0.
