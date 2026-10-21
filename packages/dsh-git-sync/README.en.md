# @fish-under-sea/dsh-git-sync

**1.0.1 · Git Sync**

[简体中文](README.md)

## Features

Previews, commits, pulls and restores selected DSH configuration through a private Git repository. Credential export is separate from normal sync: it copies only `$DSH_HOME/.credentials.yaml` to a user-selected directory, or to the Desktop by default, inside a `DSH凭据导出` folder. The export folder contains only the credential file; no README is generated.

## Installation

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-git-sync@1.0.1
```

Also included in `@fish-under-sea/dsh-fish@1.0.1`. Do not expand duplicate rows through both aggregate and standalone bundles. Restart DSH after installation; use the desktop plugin manager when no CLI is available.

## Configuration and Safety

Configuration lives under `$DSH_HOME/dsh-git-sync/`. Sync is not a full backup. Do not commit tokens, keys, session logs or SSH passwords. Export copies only `$DSH_HOME/.credentials.yaml` locally; when no directory is selected, it uses the Desktop (falling back to the home directory if unavailable). It makes no network requests, does not write to Git, generates no README, and never logs credential contents. Do not upload the export to cloud storage or chat. Back up before replacing existing credentials.

Node requirement: `>=20`. Host compatibility follows this package manifest; the aggregate does not override Host checks.

## Maintenance and Attribution

1.0.1 is a coordinated release number, not a claim that all latest upstream commits are merged. Historical documentation remains in Git; see [aggregate changelog](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.en.md).

Fish-native plugin. License: MIT.
