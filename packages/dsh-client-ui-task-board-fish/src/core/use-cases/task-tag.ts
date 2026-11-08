/**
 * Label-management use cases (issue: labels could not be cleaned up).
 *
 * A label lives on every task that carries it, so renaming or removing one is a
 * ledger-wide edit, not a task edit: the board's label row is the union of the
 * labels in use, and without these two transitions a label created by an
 * afternoon experiment stayed on the board forever.
 *
 * Both transitions are pure ledger rewrites (no persistence, no notify — the
 * controller and the Host ledger orchestrate those), and both are idempotent:
 * a label that no task carries changes nothing and reports no error for the
 * delete path (the desired end state already holds), while a rename from an
 * unknown label is refused so a stale tab cannot silently do nothing.
 *
 * Renaming onto a name that is already in use MERGES the two: a task carrying
 * both keeps the row it already had (with its execution hint) and loses the
 * duplicate, which is the only reading that cannot lose a hint the user typed.
 *
 * Clearing up is the third ledger-wide transition, and it is a SELECTION rather
 * than a fourth rewrite: {@link cleanupCandidates} names the labels that are
 * both rarely used and attached only to finished tasks, and each of them then
 * leaves through {@link applyDeleteTag} like any other delete. One delete path,
 * one meaning — a label never disappears by a second rule written beside the
 * first.
 */

import { TAG_NAME_MAX_LENGTH, collectKnownTags, normalizeTags, type TaskRecord, type TaskTag } from '../tasks.ts'

/** Outcome of one ledger-wide label edit. */
export interface TagEditResult {
  /** The ledger after the edit, or the input unchanged when nothing applied. */
  tasks: readonly TaskRecord[]
  /** Whether any task actually changed (drives whether the caller persists). */
  changed: boolean
  /** Refusal reason; the ledger is unchanged when set. */
  error?: string
}

/** Trim a label name the way creation does. */
function normalizeName(value: string): string {
  return value.trim()
}

/** Whether any task in the ledger carries this label. */
function carries(tasks: readonly TaskRecord[], name: string): boolean {
  return collectKnownTags(tasks).some(tag => tag.name === name)
}

/**
 * Rename one label everywhere, merging into an existing label of the target
 * name. Every touched task gets a fresh updatedAt; untouched tasks keep theirs.
 * @param tasks - current ledger.
 * @param from - the label to rename.
 * @param to - the new name (an existing name merges the two labels).
 * @param now - clock instant (ms epoch).
 * @returns the rewritten ledger, or a refusal.
 */
export function applyRenameTag(
  tasks: readonly TaskRecord[],
  from: string,
  to: string,
  now: number,
): TagEditResult {
  const source = normalizeName(from)
  const target = normalizeName(to)
  if (source === '') return { tasks, changed: false, error: 'a label name is required' }
  if (target === '') return { tasks, changed: false, error: 'a label name is required' }
  if (target.length > TAG_NAME_MAX_LENGTH) return { tasks, changed: false, error: 'label name is too long' }
  if (source === target) return { tasks, changed: false }
  if (!carries(tasks, source)) return { tasks, changed: false, error: 'label not found' }
  let changed = false
  const next = tasks.map(task => {
    const tags = task.tags
    if (tags === undefined || !tags.some(tag => tag.name === source)) return task
    changed = true
    // A task that already carried BOTH names keeps the target's own row — the
    // target is the label that survives, so its execution hint stays the one
    // that applies. A task carrying only the source keeps that row's hint under
    // the new name.
    const hasTarget = tags.some(tag => tag.name === target)
    const merged: TaskTag[] = []
    for (const tag of tags) {
      if (hasTarget && tag.name === source) continue
      const name = tag.name === source ? target : tag.name
      if (merged.some(entry => entry.name === name)) continue
      merged.push(name === tag.name ? tag : { ...tag, name })
    }
    return { ...task, tags: normalizeTags(merged), updatedAt: now }
  })
  return { tasks: changed ? next : tasks, changed }
}

/**
 * Remove one label from every task that carries it. Archived cards are included:
 * the board's label row draws from the whole ledger, so a label left on an
 * archived card would come straight back into the filter.
 * @param tasks - current ledger.
 * @param name - the label to remove.
 * @param now - clock instant (ms epoch).
 * @returns the rewritten ledger.
 */
export function applyDeleteTag(
  tasks: readonly TaskRecord[],
  name: string,
  now: number,
): TagEditResult {
  const target = normalizeName(name)
  if (target === '') return { tasks, changed: false, error: 'a label name is required' }
  let changed = false
  const next = tasks.map(task => {
    const tags = task.tags
    if (tags === undefined || !tags.some(tag => tag.name === target)) return task
    changed = true
    return { ...task, tags: normalizeTags(tags.filter(tag => tag.name !== target)), updatedAt: now }
  })
  return { tasks: changed ? next : tasks, changed }
}

/** One label the manager offers to clear, with the tasks it would be taken from. */
export interface TagCleanupCandidate {
  /** The label name. */
  name: string
  /** Tasks carrying the label right now, board and archive alike. */
  count: number
}

/**
 * Labels that are both rarely used and finished with: fewer tasks carry them
 * than `threshold`, and every one of those tasks is done or failed.
 *
 * The judgement reads the whole ledger it is given — the board's label row and
 * the archive draw from the same set, so an archived card counts towards a
 * label's usage and can keep it alive on its own. Archiving alone decides
 * nothing: an archived card in a finished column lets its label through, while
 * an archived card still in backlog, todo or running holds it back, because a
 * label that live work still points at is not junk.
 *
 * A non-finite threshold selects nothing (a missing number has no reading that
 * is safe to act on); a threshold at or below one selects nothing either, since
 * a label by definition sits on at least one task and none can carry fewer.
 *
 * Order follows {@link collectKnownTags}, which is the order the manager lists
 * labels in, and the count is the same number the manager shows per label.
 * @param tasks - the whole ledger (board and archive).
 * @param threshold - exclusive upper bound on the usage count.
 * @returns the labels a cleanup may remove, in listing order.
 */
export function cleanupCandidates(tasks: readonly TaskRecord[], threshold: number): TagCleanupCandidate[] {
  if (!Number.isFinite(threshold)) return []
  const counts = new Map<string, number>()
  const unfinished = new Set<string>()
  for (const task of tasks) {
    const settled = task.status === 'done' || task.status === 'failed'
    for (const tag of task.tags ?? []) {
      counts.set(tag.name, (counts.get(tag.name) ?? 0) + 1)
      if (!settled) unfinished.add(tag.name)
    }
  }
  const candidates: TagCleanupCandidate[] = []
  for (const tag of collectKnownTags(tasks)) {
    const count = counts.get(tag.name) ?? 0
    if (count >= threshold || unfinished.has(tag.name)) continue
    candidates.push({ name: tag.name, count })
  }
  return candidates
}
