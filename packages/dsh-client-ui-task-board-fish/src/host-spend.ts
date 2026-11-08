/**
 * Today's measured spend, read from the usage ledger this deployment keeps at
 * `$DSH_HOME/dsh-usage/usage-ledger.json`.
 *
 * The measure is the family usage ledger rather than a counter this plugin
 * accumulates from `session/event`, for two reasons. The ledger is durable, so
 * a cap cannot be reset by restarting the Host (the Loader remounts a row on
 * any config change, and a spend counter that lived only in memory would forget
 * the day). And a second fold of the same events inside the board would have to
 * persist its own totals to be worth anything, which means a second writer of
 * spend state in one process.
 *
 * What that costs: the file belongs to the dsh-usage plugin, so a deployment
 * that does not mount it keeps no ledger and the cap cannot measure anything.
 * That case is reported once per process and the gate then refuses nothing —
 * wedging the board because a sibling plugin is absent would be worse than a
 * cap that says it cannot see. The 3 s flush debounce of that plugin is the
 * other cost: the reading trails the busiest moments by at most one debounce.
 * @module @fish-under-sea/dsh-client-ui-task-board-fish/host-spend
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dshHome } from './dsh-home.ts'

/**
 * The token fields one ledger bucket totals. Billed input is uncached input
 * plus both cache buckets; output already includes reasoning, so reasoning is
 * deliberately not added again — the sum is the one the usage panel shows.
 */
const TOKEN_FIELDS = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'] as const

/** Reported at most once per process: an unmeasurable cap is a startup fact, not a per-run one. */
let reportedUnmeasurable = false

/**
 * Local-date key (`YYYY-MM-DD`) of an instant, the bucketing the usage ledger
 * itself uses: the cap and the usage panel therefore roll over at the same
 * local midnight.
 * @param ms - clock instant (ms epoch).
 * @returns the day key.
 */
export function spendDateKey(ms: number): string {
  const date = new Date(ms)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Total tokens one ledger day recorded, across every provider and model of that
 * day. Anything that is not a finite token count contributes 0, so a ledger
 * written by another version degrades to a smaller reading instead of NaN.
 * @param day - one day bucket as the ledger stores it, when it is one.
 * @returns the day's token total.
 */
export function ledgerDayTokens(day: unknown): number {
  if (typeof day !== 'object' || day === null) return 0
  let total = 0
  for (const models of Object.values(day as Record<string, unknown>)) {
    if (typeof models !== 'object' || models === null) continue
    for (const bucket of Object.values(models as Record<string, unknown>)) {
      if (typeof bucket !== 'object' || bucket === null) continue
      for (const field of TOKEN_FIELDS) {
        const value = (bucket as Record<string, unknown>)[field]
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) total += value
      }
    }
  }
  return total
}

/**
 * Path of the usage ledger for this DSH home.
 * @returns the absolute ledger path.
 */
export function spendLedgerPath(): string {
  return join(dshHome(), 'dsh-usage', 'usage-ledger.json')
}

/**
 * Tokens already spent today, or undefined when no measurement is available.
 *
 * Undefined is "cannot see", not "spent nothing": the caller fails open and
 * reports it, because a spend cap that cannot read its own source must never
 * decide that no work may run.
 * @param now - clock instant (ms epoch).
 * @param path - ledger path (test seam).
 * @returns today's token total, or undefined when the ledger is unreadable.
 */
export function usedTokensToday(now: number = Date.now(), path: string = spendLedgerPath()): number | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    const days = typeof parsed === 'object' && parsed !== null ? (parsed as { days?: unknown }).days : undefined
    if (typeof days !== 'object' || days === null) return undefined
    return ledgerDayTokens((days as Record<string, unknown>)[spendDateKey(now)])
  } catch (error) {
    if (!reportedUnmeasurable) {
      reportedUnmeasurable = true
      const detail = error instanceof Error ? error.message : String(error)
      console.warn(`[dsh-task-board] spend cap cannot be measured from ${path}: ${detail}; runs are not gated until that ledger is readable`)
    }
    return undefined
  }
}
