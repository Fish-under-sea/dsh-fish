/**
 * One settings page's seat in either the Web Extensions parent or the legacy
 * first-level settings navigation.
 *
 * The parent supplies the page contract; a child does not know which slot the
 * parent uses internally. While `webUiExtensions` is live the page is handed
 * to its service, which owns keyed mounting and disposal. Without the parent,
 * the same component registers as its original first-level settings section,
 * so a standalone install keeps a working entry.
 */
/** The parent service face this helper consumes. */
export interface WebExtensionPageService {
    readonly sectionId: string;
    registerPage(page: WebExtensionPageSeat): () => void;
}
/** Seat-independent page contribution. */
export interface WebExtensionPageSeat {
    key: string;
    order: number;
    locale: string;
    label(): string;
    inject(): object;
    component: unknown;
    children?: Record<string, {
        kind: 'keyed' | 'list';
        scope: 'root';
    }>;
}
/** The slot-registry slice used for the standalone fallback. */
export interface WebExtensionPageSlots {
    register(options: never, component: never): unknown;
    spec?(key: string): unknown;
    entries?(key: string): readonly {
        component?: unknown;
        options: Record<string, unknown>;
    }[];
}
/** The context slice needed by the migration. */
export interface WebExtensionPageContext {
    slots: WebExtensionPageSlots;
    get?(name: string): unknown;
    on?(event: never, listener: never): unknown;
}
/**
 * Keep exactly one reachable page contribution while the parent loads or
 * unloads. The parent service owns integrated mounting; only the fallback uses
 * this plugin's own slot registry. Slot disposal is synchronous, so the latch
 * prevents a move from recursively registering a duplicate.
 */
export declare function installWebExtensionPage(ctx: WebExtensionPageContext, page: WebExtensionPageSeat): () => void;
