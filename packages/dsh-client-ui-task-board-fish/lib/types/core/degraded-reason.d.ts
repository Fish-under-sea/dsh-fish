/**
 * The family health ledger's degraded-record contract (issues #1528, #1730).
 *
 * A family plugin row that fails during apply is recorded by the dsh-web-all
 * shell as a degraded record; the shell serves the ledger through its
 * loopback-only `GET /api/dsh-web-all/degraded` route because the failed
 * plugin could not register any route of its own — the task board whose ledger
 * lock is held by another DSH process is exactly that case, and without this
 * the panel could only report "the Host API is not mounted".
 *
 * Both halves define this shape: the shell WRITES it (packages/dsh-web-all,
 * src/degraded.ts — the two packages have no import edge, one is bundled into
 * the other's profile) and a plugin's browser half PARSES it. The edits move
 * together.
 */
/** Where a degraded row failed: module import, plugin shape, or fiber start. */
export type DegradedStage = 'import' | 'shape' | 'start';
/** One degraded family row as the shell's health route serves it. */
export interface DegradedRow {
    /** Real plugin package name from the shell row config. */
    plugin: string;
    /** Where the failure happened. */
    stage: DegradedStage;
    /** The shell's one-line reason, for display. */
    reason: string;
}
/**
 * The one degraded record naming `plugin`, or undefined when that row is not
 * degraded (or the payload does not come from the shell's own shape). A
 * plugin may appear once: the shell keys the ledger by package name and
 * refreshes the record on every new failure.
 * @param body - parsed JSON body of the health route.
 * @param plugin - the real plugin package name to look for.
 * @returns the degraded row, or undefined when the ledger does not name it.
 */
export declare function degradedRowOf(body: unknown, plugin: string): DegradedRow | undefined;
/**
 * Extract the pid of the LIVE process a ledger-lock failure blames, when the
 * reason identifies one. The task board's lock refusal is the one degraded
 * reason that carries an owner the user can act on, so the panel renders the
 * pid in its own sentence and adds the guidance that actually applies.
 * @param reason - the shell's one-line failure reason.
 * @returns the confirmed owner pid, or undefined when the reason names none or
 *   warns that the PID may have been reused (its own text owns the recovery).
 */
export declare function ledgerOwnerPid(reason: string): number | undefined;
