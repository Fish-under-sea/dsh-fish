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
 * The settings shell's store handle, narrowed to the one write this module
 * performs. A slot registration stores its seat type-erased (`StoreDecl`), so
 * the shape the seat's occupant guarantees is restated here.
 */
export interface SettingsShellStore {
    create(): {
        actions: {
            openSection(id: string): void;
        };
    };
}
/** The registry read the seat lookup needs (structurally `ctx.slots`). */
export interface SlotSeatReader {
    entries(key: string): readonly {
        store?: unknown;
    }[];
}
/** What the card knows about the settings section it opens. */
export interface UsageSettingsTarget {
    /** Slot registration id of the usage section (the nav row the panel selects). */
    id: string;
    /** The section's nav label in the active locale (the DOM replay's row pick). */
    label: () => string;
    /** The settings shell's store handle, when the seat exposes one. */
    store?: SettingsShellStore | undefined;
}
/**
 * Resolve the settings shell's store handle from the `sidebar.settings` seat.
 *
 * The seat is a single-occupant slot and the shell's own registration carries
 * the store that owns the panel's open state and active section, so reading it
 * is the one step that opens the panel without touching the DOM. A shell that
 * exposes no seat, a seat without a store, or a registry answering mid-teardown
 * all yield undefined, and the caller replays the DOM path instead.
 * @param slots - the renderer-owned slot registry.
 * @returns the store handle, or undefined when the seat carries none.
 */
export declare function settingsShellStore(slots: SlotSeatReader | undefined): SettingsShellStore | undefined;
/**
 * Open the settings panel on the usage section.
 *
 * The seat's store is the primary path: `openSection` opens the dialog on the
 * usage row in one call, with no dependence on which plugin occupies the
 * `settings.launcher` seat — an account row there turns a trigger click into a
 * menu, which is how this click used to land on the account menu instead of the
 * panel. Without such a store the card replays the user's own path: activate
 * the launcher (preferring the dialog trigger over a menu trigger), follow a
 * menu launcher's first settings item, then pick the nav row carrying the
 * section's label. Every step degrades silently — a missing surface leaves the
 * page untouched, and with the panel already open only the nav pick runs.
 * @param target - the section id, its localized label, and the seat's store.
 */
export declare function openUsageSettings(target: UsageSettingsTarget): void;
/**
 * Mount the sidebar foot card directly above the Settings row.
 * @param props - the store/poll/settings/open inputs of the apply body.
 * @returns disposer removing the container and its observers.
 */
export declare function mountUsageFootCard(props: UsageFootCardProps): () => void;
