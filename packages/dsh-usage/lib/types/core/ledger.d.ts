/**
 * The usage ledger: a pure fold from session usage facts into a per-day,
 * per-provider, per-model totals document, plus its JSON serialization.
 * Host-side state lives only in the document; the service owns persistence.
 * @module @fish-under-sea/dsh-usage/core/ledger
 */
import { type UsageLedgerDocument, type UsageProviderSummary, type UsageTokenTotals } from './types.ts';
/** Local-date key (`YYYY-MM-DD`) for an epoch ms timestamp. */
export declare function localDateKey(ms: number): string;
/**
 * Whether `key` is a real local-date key (`YYYY-MM-DD`). The shape check is
 * round-tripped: an impossible date (9999-99-99) parses to NaN and a rollover
 * (2026-02-30) lands on another day, so both would otherwise fold into a bogus,
 * never-pruned bucket. Shared by the persisted-document reader and the day
 * route's query gate.
 */
export declare function isLedgerDateKey(key: string): boolean;
/** An empty ledger document. */
export declare function createLedgerDocument(): UsageLedgerDocument;
/**
 * Fold one usage report into the ledger in place. `provider` is the route key
 * and `model` the provider-owned model id the step ran under. Reports keyed
 * by prototype-plumbing names are dropped.
 */
export declare function foldUsage(doc: UsageLedgerDocument, atMs: number, provider: string, model: string, usage: Readonly<UsageTokenTotals>): void;
/** Total tokens of a bucket (billed input + output; reasoning is inside output). */
export declare function totalTokens(totals: Readonly<UsageTokenTotals>): number;
/** How many model rows one summarized provider keeps. */
export declare const SUMMARY_MODEL_CAP = 12;
/**
 * Aggregate whole per-day maps (each `provider -> model -> totals`) into the
 * per-provider/per-model summary the overview serves for one day or a range:
 * disjoint bucket sums per provider, per-model rows heaviest first, and the
 * grand total. Pure: reads its inputs, allocates fresh buckets.
 */
export declare function summarizeDays(days: ReadonlyArray<Record<string, Record<string, UsageTokenTotals>>>): {
    totals: UsageTokenTotals;
    providers: UsageProviderSummary[];
    /**
     * Every DeepSeek model's totals across **all** routes in this window, summed
     * from the uncapped per-model maps. Computed here rather than in the browser
     * because the wire caps each provider's model list at `SUMMARY_MODEL_CAP`, so
     * a client-side sum would silently undercount an aggregator's DeepSeek rows
     * once it serves more models than the cap.
     */
    deepseek: UsageTokenTotals;
};
/** All local-date keys in the ledger, ascending. */
export declare function ledgerDayKeys(doc: Readonly<UsageLedgerDocument>): string[];
/**
 * Drop every day older than `retainDays` local days before `todayKey`, in
 * place. Returns the number of pruned days.
 */
export declare function pruneLedger(doc: UsageLedgerDocument, todayKey: string, retainDays: number): number;
/**
 * Parse a ledger document from untrusted JSON: unknown shapes resolve to an
 * empty document, malformed entries are dropped, numbers are coerced to
 * finite values. Never throws.
 */
export declare function deserializeLedger(value: unknown): UsageLedgerDocument;
