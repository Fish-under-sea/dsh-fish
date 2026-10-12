/**
 * Host-side persistence for dsh-session-archive: the archive-time ledger and
 * the automatic-policy run state, both as atomic JSON documents under
 * `$DSH_HOME/dsh-session-archive/`. Every write goes through a unique temp
 * file + fsync + rename, so an interrupted write can never produce a
 * half-written document.
 * @module @fish-under-sea/dsh-session-archive/host/ledger
 */
import type { RunStats } from '../core/types.ts';
/** One archive-time record. The ledger only knows archives this plugin made. */
export interface LedgerEntry {
    /** Epoch ms of the archive action (manual or automatic). */
    archivedAt: number;
    source: 'manual' | 'auto';
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
