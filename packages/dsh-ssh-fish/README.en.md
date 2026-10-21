# @fish-under-sea/dsh-ssh-fish

**1.0.2 · SSH Operations**

[简体中文](README.md)

## Features

Host inventory, pooled connections, persistent Web PTY terminals, SFTP, loopback tunnels and cluster execution; six agent tools share the GUI host configuration.

## Installation

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-ssh-fish@1.0.2
```

Also included in `@fish-under-sea/dsh-fish@1.0.2`. Do not expand duplicate rows through both aggregate and standalone bundles. Restart DSH after installation; use the desktop plugin manager when no CLI is available.

## Configuration and Safety

Protect $DSH_HOME/dsh-ssh.json as sensitive: passwords and passphrases may be plaintext. Output is not redacted; reconnects may replay non-idempotent commands. Transfers use Host filesystem privileges; proxyCommand is trusted shell input. Agents may use only user-configured hosts.

Node requirement: `^22.19.0 || >=24.0.0`. Host compatibility follows this package manifest; the aggregate does not override Host checks.

## Maintenance and Attribution

1.0.2 is a coordinated release number, not a claim that all latest upstream commits are merged. Historical documentation remains in Git; see [aggregate changelog](https://github.com/Fish-under-sea/dsh-fish/blob/main/CHANGELOG.en.md).

Forked from [zhu1090093659/dsh-web](https://github.com/zhu1090093659/dsh-web). Original authorship, LICENSE and NOTICE are preserved; Fish maintains naming and integration adaptations. License: Apache-2.0.
