/**
 * HTTP routes for dsh-session-archive. Every route is loopback-fenced (the
 * plugin manages destructive local session data; tunnels and LAN clients get
 * 403), mutating routes additionally require POST, and the delete route
 * surfaces the host plan on confirmation mismatch.
 * @module @fish-under-sea/dsh-session-archive-fish/host/routes
 */
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import { type ArchiveService } from './janitor.ts';
export declare const ARCHIVE_API_PREFIX = "/api/dsh-session-archive";
export declare function makeInventoryRoute(service: ArchiveService): WebRoute;
export declare function makePreviewRoute(service: ArchiveService): WebRoute;
export declare function makeArchiveRoute(service: ArchiveService): WebRoute;
export declare function makeUnarchiveRoute(service: ArchiveService): WebRoute;
export declare function makeDeleteRoute(service: ArchiveService): WebRoute;
export declare function makeAutoPreviewRoute(service: ArchiveService): WebRoute;
export declare function makeAutoRunRoute(service: ArchiveService): WebRoute;
export declare function makeArchiveRoutes(service: ArchiveService): WebRoute[];
