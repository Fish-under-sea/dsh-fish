/**
 * The usage statistics settings page: one family settings card whose header
 * carries the plugin switch, whose body holds three tabs (用量: today's
 * usage, balances, trend; 个人套餐: per-provider plan quota windows; Token
 * 银行: the whale-yuan voucher minted from every provider's ledger usage)
 * and, under them, the display rows. Data comes from the host's
 * loopback-fenced /api/dsh-usage/overview document; polling runs only while
 * the section is mounted and the tab is visible.
 * @module @fish-under-sea/dsh-usage-fish/client/UsageSectionCard
 */
import { type ReactNode } from 'react';
import type { UsageStoreInstance } from './usage-store.ts';
import type { UsageSettingsCardFace } from './usage-settings-card.ts';
import type { UsageDayView } from '../core/types.ts';
export type { UsageSettings } from './usage-settings-card.ts';
/** The registration-side face the section's slot entry injects. */
export interface UsageSectionFace {
    /** The section-local store (overview snapshot + lifecycle). */
    store: UsageStoreInstance;
    /** Fetch one overview now. */
    poll: () => void;
    /** Force a host probe cycle now (resolves with the fresh overview). */
    refresh: () => void;
    /**
     * Fetch one retained local day (YYYY-MM-DD) from the host. The overview
     * only carries today plus the list of recorded days, so a day the user picks
     * is one small on-demand request.
     */
    loadDay: (date: string) => Promise<UsageDayView>;
    /** The settings card over the usage namespace: the plugin switch and the display rows. */
    settingsCard: UsageSettingsCardFace;
}
export interface UsageSectionProps extends UsageSectionFace {
    /** Close the settings panel (the shell owns the open state). */
    close: () => void;
}
/** Compact token count: 12345 -> 12.3k, 1234567 -> 1.23M. */
export declare function formatTokens(value: number): string;
/** The section component; the slot merges the face into these props. */
export declare function UsageSectionCard(props: UsageSectionProps): ReactNode;
