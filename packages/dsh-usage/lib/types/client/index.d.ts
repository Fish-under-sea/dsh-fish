/**
 * dsh-usage browser half — seats the first-level 使用统计 settings section
 * (below the Workshop entry) plus the compact usage glance card below the
 * sidebar's Settings row. The section polls the host overview only while it
 * is open; the foot card runs its own relaxed loop because the sidebar foot
 * is permanently mounted. All provider probing and credential handling
 * happens in the host half; this bundle only renders the overview document.
 * @module @fish-under-sea/dsh-usage/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import { type UsageSettings } from './UsageSectionCard.tsx';
/** Required services. */
export declare const inject: string[];
export type { UsageSectionProps, UsageSectionFace } from './UsageSectionCard.tsx';
export type { UsageUiState } from './usage-store.ts';
export type { UsageSettings };
/**
 * One settings namespace a family card binds. The 0.1.7 client exports no spec
 * type (the form controller takes it privately), so the binder's input shape is
 * restated here.
 */
export interface UsageSettingsBindSpec<T> {
    /** Settings namespace registered by the owning host plugin. */
    namespace: string;
    /** Narrow one wire section; undefined keeps the last accepted value. */
    decode?: (section: unknown) => T | undefined;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        /**
         * Optional family settings binder provided by dsh-web-settings; absent when
         * that group plugin is not installed, so callers fall back to the native
         * per-entry forms (`ctx.configForms`).
         */
        webUiSettings?: {
            bind<S>(spec: UsageSettingsBindSpec<S>): ConfigForm<S>;
        };
    }
}
/**
 * Client plugin body: register dictionaries and seat the settings section.
 * The overview poll loop and the store live with the section component's
 * mount cycle, so no background traffic exists while the page is closed.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
