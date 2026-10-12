/**
 * Browser-side usage store: the overview snapshot polled from the host plus
 * the fetch lifecycle. Section-local: the store lives while the settings
 * section is mounted, so polling only runs while the page is open.
 * @module @fish-under-sea/dsh-usage/client/usage-store
 */
import type { EngineStoreHandle, EngineStoreInstance } from '@deepseek-ai/dsh-client-store';
import type { UsageOverviewView } from '../core/types.ts';
/** Section UI state as consumers see it. */
export interface UsageUiState {
    /** Latest host overview; null before the first successful fetch. */
    snapshot: UsageOverviewView | null;
    /** Fetch lifecycle. */
    status: 'loading' | 'ready' | 'error';
    /** Transport error message, when any. */
    error: string | null;
}
/** Store write set. */
export type UsageUiActions = {
    /** Replace the overview (poll result). */
    setSnapshot: (draft: UsageUiState, snapshot: UsageOverviewView) => void;
    /** Mark the fetch lifecycle. */
    setState: (draft: UsageUiState, status: UsageUiState['status'], error: string | null) => void;
};
/** Create the usage store handle (apply world only; never module-level). */
export declare function createUsageStore(): EngineStoreHandle<UsageUiState, UsageUiActions>;
export type UsageStoreInstance = EngineStoreInstance<UsageUiState, UsageUiActions>;
