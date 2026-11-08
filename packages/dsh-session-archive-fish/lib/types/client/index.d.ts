/**
 * dsh-session-archive browser half — seats this plugin's own
 * `settings.section` (id `dsh-session-archive`, the plugin id) at nav order
 * 25. The id is never the official `archived-sessions` one: the settings shell
 * renders one nav row per registration without merging same-id sections, and
 * its registry refuses a second registration of the same `id` at the same
 * `priority` (default 0), while `order` only sorts the rows. Two archive
 * plugins claiming the same section id therefore collide whatever order they
 * pick — one registration throws, or one of the two entries silently
 * disappears. Distinct ids let an official page and a third-party archive
 * plugin coexist with this one, one entry each, while a single-archive-plugin
 * install still shows exactly one entry. The section carries this plugin's
 * inventory, batch
 * archive/unarchive, cascade physical delete and retention surfaces. All session
 * enumeration and mutation happens in the host half over loopback-fenced
 * routes; this bundle renders the inventory document and drives the batch
 * pipelines.
 * @module @fish-under-sea/dsh-session-archive-fish/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { SessionArchiveConfig } from '../core/config.ts';
/** Required services. */
export declare const inject: string[];
export type { SessionArchiveFace } from './SessionArchiveCard.tsx';
export type { SessionArchiveConfig };
/**
 * One settings namespace a family card binds. The 0.1.7 client exports no spec
 * type (the form controller takes it privately), so the binder's input shape is
 * restated here.
 */
export interface SessionArchiveFormSpec<T> {
    /** Settings namespace registered by the owning host plugin. */
    namespace: string;
    /** Narrow one wire section; undefined keeps the last accepted value. */
    decode?: (section: unknown) => T | undefined;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        /**
         * Optional family settings binder provided by dsh-web-settings; absent when
         * that group plugin is not installed, so callers bind the shared forms
         * service (`ctx.configForms`) by profile entry id directly.
         */
        webUiSettings?: {
            bind<S>(spec: SessionArchiveFormSpec<S>): ConfigForm<S>;
        };
    }
}
/**
 * Client plugin body: register dictionaries and seat the settings section.
 * The controller and store live with the apply body, so the last inventory
 * renders instantly when the section is reopened.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
