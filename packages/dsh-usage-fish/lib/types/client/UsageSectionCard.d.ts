/**
 * The usage statistics settings section: three tabs (用量: today's usage,
 * balances, trend; 个人套餐: per-provider plan quota windows; Token 银行:
 * the whale-yuan voucher minted from the DeepSeek official family's usage)
 * plus a compact settings row. Data comes from the host's loopback-fenced
 * /api/dsh-usage/overview document; polling runs only while the section is
 * mounted and the tab is visible.
 * @module @fish-under-sea/dsh-usage-fish/client/UsageSectionCard
 */
import { type ReactNode } from 'react';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { UsageStoreInstance } from './usage-store.ts';
import type { UsageDayView } from '../core/types.ts';
/** The settings fields this section edits (immediate-apply semantics). */
export interface UsageSettings {
    enabled?: boolean;
    pollIntervalSec?: number;
}
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
    /** The shared configuration form this section's settings row reads and writes. */
    settings: ConfigForm<UsageSettings>;
}
export interface UsageSectionProps extends UsageSectionFace {
    /** Close the settings panel (the shell owns the open state). */
    close: () => void;
}
/** Compact token count: 12345 -> 12.3k, 1234567 -> 1.23M. */
export declare function formatTokens(value: number): string;
/** The section component; the slot merges the face into these props. */
export declare function UsageSectionCard(props: UsageSectionProps): ReactNode;
