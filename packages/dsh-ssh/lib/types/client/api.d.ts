/**
 * Browser-side API client for the /api/dsh-ssh route family. The only data
 * access path the panel components use — plain fetch/WebSocket, same origin.
 */
import { type ClusterResult, type ExecResult, type HostPayload, type ImportResult, type RemoteDirEntry, type SshHostSummary, type TestResult, type TransferProgress, type TunnelInfo } from '../protocol.ts';
/** Error carrying the route's JSON error message. */
export declare class SshApiError extends Error {
    constructor(message: string);
}
/** The location facts a terminal socket URL is built from. */
interface PageLocation {
    /** Page scheme with its colon (for example `https:` or `dsh-app:`). */
    protocol: string;
    /** Page authority, empty for a scheme that carries none. */
    host: string;
}
/**
 * The WebSocket URL the terminal route is reached at, or undefined when this
 * page cannot carry one.
 *
 * A web page resolves the socket against its own origin, exactly as before.
 *
 * A page delivered by an application on this machine (the official DSH Desktop
 * shell serves its Web GUI from `dsh-app://app/`) cannot carry a socket on its
 * own scheme: the protocol handler forwards HTTP to the local Host but has no
 * upgrade to forward. That is exactly the case the official transport hook
 * covers - the shell publishes `__DSH_TRANSPORT__.streamBaseUrl`, the loopback
 * authority of the Host it owns and already forwards every other request to
 * (issue #1744). The socket is therefore dialed there instead, with the `ws`/
 * `wss` scheme derived from that base, which is what the shell's
 * `onBeforeSendHeaders` hook expects to see before it attaches its
 * authority-bound credential.
 *
 * The base is used only on an application-delivered page. A web page that
 * somehow carries the hook (the remote channel grants `ownsHost` to a paired
 * LAN page, and that page is fenced behind a pairing channel) keeps resolving
 * against its own origin, so this cannot reroute gated traffic onto a host the
 * page is not entitled to reach. A blank authority is treated the same as an
 * application scheme with no base: there is nothing to dial, and the caller
 * gets the actionable reason instead of a socket that can only fail.
 *
 * @param location - the page location to read.
 * @param search - the query string carrying `alias` or `session`.
 * @param streamBaseUrl - `__DSH_TRANSPORT__.streamBaseUrl`, when the shell published one.
 * @returns the absolute `ws:`/`wss:` URL, or undefined when the page cannot carry one.
 */
export declare function terminalSocketUrl(location: PageLocation, search: string, streamBaseUrl?: string | undefined): string | undefined;
/** One open terminal connection (WebSocket JSON frames). */
export interface TerminalConnection {
    /** Fired on the ready frame (shell is up); carries the host session id and alias. */
    onReady: ((sessionId: string, alias: string) => void) | undefined;
    /** Fired on every output frame. */
    onOutput: ((data: string) => void) | undefined;
    /** Fired on the exit frame (or transport error). */
    onExit: ((code: number | null, error?: string) => void) | undefined;
    /** Fired when the server requests keyboard-interactive 2FA. */
    onAuthPrompt: ((name: string, instructions: string, prompts: Array<{
        prompt: string;
        echo: boolean;
    }>) => void) | undefined;
    /** Send raw input to the remote shell. */
    send(data: string): void;
    /** Resize the remote PTY. */
    resize(cols: number, rows: number): void;
    /** Send interactive 2FA response codes to the remote server. */
    sendAuthResponse(responses: string[]): void;
    /**
     * Leave the socket while the host keeps the remote shell alive, so a later
     * {@link SshApi.attachTerminal} picks the session up where it left off.
     * This is what a view does on unmount; it is not a disconnect.
     */
    detach(): void;
    /** Close the socket and end the remote session. */
    close(): void;
}
/** The browser half's only data entry point. */
export declare class SshApi {
    listHosts(queryText?: string): Promise<SshHostSummary[]>;
    createHost(payload: HostPayload): Promise<SshHostSummary>;
    updateHost(alias: string, patch: HostPayload): Promise<SshHostSummary>;
    deleteHost(alias: string): Promise<void>;
    importSshConfig(): Promise<ImportResult>;
    testHost(alias: string): Promise<TestResult>;
    exec(alias: string, command: string, timeoutMs?: number): Promise<ExecResult>;
    cluster(options: {
        command: string;
        aliases?: string[];
        environment?: string;
        tags?: string[];
        timeoutMs?: number;
        maxWorkers?: number;
    }): Promise<ClusterResult[]>;
    ls(alias: string, path: string): Promise<RemoteDirEntry[]>;
    listTunnels(): Promise<TunnelInfo[]>;
    startTunnel(options: {
        alias: string;
        remotePort: number;
        remoteHost?: string;
        localPort?: number;
    }): Promise<TunnelInfo>;
    stopTunnel(tunnelId: string): Promise<boolean>;
    stopAllTunnels(alias?: string): Promise<number>;
    /**
     * Upload one file (raw bytes) to a remote path. Progress arrives through
     * the NDJSON response stream; resolves when the result frame lands.
     */
    uploadFile(file: File, alias: string, remotePath: string, onProgress?: (progress: TransferProgress) => void): Promise<{
        transferredBytes: number;
    }>;
    /**
     * Download a remote file with client-side progress. Streams straight to
     * disk when the File System Access API is available (no full-file RAM
     * copy); otherwise falls back to an in-memory Blob.
     */
    downloadFile(alias: string, remotePath: string, onProgress?: (progress: TransferProgress) => void): Promise<{
        blob?: Blob;
        filename: string;
        streamed: boolean;
        bytes: number;
    }>;
    /**
     * Open a new host terminal session for the alias.
     * @param alias - the configured host alias.
     * @param cols - initial PTY width.
     * @param rows - initial PTY height.
     * @returns the live connection; its ready callback carries the session id
     *   {@link attachTerminal} uses after a view detach.
     */
    openTerminal(alias: string, cols: number, rows: number): TerminalConnection;
    /**
     * Reattach to a host-side session that outlived its view (a panel switch, a
     * page navigation). The host replays its scrollback before the ready frame.
     * @param sessionId - the id the previous connection reported on ready.
     * @param cols - the view's current width.
     * @param rows - the view's current height.
     */
    attachTerminal(sessionId: string, cols: number, rows: number): TerminalConnection;
    /** One terminal socket over either an alias (open) or a session id (attach). */
    private terminalSocket;
}
export {};
