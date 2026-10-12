import type { IncomingMessage } from 'node:http';
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { TaskBoardHostService } from './host-service.ts';
import { type TaskBoardParseDraft, type TaskBoardParseRequest } from './protocol.ts';
/** Header replaced by an authenticated same-host reverse proxy. */
export declare const TASK_BOARD_PROXY_TOKEN_HEADER = "x-dsh-task-board-proxy-token";
/** Optional authenticated reverse-proxy access layered over the loopback default. */
export interface TaskBoardRouteAccess {
    trustedProxyHosts?: readonly string[];
    proxyToken?: string;
}
/**
 * Host faces the routes need beyond the ledger service. The parse face is
 * resolved lazily by the caller, so a deployment without an llm service still
 * registers the route and answers with a typed "no model" failure instead of
 * leaving the panel with an unmounted path (issue #1540).
 */
export interface TaskBoardRouteOptions {
    parseTask?: (request: TaskBoardParseRequest, signal: AbortSignal) => Promise<TaskBoardParseDraft>;
}
interface ResolvedRouteAccess {
    trustedProxyHosts: ReadonlySet<string>;
    proxyToken?: string;
}
/**
 * Task-board route fence. Direct desktop access uses the repository-wide
 * loopback socket + Host guard and additionally requires a browser same-origin
 * marker: a bare local curl without any browser signal cannot exercise the
 * agent control plane (a forged Origin does pass the marker — it is a
 * tripwire, the socket/Host/origin-equality checks carry the authority).
 * Authenticated proxies must be explicitly allowlisted and replace the
 * internal token header after their own authentication step.
 */
export declare function isTrustedTaskBoardRequest(req: IncomingMessage, access: ResolvedRouteAccess): boolean;
export declare function makeTaskBoardRoutes(service: TaskBoardHostService, access?: TaskBoardRouteAccess, options?: TaskBoardRouteOptions): WebRoute[];
export {};
