/**
 * Connection pool: per-alias persistent ssh2 connections with multi-hop jump
 * support, the acquire / dispose / sweep lifecycle, and the pooled exec path.
 */
import { Client, type ConnectConfig } from 'ssh2';
import type { ExecResult, SshHostEntry } from '../protocol.ts';
import { type HostStore } from '../store.ts';
/** Default engine knobs. */
export interface EngineOptions {
    /** Connections idle longer than this are closed (ms). */
    idleTimeoutMs?: number;
    /**
     * Ceiling for the whole pre-ready sequence (ms): TCP connect, SSH key
     * exchange and user authentication. Passed to ssh2's `readyTimeout`.
     */
    connectTimeoutMs?: number;
    /** Keepalive ping interval (ms). */
    keepaliveIntervalMs?: number;
    /** Cap on captured stdout/stderr bytes per exec (ms). */
    maxOutputBytes?: number;
    /** Default exec timeout (ms). */
    defaultExecTimeoutMs?: number;
    /** Default cluster concurrency. */
    defaultMaxWorkers?: number;
    /** SFTP concurrent channel count for transfers. */
    sftpConcurrency?: number;
}
/**
 * Default ceiling for TCP connect, SSH key exchange and user authentication
 * together (ms). Password authentication behind PAM / LDAP can outlast the
 * previous 15 s ceiling while the server still eventually accepts it.
 */
export declare const DEFAULT_CONNECT_TIMEOUT_MS = 30000;
/** Default engine knobs (applied when an option is omitted). */
export declare const DEFAULTS: Required<EngineOptions>;
/** One pooled connection record. */
export interface PoolRecord {
    client: Client;
    /** Jump-chain clients kept alive under the target. */
    hops: Client[];
    idleAt: number;
    /** Pinned connections (tunnels) are never swept. */
    pinned: boolean;
    broken: boolean;
    /** Operations currently running on this connection (sweep guard). */
    inFlight: number;
}
/**
 * The slice of the engine the pool and exec paths need. The host class
 * (engine.ts facade) satisfies this structurally.
 */
export interface PoolEngine {
    readonly store: HostStore;
    readonly opts: Required<EngineOptions>;
    readonly pool: Map<string, PoolRecord>;
    readonly acquireQueue: Map<string, Promise<PoolRecord>>;
}
/** Build the ssh2 connect config for one entry (key read from disk). */
export declare function buildConnectConfig(entry: SshHostEntry, sock: ConnectConfig['sock'] | undefined, opts: Required<EngineOptions>): ConnectConfig;
/**
 * The default ssh-agent endpoint on Windows: the named pipe the native
 * OpenSSH ssh-agent service listens on. ssh2 connects to a named pipe for any
 * path matching its Windows pipe form, so the default is a real endpoint
 * rather than a protocol name (#1910). PuTTY Pageant is still reachable — it
 * is what the literal `pageant` agent path selects — but it is no longer the
 * assumption.
 */
export declare const WINDOWS_AGENT_PIPE = "\\\\.\\pipe\\openssh-ssh-agent";
/** Resolve the ssh2 agent path for 'agent' auth. */
export declare function resolveAgentPath(agentPath?: string): string | undefined;
/**
 * Resolve the ssh-agent endpoint that forwarding brokers signatures through:
 * an explicitly configured agent path wins, then SSH_AUTH_SOCK, then the
 * native OpenSSH named pipe on Windows. Undefined means no endpoint exists on
 * this machine.
 *
 * Forwarding shares the auth resolution on purpose — the endpoint a host
 * signs through is the same one it authenticates with — but it is a separate
 * name so the forwarding path can evolve without touching auth.
 */
export declare function resolveForwardAgentPath(agentPath?: string): string | undefined;
/** Keyboard-interactive handler callback for 2FA / dynamic prompt flow. */
export type KeyboardInteractiveHandler = (name: string, instructions: string, instructionsLang: string, prompts: Array<{
    prompt: string;
    echo: boolean;
}>, finish: (responses: string[]) => void) => void;
/**
 * Name the phase that actually stalled. ssh2 reports every pre-ready timeout
 * as "Timed out while waiting for handshake", including one that expires
 * during user authentication after a completed key exchange.
 *
 * @param timeoutMs - the configured `readyTimeout` (0 disables it).
 * @param handshakeComplete - whether ssh2 completed the key exchange.
 * @returns the operator-facing timeout message.
 */
export declare function readyTimeoutMessage(timeoutMs: number | undefined, handshakeComplete: boolean): string;
/**
 * Whether ssh2 ended the attempt with its pre-ready timeout. The level is the
 * stable discriminator; the message is reused for connect, key exchange and
 * authentication alike.
 */
export declare function isReadyTimeout(error: Error): boolean;
/** Connect one ssh2 client (resolve on ready, reject on error/close). */
export declare function connectClient(config: ConnectConfig, onKeyboardInteractive?: KeyboardInteractiveHandler): Promise<Client>;
/** Cap captured output at the configured byte budget (marks truncation). */
export declare function appendOutput(target: {
    text: string;
    truncated: boolean;
}, chunk: Buffer, maxBytes: number): void;
/**
 * Parse an OpenSSH jump hop written as an address: `[user@]host[:port]`
 * (an IPv6 literal must be bracketed). Returns undefined when the value is not
 * an address at all.
 */
export declare function parseJumpSpec(spec: string): {
    host: string;
    port?: number;
    user?: string;
} | undefined;
/**
 * Resolve one ProxyJump spec: an alias configured in this plugin wins, and any
 * other value is read as an OpenSSH address whose credentials come from the
 * target entry (an ad-hoc hop has no stored auth of its own).
 *
 * An address hop deliberately carries no forwardAgent flag: OpenSSH's
 * ForwardAgent is a per-Host setting and an ad-hoc address was never
 * configured, so it must never inherit the target's opt-in. A hop written as
 * an alias uses that alias's own entry, which is how a user forwards on a
 * bastion on purpose.
 */
export declare function resolveHop(engine: PoolEngine, entry: SshHostEntry, spec: string): SshHostEntry;
/**
 * Build one full jump chain for an entry: hop clients connected through in
 * order, each forwarding a stream to the next destination, ending with the
 * target client. Shared by the pool and standalone shell sessions.
 *
 * A ProxyCommand is the transport that reaches its own host, so the entry's
 * own command seeds the chain when there is no jump chain, and the first hop's
 * command is used when the hop carries one.
 */
export declare function connectChain(engine: PoolEngine, entry: SshHostEntry, onKeyboardInteractive?: KeyboardInteractiveHandler): Promise<{
    client: Client;
    hops: Client[];
}>;
/** Connect (or reuse) the pooled chain for one alias; pins nothing. */
export declare function acquire(engine: PoolEngine, alias: string): Promise<PoolRecord>;
/**
 * Tear down one alias's record. When `record` is given and no longer the
 * pooled record for the alias (a concurrent acquire replaced it), nothing
 * is torn down — the connection belongs to someone else now.
 */
export declare function disposeRecord(engine: PoolEngine, alias: string, record?: PoolRecord): void;
/** End one record's client and hop chain (best-effort, safe to repeat). */
export declare function endRecordChain(record: PoolRecord): void;
/** Close connections idle beyond the threshold (skips pinned and in-flight). */
export declare function sweepPool(engine: PoolEngine): void;
/**
 * Run `fn` with a live client for `alias`, reconnecting (up to the
 * attempt budget) when the connection broke mid-flight.
 */
export declare function withClient<T>(engine: PoolEngine, alias: string, fn: (client: Client) => Promise<T>, attempts?: number, signal?: AbortSignal): Promise<T>;
/** Run one command on `alias` (reusing the pooled connection). */
export declare function execCommand(engine: PoolEngine, alias: string, command: string, timeoutMs?: number, signal?: AbortSignal): Promise<ExecResult>;
