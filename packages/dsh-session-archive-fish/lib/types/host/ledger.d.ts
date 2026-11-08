/**
 * Host-side persistence for dsh-session-archive: the archive-time ledger and
 * the automatic-policy run state, both as atomic JSON documents under
 * `$DSH_HOME/dsh-session-archive/`. Every write goes through a unique temp
 * file + fsync + rename, so an interrupted write can never produce a
 * half-written document.
 * @module @fish-under-sea/dsh-session-archive-fish/host/ledger
 */
import type { RunStats } from '../core/types.ts';
/**
 * Where one ledger archive time came from.
 *
 * - `manual` / `auto`: this plugin performed the archive, so the time is the
 *   real archive moment.
 * - `observed`: the session was already archived when this plugin first saw it
 *   (archived from the official sidebar, which never reaches this plugin), and
 *   the time records the moment of observation — a conservative lower bound on
 *   the real archive moment, never a file timestamp.
 */
export type LedgerSource = 'manual' | 'auto' | 'observed';
/** One archive-time record. The ledger stays the only archive-time fact source. */
export interface LedgerEntry {
    /** Epoch ms of the archive action (manual, automatic) or of the observation. */
    archivedAt: number;
    source: LedgerSource;
}
export interface LedgerDocument {
    version: 1;
    entries: Record<string, LedgerEntry>;
}
/** Persisted automatic-policy run state; survives restarts. */
export interface AutoStateDocument {
    version: 1;
    lastArchiveRun?: RunStats;
    lastDeleteRun?: RunStats;
    nextCheckAt?: number;
}
export declare function createLedgerDocument(): LedgerDocument;
/** Tolerant deserialize: corrupt or foreign documents start fresh. */
export declare function deserializeLedger(raw: string): LedgerDocument;
export declare function deserializeAutoState(raw: string): AutoStateDocument;
/** Atomic JSON write: unique temp file, fsync, rename. */
export declare function writeJsonAtomic(path: string, value: unknown): Promise<void>;
/** Cap the persisted failure list so state.json stays small. */
export declare function capEntries(entries: RunStats['entries'], cap?: number): RunStats['entries'];
