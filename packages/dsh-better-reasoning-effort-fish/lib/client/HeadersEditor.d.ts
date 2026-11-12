/**
 * The provider-card request-header editor (issue #12, MVP-1) — the fetch-layer
 * `user-agent` takeover is its MVP-2 half, rendered in the same section because
 * to the user they are one thing: "what this route sends".
 *
 * Mounted INSIDE the official provider card's own editor container by
 * `injection/provider-card.ts`. It deliberately does NOT ride the official
 * `settings.models.provider-card` keyed seat: that seat admits a single entry
 * per (key, priority), and the dsh-web aggregate's model-capabilities plugin
 * registers the very same `llm-pi-ai` key at the same priority — taking the
 * seat displaced that plugin's entire per-model capabilities panel (its
 * thinking-effort editor among them) without a trace. The seat stays free.
 *
 * Write discipline: the draft is a whole dict and only the explicit Save writes
 * it, so an edit can never race a stale snapshot of the same card the way
 * per-keystroke writes would — and Cancel/Reload behaves like the official
 * card's own fields. The headers land through `llm-pi-ai.providers.<route>.headers`,
 * the one channel the adapter actually sends.
 *
 * @module dsh-better-reasoning-effort/HeadersEditor
 */
import type { ReactNode } from 'react';
import type { RemoteApi } from './types.js';
/**
 * What the default guard (issue #2) has done, as the host reports it. The
 * guard wraps the process-wide dispatch entries, so this report is the only
 * way the page can show that the fallback is installed AND firing.
 */
export interface GuardStatus {
    /** Whether the wrap is enabled in this deployment. */
    enabled: boolean;
    /** Whether the dispatch entries are currently wrapped. */
    installed: boolean;
    /** Effort-less calls naming a route and a model that the guard examined. */
    inspected: number;
    /** Calls it rewrote with the ladder's vendor default. */
    injected: number;
    /** The most recent rewrite, when one has happened. */
    lastInjection?: {
        provider: string;
        model: string;
        level: string;
    };
}
/** The fixed fetch-layer report the host route serves. */
export interface HeaderEnvironment {
    /** Whether the fetch-layer takeover is enabled in this deployment. */
    enabled: boolean;
    /** Whether the plugin's wrapper currently owns the global fetch. */
    installed: boolean;
    /** Routes whose `user-agent` the plugin is sending. */
    overrides: {
        origin: string;
        route: string;
        userAgent: string;
    }[];
    /** Origins two routes claim with different values. */
    conflicts: {
        origin: string;
        routes: string[];
        values: string[];
    }[];
    /** What was found of the plugins rewriting the same surface. */
    environment: {
        adapter: 'patched' | 'stock' | 'unknown';
        siblings: {
            name: string;
            path: string;
        }[];
        preferOfficialLayer: boolean;
    };
    /** Absent on a host that predates the report. */
    guard?: GuardStatus;
}
/** Props of {@link HeadersEditor}. */
export interface HeadersEditorProps {
    /** The provider route this card edits. */
    route: string;
    /** The write seam. */
    api: RemoteApi;
    /** Localized copy. */
    t: (key: string, params?: Record<string, string | number>) => string;
}
/** One editable header row; a stable `id` keeps React keys off the name. */
interface DraftRow {
    id: number;
    name: string;
    value: string;
}
/** A draft as the editor holds it: ordered rows plus the UA choice. */
interface Draft {
    rows: DraftRow[];
    userAgent: string;
}
/** The headers dict a draft stores: blank rows dropped, UA merged back in. */
export declare function headersFromDraft(draft: Draft): Record<string, string>;
/**
 * Render the provider card's request-header section.
 * @param props - route identity, write seam and copy.
 * @returns the section.
 */
export declare function HeadersEditor({ route, api, t }: HeadersEditorProps): ReactNode;
export {};
