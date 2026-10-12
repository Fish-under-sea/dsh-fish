/**
 * Usage trust fence (issue #1592): loopback (the desktop) always passes, and a
 * live paired-device cookie is an additional allow path when remote-web-ui is
 * loaded — the same family fence the skill center uses. Without that service
 * the fence stays loopback-only, so an unpaired LAN browser keeps its 403.
 * The decision logic lives in the generated pair-access.ts copy (shared by
 * git-graph / pet / skill-explorer).
 */
import type { IncomingMessage } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
/**
 * Whether this request may read the usage overview or trigger a refresh.
 * @param ctx - host context; may expose remoteWebUiPairing.
 * @param request - the incoming HTTP request.
 * @returns true for loopback, or a live paired-device cookie.
 */
export declare function isUsageAllowed(ctx: Context, request: IncomingMessage): boolean;
