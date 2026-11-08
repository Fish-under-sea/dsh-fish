/**
 * The SSH engine facade: a per-alias persistent connection pool (ssh2) with
 * multi-hop jump support, command execution, PTY shells, SFTP transfers,
 * local port-forward tunnels and cluster execution. The heavy lifting lives
 * in the engine/ modules (connection-pool, pty, sftp, tunnel, cluster); this
 * class composes them behind one new SshEngine instance per plugin apply.
 */
import type { ClusterResult, ExecResult, SshHostSummary, TestResult, TransferProgress, TunnelInfo } from './protocol.ts';
import type { HostStore } from './store.ts';
import { type EngineOptions, type KeyboardInteractiveHandler, type PoolRecord } from './engine/connection-pool.ts';
import { type ShellSession } from './engine/pty.ts';
import { type TunnelRecord } from './engine/tunnel.ts';
export type { EngineOptions, KeyboardInteractiveHandler } from './engine/connection-pool.ts';
export type { ShellSession } from './engine/pty.ts';
export type { PoolRecord } from './engine/connection-pool.ts';
export type { TunnelRecord } from './engine/tunnel.ts';
/**
 * The engine. Owns the pool, tunnels, and all operations. One instance per
 * plugin apply; dispose() closes every connection.
 */
export declare class SshEngine {
    readonly store: HostStore;
    readonly opts: Required<EngineOptions>;
    readonly pool: Map<string, PoolRecord>;
    readonly acquireQueue: Map<string, Promise<PoolRecord>>;
    readonly tunnels: Map<string, TunnelRecord>;
    nextTunnelId: number;
    private sweepTimer;
    /**
     * @param store - the host config store.
     * @param options - engine knobs (defaults applied).
     */
    constructor(store: HostStore, options?: EngineOptions);
    /**
     * Change the pre-ready ceiling (TCP connect + key exchange + user
     * authentication) for connections opened from now on. A pooled connection
     * keeps serving until it reconnects, because the ceiling governs the
     * connect path only.
     */
    setConnectTimeout(timeoutMs: number): void;
    /** Secret-free host list (filtered by the optional query). */
    list(query?: string): SshHostSummary[];
    /** One host summary by alias. */
    find(alias: string): SshHostSummary | undefined;
    /** Run one command on `alias` (reusing the pooled connection). */
    exec(alias: string, command: string, timeoutMs?: number, signal?: AbortSignal): Promise<ExecResult>;
    /** Run one command against many hosts concurrently. */
    cluster(options: {
        command: string;
        aliases?: string[];
        environment?: string;
        tags?: string[];
        timeoutMs?: number;
        maxWorkers?: number;
        signal?: AbortSignal;
    }): Promise<ClusterResult[]>;
    /** Open a PTY shell session for the web terminal (standalone connection). */
    openShell(alias: string, size: {
        cols: number;
        rows: number;
    }, onKeyboardInteractive?: KeyboardInteractiveHandler): Promise<ShellSession>;
    /** Upload one local file (or directory tree) to a remote path. */
    upload(alias: string, localPath: string, remotePath: string, recursive: boolean, onProgress?: (progress: TransferProgress) => void): Promise<{
        bytes: number;
        files: number;
    }>;
    /** Download one remote file to a local path. */
    download(alias: string, remotePath: string, localPath: string, onProgress?: (progress: TransferProgress) => void): Promise<{
        bytes: number;
    }>;
    /** List a remote directory (file browser). */
    ls(alias: string, path: string): Promise<import('./protocol.ts').RemoteDirEntry[]>;
    /** Start a local port-forward tunnel (listens on 127.0.0.1 only). */
    startTunnel(alias: string, options: {
        remotePort: number;
        remoteHost?: string;
        localPort?: number;
    }): Promise<TunnelInfo>;
    /** All active tunnels. */
    listTunnels(): TunnelInfo[];
    /** Stop one tunnel (closes the listener, live sockets, and the pinned connection). */
    stopTunnel(id: string): boolean;
    /** Stop all tunnels (optionally for one alias). */
    stopAllTunnels(alias?: string): number;
    /**
     * Drop every live artifact bound to one alias: stop its tunnels and close
     * the pooled connection. Host entries that are deleted or whose connection
     * fields change must never keep serving a stale, previously authenticated
     * connection — the next operation re-connects from the current config.
     */
    dropAlias(alias: string): void;
    /** Probe connectivity with a cross-platform shell command. */
    test(alias: string): Promise<TestResult>;
    /** Close every pooled connection and tunnel. */
    dispose(): void;
}
