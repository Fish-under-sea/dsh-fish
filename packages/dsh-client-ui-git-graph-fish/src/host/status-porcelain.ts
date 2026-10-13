/**
 * The status plumbing's command shapes and the porcelain-v2 parser (GG-1).
 *
 * Host-local on purpose: this path is host-only (the browser half never spawns
 * git), and keeping the new argv/parser pair here leaves the shared `core/`
 * modules (the single home for the other argv builders and parsers) untouched.
 *
 * Command shape (one `git status` = three spawns):
 *   1. `git rev-parse --show-toplevel --short HEAD` — repository root + short head.
 *   2. `git rev-parse --git-path <marker>...`       — operation markers (unchanged).
 *   3. `git status --porcelain=v2 --branch`         — counts + branch header.
 *
 * Why the short head cannot come from the v2 header: `# branch.oid` carries the
 * FULL object name, and `git status --porcelain=v2 --branch --abbrev=7` is
 * rejected (`error: unknown option 'abbrev=7'`, exit 129), while both the
 * branch chip and the SSE change key (`routes.ts` computes
 * `root|branch|head`) consume the abbreviated id that `rev-parse --short HEAD`
 * prints — whose length is git's own adaptive abbreviation. `--abbrev-ref` and
 * `--short` also cannot share one rev-parse invocation: with
 * `--abbrev-ref HEAD --short HEAD` the branch is printed twice (the mode
 * persists), and with the two swapped the command fails with `Needed a single
 * revision`. Both forms were measured against real repositories; the captured
 * outputs are the fixtures under `tests/fixtures/status-porcelain/`.
 */

/** `git rev-parse --show-toplevel --short HEAD` — root and short head in one spawn. */
export const rootAndHeadArgv = (): string[] => ['rev-parse', '--show-toplevel', '--short', 'HEAD']

/** `git status --porcelain=v2 --branch` — v2 entry records plus the branch header lines. */
export const statusV2BranchArgv = (): string[] => ['status', '--porcelain=v2', '--branch']

/** Counts shared with the porcelain-v1 parser's verdict shape. */
export interface StatusCounts {
  dirtyFiles: number
  untrackedFiles: number
  conflicts: number
}

/** The parsed v2 verdict: the branch the header reports plus the three counts. */
export interface StatusV2 {
  branch: string
  counts: StatusCounts
}

/**
 * Parse `git status --porcelain=v2 --branch`.
 *
 * Count equivalence with `parsePorcelain` (porcelain=v1) is the contract, and
 * it is proven against real captured outputs in
 * `tests/fixtures/status-porcelain/` (rename, paths with spaces, untracked
 * directories, non-ASCII paths, ignored files, UU/AA conflicts, detached head,
 * unborn head, bulk changes all agree):
 * - ordinary change `1`, rename/copy `2` -> dirty (v1's fall-through);
 * - untracked `?` -> untracked (v1's `??`);
 * - unmerged `u` -> conflict (v1's seven unmerged XY codes);
 * - ignored `!` -> not counted (v1 does not emit them without `--ignored`);
 * - `#` header lines are skipped (v1 has none).
 *
 * Branch equivalence with `rev-parse --abbrev-ref HEAD`: that command prints
 * `HEAD` for a detached head and also for an unborn branch (exit 128), so the
 * service maps both to `''`. v2 reports `(detached)`/`(unknown)` and, for an
 * unborn branch, `# branch.head <name>` with `# branch.oid (initial)`; the
 * sentinels are mapped back to `''` so the field keeps its previous value.
 * @param stdout - the command's stdout.
 * @returns the branch (already sentinel-mapped) and the three counts.
 */
export function parseStatusV2(stdout: string): StatusV2 {
  let dirtyFiles = 0
  let untrackedFiles = 0
  let conflicts = 0
  let head: string | null = null
  let oid: string | null = null
  for (const line of stdout.split('\n')) {
    if (line === '') continue
    if (line.startsWith('#')) {
      const header = /^# branch\.(oid|head) (.*)$/.exec(line)
      if (header !== null) {
        if (header[1] === 'oid') oid = header[2]!.trim()
        else head = header[2]!.trim()
      }
      continue
    }
    const type = line[0]
    if (type === '1' || type === '2') dirtyFiles += 1
    else if (type === '?') untrackedFiles += 1
    else if (type === 'u') conflicts += 1
    else if (type === '!') continue
    else dirtyFiles += 1
  }
  const counts = { dirtyFiles, untrackedFiles, conflicts }
  // v2's sentinels: `(detached)` / `(unknown)` for the head, `(initial)` for the
  // oid of an unborn branch. Both map to '' so the field keeps the value the
  // previous `rev-parse --abbrev-ref HEAD` source produced.
  if (head === null || head.startsWith('(') || oid === '(initial)') return { branch: '', counts }
  return { branch: head, counts }
}
