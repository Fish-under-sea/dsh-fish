/**
 * The dsh-usage host service: folds live session usage into the persistent
 * ledger, probes each configured provider's balance/coding-plan endpoint on
 * a poll cycle, and serves the current provider's strip-ready view inside
 * the overview document. Secrets stay in the host process; the browser only
 * ever sees the overview document.
 * @module @fish-under-sea/dsh-usage/host/usage-service
 */
import type { Context } from '@deepseek-ai/cordis';
import type { UsageDayView, UsageOverviewView } from '../core/types.ts';
/**
 * Persisted accrual state for the official DeepSeek family's real spend:
 * consecutive observations of the official CNY balance, decreases counted
 * as spent (a rise is a top-up and never accrues). `since` is the first
 * observation; the ledger keeps no such fact, so this watch is the only
 * source of the voucher's observed-spend figure.
 */
export interface SpendWatch {
    /** Total observed decrease since `since`, in CNY. */
    accruedCny: number;
    /** Epoch ms of the first balance observation. */
    since: number;
    /** The balance the previous observation ended on, when one exists. */
    lastBalanceCny?: number;
}
/** Poll-loop options; re-applied live on settings change. */
export interface UsageServiceOptions {
    pollIntervalSec: number;
    retainDays: number;
}
export declare class UsageService {
    private readonly ctx;
    private options;
    private readonly persistDir;
    private readonly ledgerPath;
    private readonly snapshotsPath;
    private ledger;
    private readonly snapshots;
    /** The official DeepSeek family's real-spend watch (see SpendWatch). */
    private spendWatch;
    /** Per-live-session route attribution (WeakMap: disposed sessions age out). */
    private readonly sessionRoutes;
    /** The most recent route seen this boot; the sidebar strip and the header highlight follow it. */
    private current;
    private sessionListenerDisposer;
    private pollTimer;
    private flushTimer;
    private pollInFlight;
    /** The running poll cycle; manual refresh joins it instead of no-oping. */
    private pollPromise;
    /** Serialized ledger flushes: overlapping debounce/stop flushes queue, never interleave. */
    private flushChain;
    /** True once loadPersisted finished; nothing may overwrite the files before that. */
    private loaded;
    private disposed;
    /** Last prune guard: once per local day, and whenever retention shrinks. */
    private lastPrune;
    constructor(ctx: Context, options: UsageServiceOptions);
    /** Start the listeners, load persisted state, and arm the first poll. */
    start(): void;
    /**
     * Stop timers and flush pending ledger writes. The returned promise
     * resolves after the final flush lands, so a successor instance (the Host
     * reloads the profile row on a config change) can serialize its first load
     * behind it.
     */
    stop(): Promise<void>;
    /** Re-apply options to this running instance; retention shrink prunes now. */
    applyOptions(options: UsageServiceOptions): void;
    /** Force one poll now (manual refresh route); joins an in-flight cycle. */
    refresh(): Promise<void>;
    /** Assemble the overview document the browser section renders. */
    overview(): UsageOverviewView;
    /**
     * The strip-ready current-provider view: the resolved display name plus
     * today's ledger totals for the provider's adapter family (the route
     * itself when adapter-less). `today` is absent on a day without usage —
     * a strip about nothing is noise, not information.
     */
    private currentView;
    /**
     * One retained local day aggregated per provider and model, as the day
     * route serves it. A day the ledger never held — pruned by retention, or
     * simply without usage — reads as a zeroed day rather than an error, so a
     * picker selection that aged out degrades to "no usage" instead of a broken
     * panel. The route gates the key's shape before it gets here.
     */
    day(dateKey: string): UsageDayView;
    /** One local day aggregated per provider. */
    private daySummary;
    /**
     * Today's ledger totals for one provider's adapter family — the exact
     * route when adapter-less, the merged family otherwise, so aliased routes
     * of one account (the deepseek catalog id and its runtime alias) fold
     * together.
     */
    private familyUsageToday;
    /**
     * Accrue the official DeepSeek family's real spend from observed CNY
     * balance decreases; a balance rise is a top-up and never counts. The
     * family's route ids can alias one account, so the watch follows the
     * largest balance seen this cycle and accrues only decreases of that
     * series — a failed probe keeps the stale balance and accrues nothing
     * until the next success reports the whole drop at once.
     */
    private accrueDeepSeekSpend;
    /**
     * The display name for a route key: the LLM runtime's first, then the
     * adapter's, then the id itself — the snapshot may not exist for
     * adapter-less routes, yet the sidebar strip still needs a legible title.
     */
    private routeDisplayName;
    private onSessionEvent;
    /**
     * Normalize a provider TokenUsage into the ledger bucket (one call). The
     * DeepSeek official family is priced at the fold instant (its billing
     * period is time-of-day); other families stay unpriced (cost 0).
     */
    private totalsFrom;
    private loadPersisted;
    private scheduleFlush;
    /**
     * Queue one ledger flush behind the previous one. Debounce and stop-time
     * flushes serialize here, so two `writeJsonAtomic` calls can never run
     * concurrently on the same path.
     */
    private flushLedger;
    private writeLedgerOnce;
    /**
     * Prune days past retention. Runs at most once per local day and whenever
     * `retainDays` shrinks — not only at startup, so long-lived processes and
     * live settings changes both honor retention.
     */
    private pruneIfNeeded;
    private persistSnapshots;
    private rearmPoll;
    /**
     * One poll cycle: enumerate routes, resolve credentials, probe.
     * A call while a cycle is already running joins that cycle instead of
     * returning immediately, so a manual refresh always waits for real probes.
     */
    pollNow(): Promise<void>;
    /**
     * Every route the service probes and renders: the runtime's live providers
     * plus the configurable directory's catalog entries, then alias-folded so a
     * dormant catalog entry cannot shadow the live route of the same adapter
     * family (see foldAliasRoutes).
     */
    private listProviderRoutes;
    private probeRoute;
    /**
     * Resolve the credential backing one route: pi-ai credential records
     * first, then the profile's apiKeyEnv reference, then the DeepSeek
     * official adapter's env reference. OAuth grants hand their stored access
     * token to the oauth-aware adapters (Codex plan quota); a stale token
     * fails its probe with a 401 and refreshes the next time the harness
     * itself runs that provider.
     */
    private resolveCredential;
    /** The llm-pi-ai profile object for one provider route, when configured. */
    private piAiProfile;
    /** The DeepSeek official adapter's credential reference name. */
    private deepseekApiKeyEnv;
    /** The DeepSeek official adapter's configured baseURL. */
    private deepseekBaseUrl;
    /** The effective base URL for a provider route (pi-ai or deepseek). */
    private routeBaseUrl;
}
