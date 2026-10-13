/**
 * Git-graph surface plugin, browser half. The branch selector is rendered
 * only for blank sessions: it uses the input selector row's context hole
 * (`conversation.input.selector.context`) beside the official workspace
 * selector. When that shell slot is unavailable, it waits for
 * {@link CONTEXT_FALLBACK_MS} then uses `conversation.input.dock` for the
 * blank-session hero phase, where it joins the official hero chip row after
 * the agent-preset seat. Active sessions render no branch-selection control.
 *
 * All git facts arrive through this package's host /git routes. The inject
 * face carries the business verbs and the components remain pure props. The
 * published npm SDK (rc.6) dropped the context-hole type, so it is declared
 * locally below for type-checked registration.
 * @module dsh-git-graph/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { SessionId } from '@deepseek-ai/dsh-api-remotes/client';
import type { BranchesView, GitFeatureConfig, GraphView, RepoStatus, SwitchResult, WorktreeAddResult, WorktreeListView, WorktreeRemoveResult } from '../core/types.ts';
import { type GitGraphKey } from './locales.ts';
export type { GitGraphKey } from './locales.ts';
export { BranchChip } from './chips/BranchChip.tsx';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The git-graph chip copy. */
        'git-graph': GitGraphKey;
    }
    interface SlotMap {
        /**
         * The input selector context-chip hole: feature chips rendered right
         * after the workspace selector (the git branch selector's seat).
         * Session-maybe: the component identifies blank sessions from the
         * baseline and renders no control for an active session.
         *
         * Declared and rendered by the running dsh web shell
         * (ui-conversation's InputSelectorRow); the published npm SDK (rc.6)
         * dropped this hole, so it is spelled locally to keep the chip's
         * registration type-checked without depending on the sibling SDK surface.
         */
        'conversation.input.selector.context': {
            kind: 'list';
            scope: 'session-maybe';
            owner: InputSelectorContextOwnerProps;
        };
    }
}
/** Owner share of the input selector context-chip hole (empty by contract). */
export interface InputSelectorContextOwnerProps {
}
/** Required services: slots for the selector-context entry, sessions for the cwd lookup, workspaces for worktree sessions, locale for the copy. */
export declare const inject: string[];
/** Injected business face of the branch chip: git verbs, keyed by the current session id. */
export interface GitGraphInjected {
    /** The workspace repository snapshot; null when not a repository. */
    repoStatus: (sessionId: SessionId | undefined) => Promise<RepoStatus | null>;
    /** Local branch list with the current branch marked. */
    branches: (sessionId: SessionId | undefined) => Promise<BranchesView | null>;
    /** Workspace-level `git switch --no-guess <branch>`. */
    switchBranch: (sessionId: SessionId | undefined, branch: string) => Promise<SwitchResult>;
    /** `git switch --no-guess -c <name>` from the current HEAD. */
    createBranch: (sessionId: SessionId | undefined, name: string) => Promise<SwitchResult>;
    /** Topo-ordered commit graph. */
    graph: (sessionId: SessionId | undefined, limit?: number) => Promise<GraphView | null>;
    /** All linked worktrees of the session's repository. */
    worktrees: (sessionId: SessionId | undefined) => Promise<WorktreeListView | null>;
    /** Create a managed worktree, register it as a workspace, and start a session in it. */
    createWorktreeSession: (sessionId: SessionId | undefined, name: string, baseRef?: string) => Promise<WorktreeAddResult>;
    /** Remove a managed worktree and unregister its workspace when linked. */
    removeWorktree: (sessionId: SessionId | undefined, worktreePath: string, opts?: {
        force?: boolean;
        deleteBranch?: boolean;
    }) => Promise<WorktreeRemoveResult>;
    /** The live feature config (auto-isolation flags + managed home). */
    gitConfig: () => Promise<GitFeatureConfig | null>;
    /** Host-pushed branch-state changes for the session's workspace. */
    subscribeChanges: (sessionId: SessionId | undefined, onChange: () => void) => () => void;
}
/**
 * How long the chip waits for the selector-context declaration before
 * falling back to the input dock. The window covers the shell's first
 * render of the input selector row after the conversation service is up;
 * shells that never declare the hole (rc.6) land on the dock after it.
 */
export declare const CONTEXT_FALLBACK_MS = 2000;
/**
 * Client plugin body: the branch chip entry with its git verbs, on the
 * selector-context hole with an input-dock fallback.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map