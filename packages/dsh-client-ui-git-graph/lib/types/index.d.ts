/**
 * @fish-under-sea/dsh-client-ui-git-graph — host half: the workspace-gated git
 * service and its /git/* HTTP routes (JSON operations + SSE change stream)
 * on the shared webserver, plus the opt-in model-facing git_worktree tool.
 * The browser half (exports "./client") is served by client-modules from
 * the same package's dsh.client declaration.
 *
 * The UI-triggered git verbs (switch/create-branch/worktree operations) own
 * no model-visible surface. The git_worktree tool is the deliberate,
 * settings-gated exception (agentTool, default off): while enabled, agents
 * may create/list/remove managed worktrees of their calling session's
 * repository.
 * @module @fish-under-sea/dsh-client-ui-git-graph
 */
import type { Context } from '@deepseek-ai/cordis';
import { Config } from './host/config.ts';
/** Required services: the route registry, the managed subprocess seam, and the workspace registry. */
export declare const inject: string[];
/**
 * The plugin's Config schema, re-exported for the Host: the Loader validates
 * this row's profile patch against it and the settings service generates the
 * entry's page from it.
 */
export { Config } from './host/config.ts';
export type { ConfigInput, ResolvedConfig } from './host/config.ts';
declare module '@deepseek-ai/cordis' {
    /**
     * Loader event carrying the volatile config paths it just committed into a
     * running plugin. Declared locally: this package reads the event but does
     * not depend on `@deepseek-ai/cordis-plugin-loader`, the package that owns
     * the declaration (the running Loader emits it either way).
     */
    interface Events {
        /** Volatile config values were committed into this fiber without a remount. */
        'loader/volatile-update'(paths: readonly (readonly string[])[]): void;
    }
}
/**
 * Mount the git service, its routes, and the opt-in tool. The settings page
 * is the Host's own generation from {@link Config}: this half registers no
 * settings section.
 * @param ctx - context carrying webServer, subprocess, and workspaceRegistry.
 * @param config - the row's config as the Host resolved it (live references).
 */
export declare const apply: typeof applyImpl;
declare function applyImpl(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map