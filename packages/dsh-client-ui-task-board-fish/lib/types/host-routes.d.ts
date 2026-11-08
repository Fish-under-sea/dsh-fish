import type { IncomingMessage } from 'node:http';
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { TaskBoardHostService } from './host-service.ts';
import { type TaskBoardParseDraft, type TaskBoardParseRequest } from './protocol.ts';
import { type TaskBoardAttachmentStore } from './host/attachments.ts';
/**
 * Comment-frame cadence on the event stream. It keeps the connection alive
 * through intermediaries that would close an idle one; it is not a frame the
 * browser reports to the panel (an SSE comment is invisible to EventSource).
 */
export declare const HEARTBEAT_MS = 15000;
/** Header replaced by an authenticated same-host reverse proxy. */
export declare const TASK_BOARD_PROXY_TOKEN_HEADER = "x-dsh-task-board-proxy-token";
/**
 * The composition's Host connection service, narrowed to the one check the
 * board bridges: `requestRejection` runs the Host/Origin fence and verifies
 * the authority-bound `dsh-auth-*` browser session minted by the Host. It
 * answers `undefined` only for a request it admits and 401/403 otherwise.
 * Declared structurally, like the official open-in-app routes do, because the
 * service's package is a browser-side dependency this Host half does not
 * import.
 */
export interface TaskBoardConnectionTrust {
    requestRejection(request: {
        readonly headers: IncomingMessage['headers'];
    }): 401 | 403 | undefined;
}
/** Optional authenticated reverse-proxy access layered over the loopback default. */
export interface TaskBoardRouteAccess {
    trustedProxyHosts?: readonly string[];
    proxyToken?: string;
    /**
    /**
     * Whether the operator's own reverse proxy or tunnel may speak for the
     * browser: a forwarded request that landed on this machine's loopback
     * upstream then counts as trustable, still behind the browser same-origin
     * marker. Read at each request (hence the function), so the settings switch
     * binds the next request without re-registering the routes. Absent or false
     * keeps the pre-existing fence exactly as it was (issue #1906).
     */
    trustForwardedProxy?: () => boolean;
    /**
     * Resolves the Host's `connection` service when a request arrives, so a
     * deployment that mounts it after these routes still gains the bridge and a
     * composition that never mounts it keeps the pre-existing fence. Absent means
     * no bridge (issue #1930).
     */
    connection?: () => TaskBoardConnectionTrust | undefined;
}
/**
 * Host faces the routes need beyond the ledger service. The parse face is
 * resolved lazily by the caller, so a deployment without an llm service still
 * registers the route and answers with a typed "no model" failure instead of
 * leaving the panel with an unmounted path (issue #1540).
 */
export interface TaskBoardRouteOptions {
    parseTask?: (request: TaskBoardParseRequest, signal: AbortSignal) => Promise<TaskBoardParseDraft>;
    /**
     * The official attachment storage, read at request time so a deployment that
     * mounts it after these routes still gains the attachment surface. Absent
     * means this deployment stores no attachments, and every attachment route
     * answers with a typed "storage unavailable" failure.
     */
    attachments?: () => TaskBoardAttachmentStore | undefined;
}
interface ResolvedRouteAccess {
    trustedProxyHosts: ReadonlySet<string>;
    proxyToken?: string;
    trustForwardedProxy: () => boolean;
    connection?: () => TaskBoardConnectionTrust | undefined;
}
/**
 * Task-board route fence. Direct desktop access uses the repository-wide
 * loopback socket + Host guard and additionally requires a browser same-origin
 * marker: a bare local curl without any browser signal cannot exercise the
 * agent control plane (a forged Origin does pass the marker — it is a
 * tripwire, the socket/Host/origin-equality checks carry the authority).
 * Authenticated proxies must be explicitly allowlisted and replace the
 * internal token header after their own authentication step.
 *
 * A third party's proxy cannot inject that token, so a deployment whose own
 * tunnel dials the loopback upstream (issue #1918) can instead turn on
 * trustForwardedProxy: a forwarded request that landed on this machine
 * (loopback socket AND loopback Host) is then admitted on the same browser
 * marker alone. The switch defaults off, so an unconfigured board keeps
 * refusing every forwarded request (issue #1906).
 *
 * A deployment behind a reverse proxy or ingress that DSH itself serves
 * (`--trusted-host`, TLS terminated at the edge) is admitted by the Host's
 * `connection` service instead: a request whose Host/Origin fence and signed
 * browser session it accepts needs no board-specific allowlist, which is why
 * the check runs first when the service is mounted (issue #1930). The fence
 * below stays untouched as the fallback, so a deployment without the service,
 * and every direct client the service does not admit, keeps exactly the
 * pre-existing decision.
 */
export declare function isTrustedTaskBoardRequest(req: IncomingMessage, access: ResolvedRouteAccess): boolean;
export declare function makeTaskBoardRoutes(service: TaskBoardHostService, access?: TaskBoardRouteAccess, options?: TaskBoardRouteOptions): WebRoute[];
export {};
