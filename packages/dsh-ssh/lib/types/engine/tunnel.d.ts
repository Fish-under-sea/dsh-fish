/**
 * Local port-forward tunnels: one loopback-only listener per tunnel, pinned
 * to a pooled connection so an idle sweep never closes it, with per-tunnel
 * socket tracking and stop (single / alias-scoped / all).
 */
import { type Server as NetServer, type Socket } from 'node:net';
import type { TunnelInfo } from '../protocol.ts';
import { type PoolEngine, type PoolRecord } from './connection-pool.ts';
/** One active tunnel record (server + pinned connection + live sockets). */
export interface TunnelRecord {
    info: TunnelInfo;
    server: NetServer;
    alias: string;
    /** The pooled connection this tunnel pins; siblings on one alias may share it. */
    record: PoolRecord;
    sockets: Set<Socket>;
    /** Detach the link-death hook startTunnel installs on the pooled client. */
    detachLink?: () => void;
}
/** The engine slice the tunnel module needs (adds the tunnel registry). */
export interface TunnelEngine extends PoolEngine {
    readonly tunnels: Map<string, TunnelRecord>;
    nextTunnelId: number;
}
/** Start a local port-forward tunnel (listens on 127.0.0.1 only). */
export declare function startTunnel(engine: TunnelEngine, alias: string, options: {
    remotePort: number;
    remoteHost?: string;
    localPort?: number;
}): Promise<TunnelInfo>;
/** All active tunnels. */
export declare function listTunnels(engine: TunnelEngine): TunnelInfo[];
/** Stop one tunnel (closes the listener, live sockets, and the pinned connection). */
export declare function stopTunnel(engine: TunnelEngine, id: string): boolean;
/** Stop all tunnels (optionally for one alias). */
export declare function stopAllTunnels(engine: TunnelEngine, alias?: string): number;
