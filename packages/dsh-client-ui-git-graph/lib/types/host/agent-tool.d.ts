/**
 * The opt-in model-facing `git_worktree` tool: an agent may create, list,
 * and remove managed worktrees of its calling session's repository. This
 * deliberately reverses the package's original 'git stays off the
 * model-visible surface' rule for users who enable it — registration only
 * happens while the agentTool setting is on (default off).
 *
 * EnterWorktree-style session migration is impossible (a session's cwd is
 * immutable), and under workspace-write sandboxing the agent cannot write
 * outside its session root, so `create` also registers the worktree as a
 * workspace: the NEXT session opened on it runs fully inside the worktree
 * with correct fences. Under danger-full-access the agent may additionally
 * operate in the returned path directly.
 * @module dsh-git-graph/host/agent-tool
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import type { GitService } from './git-service.ts';
/** The registered tool name. */
export declare const GIT_WORKTREE_TOOL = "git_worktree";
/**
 * Build the tool definition bound to one service instance. The definition is
 * a plain literal (no defineTool): arguments arrive frozen and are narrowed
 * here, business rejections return `ok: false` values so the model can react.
 * @param ctx - host context (workspace registry for create/remove linkage).
 * @param service - the workspace-gated git service.
 */
export declare function buildWorktreeTool(ctx: Context, service: GitService): ToolDefinition;
//# sourceMappingURL=agent-tool.d.ts.map