/**
 * Cross-tab SSE leader relay (issue #383).
 *
 * Chrome/Edge cap HTTP/1.1 connections per origin at 6, and the pool is
 * SHARED across same-origin tabs: every DSH tab already holds the core
 * /plugins/events stream, so each plugin EventSource a tab opens brings two
 * tabs to the pool limit and every plain fetch (list/read/git-status POSTs)
 * queues forever. There is no per-tab fix inside the fetch layer — the
 * streams themselves must be shared.
 *
 * This module keeps exactly ONE EventSource per URL across the whole
 * browser: tabs elect a leader through the Web Locks API (the lock releases
 * automatically when the leader's tab closes or navigates), the leader
 * relays every event over a BroadcastChannel, and followers receive the
 * broadcast instead of opening their own stream. Within one tab, callers
 * sharing a URL also share the single relay. When Web Locks or
 * BroadcastChannel is unavailable the module degrades to the old behavior
 * (one plain EventSource per subscription) — never worse than today.
 */
/** Constructor/namespace seams so tests can drive the relay without a browser. */
export interface SseRelaySeams {
    eventSource?: typeof EventSource;
    broadcastChannel?: typeof BroadcastChannel;
    locks?: LockManager;
}
/**
 * Subscribe to an SSE endpoint shared across every tab of the browser.
 * @param url - same-origin EventSource URL (including its query string).
 * @param eventName - the SSE event field to listen for (e.g. 'change').
 * @param onEvent - fired with the raw event data string on every push.
 * @param seams - constructor overrides (tests).
 * @returns the disposer; destroying the LAST local listener tears the relay down.
 */
export declare function subscribeSharedEvents(url: string, eventName: string, onEvent: (data: string) => void, seams?: SseRelaySeams): () => void;
//# sourceMappingURL=sse-leader.d.ts.map