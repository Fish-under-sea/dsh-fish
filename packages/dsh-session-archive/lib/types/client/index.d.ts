/**
 * dsh-session-archive browser half — owns the `archived-sessions` settings
 * section (the official id, at nav order 25) instead of seating a parallel
 * first-level entry. DSH 0.1.7-alpha.2 no longer mounts the official
 * `@deepseek-ai/dsh-client-ui-settings-unarchive-sessions` page that used to
 * own that id, so this section is the only 「已归档会话」 nav entry and it
 * carries both the native restore behaviour (the section opens on the archived
 * view) and this plugin's batch, delete and retention surfaces. All session
 * enumeration and mutation happens in the host half over loopback-fenced
 * routes; this bundle renders the inventory document and drives the batch
 * pipelines.
 * @module @fish-under-sea/dsh-session-archive/client
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
