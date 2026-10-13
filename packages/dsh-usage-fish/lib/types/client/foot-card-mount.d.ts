/**
 * Sidebar foot card mounting.
 *
 * The foot's only slot (sidebar.footer.action) stacks ABOVE the Settings row
 * and cannot host a block, so the card container is inserted into the shell's
 * foot area directly above the Settings seat — keeping Settings the foot's
 * terminal row instead of hanging a card off the sidebar floor. It self-heals
 * with the page-wide body-mutation hub: a React re-render that displaces the
 * container re-seats it on the next frame, and a whole-pane rebuild is noticed
 * by the same body-level watcher the family entry rows use.
 *
 * The container is a plain div carrying its own React root, so it can never
 * disturb the shell's reconciliation.
 * @module @fish-under-sea/dsh-usage-fish/client/foot-card-mount
 */
import { type UsageFootCardProps } from './UsageFootCard.tsx';
/** Stable data attribute identifying the injected card container. */
export declare const FOOT_CARD_SELECTOR = "[data-dsh-usage-foot-card]";
/**
 * Open the settings panel on the usage section. The shell owns the panel's
 * open state and exposes no service for it, so the card replays the user's
 * own path: activate the sidebar Settings trigger, then pick the nav row
 * carrying the section's (localized) label. Every step degrades silently —
 * with the panel already open only the nav pick runs, and a missing row
 * leaves the panel on its default section.
 * @param label - the usage section's nav label in the active locale.
 */
export declare function openUsageSettings(label: () => string): void;
/**
 * Mount the sidebar foot card directly above the Settings row.
 * @param props - the store/poll/settings/open inputs of the apply body.
 * @returns disposer removing the container and its observers.
 */
export declare function mountUsageFootCard(props: UsageFootCardProps): () => void;
