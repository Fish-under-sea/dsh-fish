/**
 * The git branch selector chip for blank sessions. It mounts in the selector
 * context hole (`conversation.input.selector.context`) beside the official
 * workspace selector. On shells that dropped the hole, it uses
 * `conversation.input.dock` only for the blank-session hero phase and lifts
 * itself into the official hero chip row. It is intentionally absent while a
 * session is running.
 * @module dsh-git-graph/client/chips/BranchChip
 */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { GitGraphInjected } from '../index.ts';
/** Full props of the branch chip: either seat's runtime share (the session-maybe context hole or the dock fallback's blank-session hero) + the git-graph inject face + the locale seat. */
export type BranchChipProps = (PropsRuntime<'conversation.input.selector.context'> | PropsRuntime<'conversation.input.dock'>) & GitGraphInjected & PropsLocale<'git-graph'>;
/** Minimum gap between window-focus git refetches (ms). */
export declare const FOCUS_REFRESH_MIN_MS = 5000;
/**
 * The git branch selector chip for blank sessions.
 * @param props - the composed entry props of whichever seat it mounted in.
 */
export declare function BranchChip(props: BranchChipProps): import("react").JSX.Element | null;
//# sourceMappingURL=BranchChip.d.ts.map