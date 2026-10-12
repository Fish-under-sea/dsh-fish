import { WebSocket } from 'ws';
import type { KeyboardInteractiveHandler } from './connection-pool.ts';
import type { ShellSession } from './pty.ts';
/** What the registry needs from the engine (swappable in tests). */
export interface TerminalSessionDeps {
    /** Open one PTY shell for the alias (engine.openShell). */
    openShell(alias: string, size: {
        cols: number;
        rows: number;
    }, onKeyboardInteractive?: KeyboardInteractiveHandler): Promise<ShellSession>;
    /** @returns the current time (defaults to Date.now). */
    now?: () => number;
    /** Bounded scrollback per session. */
    maxBufferBytes?: number;
    /** Idle window before a detached session is reaped. */
    idleMs?: number;
    /** Grace window an exited session is kept for reattaching views. */
    exitGraceMs?: number;
}
/**
 * The host's terminal session table: open one session per connect, attach any
 * number of sockets, and keep the shell alive across detach.
 */
export declare class TerminalSessionRegistry {
    private readonly sessions;
    private readonly deps;
    private readonly maxBufferBytes;
    private readonly idleMs;
    private readonly exitGraceMs;
    constructor(deps: TerminalSessionDeps);
    /** Open a new session for the alias and attach the requesting socket to it. */
    open(ws: WebSocket, alias: string, size: {
        cols: number;
        rows: number;
    }): Promise<void>;
    /**
     * Attach a socket to an existing session, replaying its scrollback first.
     * @returns false when the session is unknown (expired or already reaped).
     */
    attach(ws: WebSocket, sessionId: string, size: {
        cols: number;
        rows: number;
    }): boolean;
    /** End every session (host teardown, plugin dispose). */
    dispose(): void;
    /** Number of live sessions (introspection for tests and diagnostics). */
    size(): number;
    /** Wire one socket's frames and lifecycle onto a session. */
    private bind;
    /** Remove a socket from its session, keeping the shell alive. */
    private detach;
    /** End the session a socket is attached to (explicit close from the view). */
    private end;
    /** Mark a session exited and keep it briefly so a reattaching view sees it. */
    private finish;
    /** Append output to the replay buffer, trimmed to the byte cap. */
    private pushOutput;
    /** Broadcast one frame to every attached socket, honoring backpressure. */
    private send;
    private sendTo;
    /** Pause while any attached socket is backed up; resume once all drained. */
    private applyBackpressure;
    /** Answer a keyboard-interactive challenge through whoever is attached. */
    private keyboardInteractive;
    private scheduleReap;
    private clearReap;
}
