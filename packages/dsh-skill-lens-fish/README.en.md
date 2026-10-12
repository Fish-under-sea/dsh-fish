# @fish-under-sea/dsh-skill-lens-fish

**简体中文** | [English](README.en.md)

> **This plugin is a fork of [x-feichen/dsh-skill-lens](https://github.com/x-feichen/dsh-skill-lens) (MIT).**
> The upstream project is a general-purpose implementation; this fork adapts it to how DSH actually lays skills out on disk (see [Differences from upstream](#differences-from-upstream)).
> The original author's copyright and the MIT license are fully retained.

**Skill Lens (Fish edition)** — browse, inspect and manage every Agent Skill on your machine from a **session tab** in the DSH Web GUI: skill catalog, overview, file browsing/editing, a **dependency graph**, and create/import/delete.

## What it solves

DSH skills come in two real shapes, and "which companion files does this skill use" is usually invisible:

- **Directory form**: `<name>/SKILL.md` (the convention in the Claude Code ecosystem)
- **Flat form**: `<name>.md` (how DSH user-level skills are usually stored under `$DSH_HOME/skills/`)

Skill bodies also routinely reference **shared material outside the skill directory** — via `../skill-refs/<file>` or a bare filename (methodology details, scripts, templates). Those references are scattered through the prose; without running something you cannot tell which file still exists and which has gone missing.

Skill Lens makes both visible: it enumerates every skill, then draws each skill's references as a dependency graph.

## Features

- **Skill catalog**: recursively discovers both `<name>/SKILL.md` and `<name>.md` (skipping `node_modules`, build output and cache directories), with search filtering and a per-skill badge showing whether it came from the project or the global scan root
- **Overview**: frontmatter metadata plus the rendered Markdown body
- **File browser**: real collapsible tree with **edit / preview switching**; changes can be saved or discarded from the bottom-right corner
- **Dependency graph (0.1.1)**: entry point → category → file. Nodes display filenames with wrapping and retain full paths in hover tooltips. In-directory files still open in the file browser. Flat skill entries and referenced resources open a read-only Markdown dialog with loading/error states, a close button and Escape support; no save action is offered. Categories, environment variables and commands are not opened as files.
- **Create / import**: build a skill from scratch, or import an `.md` / `.zip` bundle into either the project `.dsh/skills` or the global skills root
- **Delete**: directory-form skills delete the whole directory; flat-form skills delete only that one file (sibling skills in the same directory are untouched)

## Differences from upstream

| Upstream behaviour | This fork |
|---|---|
| Global skills root hard-coded to `~/.dsh` | **Follows `$DSH_HOME`**, so channels with a custom DSH_HOME (such as `~/.dsh-beta`) are scanned too; falls back through `$DSH_HOME/skills` → `$DSH_HOME` → `~/.dsh/skills` → `~/.dsh` |
| Only `<name>/SKILL.md` is recognised | **Flat `<name>.md` is recognised as well**, while `README.md` / `index.md` and a skill bundle's internal `references/*.md` are excluded (they are not misreported as separate skills) |
| A skill is identified by its directory | A flat skill is identified by **the skill file itself**. Otherwise several flat skills in one directory would share an identifier and selection / deletion / metadata would all collide |
| The graph only resolves files inside the skill directory; outside references are dropped | Adds a **"referenced resource" category**: the host-side `resolve-refs` call resolves references to real paths before they enter the graph, labelled relative to `$DSH_HOME`. **Unresolved references are still hidden**, keeping upstream's "not on disk, not drawn" rule |
| `files` / `read` / `delete` / `batch-delete` / `skill-meta` only support directory-form skills | Flat-form skills are supported too (delete removes only the file; ZIP export presents it by skill filename) |
| The `lib/client.js` registration id is hard-coded in the build script | The build script **reads `name` from `package.json`**, so a rename cannot be missed |

The original categories (document / script / asset / unreferenced / external) and directory-form behaviour are **unchanged**, and are covered by regression tests.

## Install

This plugin is part of the [`@fish-under-sea/dsh-fish`](https://github.com/Fish-under-sea/dsh-fish) aggregate bundle — installing that brings it along:

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-fish
```

It can also be installed on its own:

```sh
dsh plugin --profile <profile> add @fish-under-sea/dsh-skill-lens-fish
```

**Restart DSH** afterwards; a **Skill Lens** tab appears in any session.

### Verify

```sh
dsh --profile <profile> --dump-config | grep skill-lens
# A "- id: skill-lens / name: @fish-under-sea/dsh-skill-lens-fish" row means it is mounted
```

### Uninstall

```sh
dsh plugin --profile <profile> remove @fish-under-sea/dsh-skill-lens-fish
```

## Which directories are scanned

| Scope | Path | Notes |
|---|---|---|
| Project | `<session workspace>/.dsh/skills` | Follows the current session's workspace; skipped when absent |
| Global | `$DSH_HOME/skills` | Falls back through `$DSH_HOME` → `~/.dsh/skills` → `~/.dsh` |

Both scopes accept the `<name>/SKILL.md` and `<name>.md` shapes. Symbolic links are never followed (same as upstream).

## Development

```sh
pnpm install
pnpm typecheck                    # tsc --noEmit
pnpm build                        # esbuild → lib/index.js + lib/client.js
pnpm test                         # host and browser half tests
```

`lib/` is **build output that is committed to the repository** (the usual convention for this kind of fork), so a fresh clone can `npm pack` or be installed with `link:` right away. **After editing `src/` you must run `pnpm build` again** and commit the `lib/` changes, otherwise installers keep getting the stale artifact.

> The client registration id is read from `package.json` at build time; `test/client.test.mjs` asserts the two agree.

## License

**MIT**. Upstream [x-feichen/dsh-skill-lens](https://github.com/x-feichen/dsh-skill-lens) is likewise distributed under MIT, **with copyright belonging to the original author**. This is a modified version built on top of it; the provenance and the scope of changes are described at the top of this file and in [Differences from upstream](#differences-from-upstream).

The upstream repository's README includes interface screenshots; this README does not embed any.
