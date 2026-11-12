# @fish-under-sea/dsh-skill-lens-fish

**2.0.2 · Skill Lens**

Browse and edit local skills with a shared-reference dependency graph.

[简体中文](README.md)

## Features

Lists, inspects, edits, creates, imports and deletes skills; graphs dependencies, supports directory SKILL.md and flat .md skills plus shared references, and follows DSH_HOME.

## Installation

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-skill-lens-fish@2.0.2
```

Also included in `@fish-under-sea/dsh-fish@2.0.2`. Do not expand duplicate rows through both aggregate and standalone bundles. Restart DSH after installation; use the desktop plugin manager when no CLI is available.

## Configuration and Safety

Import, edit and delete modify real skill files; back up before deletion. Do not mount upstream and Fish variants under the same skill-lens row.

Node requirement: `>=24.9`. Host compatibility follows this package manifest; the aggregate does not override Host checks.

## Maintenance and Attribution

2.0.2 is a coordinated release number, not a claim that all latest upstream commits are merged. Historical documentation remains in Git; see [aggregate changelog](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.en.md).

Forked from [x-feichen/dsh-skill-lens](https://github.com/x-feichen/dsh-skill-lens). Upstream declares MIT in package.json but supplies no separate LICENSE or NOTICE. This package adds the standard MIT text and provenance notice while retaining upstream attribution. Fish maintains naming and integration adaptations. License: MIT.
