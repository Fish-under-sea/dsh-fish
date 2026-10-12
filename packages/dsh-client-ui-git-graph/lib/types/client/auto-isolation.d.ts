/**
 * Auto-isolation (experimental, settings-gated): wrap the shared workspaces
 * service's `startSession` so the New Session action of a GIT workspace
 * creates a fresh managed worktree first and starts the session there — the
 * Claude-desktop-style automatic isolation shape.
 *
 * This is a RUNTIME patch of a browser-side singleton, not a source patch:
 * the wrapper shadows the instance method, delegates everything it cannot
 * isolate, and restores the original on dispose. It depends on unpublished
 * client-runtime internals, so the shape is probed at install time and any
 * mismatch degrades to the official behavior with a console diagnostic —
 * never a hard failure. Only `startSession` is wrapped: `connectWorkspace`
 * keeps its blank-session reuse semantics, so startup selection and direct
 * workspace connects never spawn worktrees.
 * @module dsh-git-graph/client/auto-isolation
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { GitApi } from './api.ts';
/**
 * Install the startSession wrapper on the shared navigation service.
 * @param scope - client context carrying the navigation (`uiWorkspace`) and
 * registry (`workspaces`) faces plus the sessions list.
 * @param git - the /git/* client (config + worktree verbs).
 * @returns the disposer restoring the official method.
 */
export declare function installAutoIsolation(scope: ClientContext, git: GitApi): () => void;
//# sourceMappingURL=auto-isolation.d.ts.map