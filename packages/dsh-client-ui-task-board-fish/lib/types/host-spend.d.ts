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
/**
 * Local-date key (`YYYY-MM-DD`) of an instant, the bucketing the usage ledger
 * itself uses: the cap and the usage panel therefore roll over at the same
 * local midnight.
 * @param ms - clock instant (ms epoch).
 * @returns the day key.
 */
export declare function spendDateKey(ms: number): string;
/**
 * Total tokens one ledger day recorded, across every provider and model of that
 * day. Anything that is not a finite token count contributes 0, so a ledger
 * written by another version degrades to a smaller reading instead of NaN.
 * @param day - one day bucket as the ledger stores it, when it is one.
 * @returns the day's token total.
 */
export declare function ledgerDayTokens(day: unknown): number;
/**
 * Path of the usage ledger for this DSH home.
 * @returns the absolute ledger path.
 */
export declare function spendLedgerPath(): string;
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
export declare function usedTokensToday(now?: number, path?: string): number | undefined;
