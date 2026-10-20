# @fish-under-sea/dsh-skill-lens-fish

**1.0.0 · Skill Lens**

[简体中文](README.md)

## Features

Lists, inspects, edits, creates, imports and deletes skills; graphs dependencies, supports directory SKILL.md and flat .md skills plus shared references, and follows DSH_HOME.

## Installation

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-skill-lens-fish@1.0.0
```

Also included in `@fish-under-sea/dsh-fish@1.0.0`. Do not expand duplicate rows through both aggregate and standalone bundles. Restart DSH after installation; use the desktop plugin manager when no CLI is available.

## Configuration and Safety

Import, edit and delete modify real skill files; back up before deletion. Do not mount upstream and Fish variants under the same skill-lens row.

Node requirement: `>=20`. Host compatibility follows this package manifest; the aggregate does not override Host checks.

## Maintenance and Attribution

1.0.0 is a coordinated release number, not a claim that all latest upstream commits are merged. Historical documentation remains in Git; see [aggregate changelog](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.en.md).

Forked from [x-feichen/dsh-skill-lens](https://github.com/x-feichen/dsh-skill-lens). Upstream declares MIT in package.json but supplies no separate LICENSE or NOTICE. This package adds the standard MIT text and provenance notice while retaining upstream attribution. Fish maintains naming and integration adaptations. License: MIT.
