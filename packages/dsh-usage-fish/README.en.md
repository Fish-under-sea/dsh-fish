# @fish-under-sea/dsh-usage-fish

**1.0.1 · Usage Monitor**

[简体中文](README.md)

## Features

Tracks token usage by provider and model, balances, subscription quotas, peak/off-peak cost estimates, Token Bank and a sidebar summary.

## Installation

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-usage-fish@1.0.1
```

Also included in `@fish-under-sea/dsh-fish@1.0.1`. Do not expand duplicate rows through both aggregate and standalone bundles. Restart DSH after installation; use the desktop plugin manager when no CLI is available.

## Configuration and Safety

Data lives in $DSH_HOME/dsh-usage/. Estimates and balances depend on provider responses and pricing configuration and are not a billing authority.

Node requirement: `^22.19.0 || >=24.0.0`. Host compatibility follows this package manifest; the aggregate does not override Host checks.

## Maintenance and Attribution

1.0.1 is a coordinated release number, not a claim that all latest upstream commits are merged. Historical documentation remains in Git; see [aggregate changelog](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.en.md).

Forked from [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web). Original authorship, LICENSE and NOTICE are preserved; Fish maintains naming and integration adaptations. License: Apache-2.0.
