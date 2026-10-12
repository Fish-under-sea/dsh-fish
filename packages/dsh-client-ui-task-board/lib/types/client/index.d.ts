/**
 * Task-board client plugin: wires the framework-free core (controller,
 * execution service, store) to the real client runtime and mounts the two
 * DOM surfaces — the sidebar entry row and the board view in the center
 * column.
 *
 * Failure policy: DOM mounting problems are logged, never thrown — the web
 * shell fails the whole boot when a plugin apply throws, and an external
 * plugin must not take the GUI down.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { ConfigForm, ConfigForms } from '@deepseek-ai/dsh-client-ui-settings/client';
import { type TaskBoardSettings } from './TaskBoardSettingsCard.tsx';
import { type TaskBoardKey } from './locales.ts';
import { type TaskBoardCardDecorationProps, type TaskBoardDetailSectionProps, type TaskBoardSettingsSectionProps } from '../core/extension.ts';
/** Domain-owned description of one settings namespace a family card binds. */
export interface SettingsFormSpec<T> {
    /** Settings namespace the card edits. */
    namespace: string;
    /**
     * Narrow one wire section; undefined keeps the last accepted value. The
     * shared form already resolves the namespace's own serialized wire schema,
     * so a decoder exists only to narrow beyond that schema.
     */
    decode?: (section: unknown) => T | undefined;
}
/**
 * The family settings binder published by dsh-web-settings. Its `bind` resolves
 * a family namespace to the profile entry id that owns it and hands back the
 * shared configuration form, so it is the only seat that can reach this card's
 * form on a Host whose row id is not the namespace.
 */
export interface SettingsFormBinder {
    /** Bind one family settings namespace. */
    bind<T>(spec: SettingsFormSpec<T>): ConfigForm<T>;
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Task-board surface copy. */
        'task-board': TaskBoardKey;
    }
    interface SlotMap {
        /**
         * The child slot the Web UI plugin group declares; this card registers
         * into the group's list seat rather than the official
         * bundle-configuration seat. Spelled here with the same shape so this
         * package can register without depending on the sibling UI package.
         */
        'web-ui.plugin.item': {
            kind: 'list';
            scope: 'root';
            owner: SettingsPluginItemOwnerProps;
        };
        /** Provider task-detail section; the board declares and renders it. */
        'task-board.detail.section': {
            kind: 'list';
            scope: 'root';
            owner: TaskBoardDetailSectionProps;
        };
        /** Provider settings section; the board declares and renders it. */
        'task-board.settings.section': {
            kind: 'list';
            scope: 'root';
            owner: TaskBoardSettingsSectionProps;
        };
        /** Provider card decoration; the board declares and renders it. */
        'task-board.card.decoration': {
            kind: 'list';
            scope: 'root';
            owner: TaskBoardCardDecorationProps;
        };
    }
}
/** Owner share of a plugin card (the section supplies nothing). */
export interface SettingsPluginItemOwnerProps {
    /** Marker field: card owner props are intentionally empty. */
    children?: never;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        /**
         * Optional family settings binder provided by dsh-web-settings; absent
         * when that group plugin is not installed, so callers fall back to the
         * shared configuration forms service.
         */
        webUiSettings?: SettingsFormBinder;
    }
}
/**
 * Required services (fiber inject waiting — the runtime must be up first).
 * The generated remote namespaces are not all hard injects: `remote.session`
 * is one, while `remote.agentPresets` is reached through a scoped inject at
 * use time (see mountUi), because the namespace mounts with the official
 * api-remotes assembly applied beside this entry rather than before it.
 */
export declare const inject: string[];
/**
 * Mount the task board.
 * @param ctx - client root context (services: sessions, workspaces).
 */
export declare function apply(ctx: ClientContext): void;
/**
 * Bind the settings form this card stages over.
 *
 * The family binder (`ctx.get('webUiSettings')`, published by dsh-web-settings)
 * comes first: it is what traces this package's family namespace onto the
 * profile entry id the Host serves the form under, and it keeps the loopback
 * bridge as its own fallback. A page without that group falls back to the
 * shared configuration forms service bound directly at one of this package's
 * own profile entry ids.
 * @param ctx - client root context.
 * @returns the form the settings card reads and writes.
 */
export declare function bindSettingsForm(ctx: ClientContext): ConfigForm<TaskBoardSettings>;
/**
 * The profile entry id this package's own row carries, for a page that serves
 * no family binder.
 *
 * The shared describe mirror is the only local evidence of which row id this
 * profile actually serves, but it answers asynchronously: at plugin activation
 * it usually holds nothing yet. An unanswered mirror therefore binds the
 * aggregate row id rather than guessing among the candidates, and the binding
 * is re-resolved once the mirror answers — see
 * {@link createServedEntryForm}, which owns that rebinding.
 * @param forms - the shared configuration forms service.
 * @returns the entry id to bind before the mirror answers.
 */
export declare function servedEntryId(forms: ConfigForms): string;
