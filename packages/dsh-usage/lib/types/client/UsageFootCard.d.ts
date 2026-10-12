/**
 * Sidebar foot card: the compact usage glance seated below the shell sidebar's
 * Settings row. It is deliberately a GLANCE, not the panel the 2026-09-18
 * removal took out. Two states, persisted across reloads:
 *
 * - expanded (default): a price-first headline (today's estimated spend,
 *   falling back to today's tokens when nothing priced was recorded), a
 *   tokens/calls line, up to two configured-provider balances, and an
 *   updated-at footer;
 * - collapsed: a one-line strip with the gauge glyph, the spending
 *   provider's name, the label and the headline value.
 *
 * The card body is one button that opens the settings panel on the usage
 * section, so detail lives in exactly one place; the corner chevron toggles
 * the collapse state (sibling buttons — buttons inside a button are invalid
 * HTML).
 *
 * Data comes from the same shared store the settings section reads; the card
 * runs its own relaxed poll loop (30 s, visible-tab only) because the sidebar
 * foot is permanently mounted. The card disappears while the plugin is
 * disabled (settings flag) or while the host serves no usage routes (a 404
 * means the host half is off), matching the section's own gating.
 * @module @fish-under-sea/dsh-usage/client/UsageFootCard
 */
import { type ReactNode } from 'react';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import { type UsageSettings } from './UsageSectionCard.tsx';
import type { UsageStoreInstance } from './usage-store.ts';
/** Props the mount forwards into the React tree. */
export interface UsageFootCardProps {
    /** The shared overview store (section and card read the same snapshot). */
    store: UsageStoreInstance;
    /** Fetch one overview now. */
    poll: () => void;
    /** Card-body click: open the settings panel on the usage section. */
    onOpen: () => void;
    /** The shared settings form; the card hides while the plugin is disabled. */
    settings: ConfigForm<UsageSettings>;
    /** Locale-change source; the plain copy re-renders on a language switch. */
    locale?: {
        subscribe(listener: () => void): () => void;
    };
}
/** Poll cadence of the permanently seated card; the section's 10 s loop stays its own. */
export declare const FOOT_CARD_POLL_MS = 30000;
/** localStorage key holding the collapsed flag ('1' = collapsed strip). */
export declare const FOOT_CARD_COLLAPSED_KEY = "dsh-usage.foot-card.collapsed";
/** Read the persisted collapsed flag (absent = expanded). */
export declare function readFootCardCollapsed(): boolean;
/**
 * Render the foot card content for the current store snapshot.
 * @param props - store, poller, settings form and open callback from the mount.
 * @returns the card, or null while disabled / host-off.
 */
export declare function UsageFootCard(props: UsageFootCardProps): ReactNode;
