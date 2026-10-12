/**
 * PTY shell sessions for the web terminal: a standalone (non-pooled)
 * ssh2 connection with a long-lived shell channel, resize, and pausable
 * output delivery.
 */
import { type KeyboardInteractiveHandler, type PoolEngine } from './connection-pool.ts';
/** A live PTY shell session. */
export interface ShellSession {
    /** Assign to receive remote output. */
    onData?: (data: Buffer) => void;
    /** Assign to be notified when the channel closes. */
    onExit?: (code: number | null, error?: string) => void;
    /** Write raw input to the shell. */
    send(data: string): void;
    /** Resize the remote PTY. */
    resize(cols: number, rows: number): void;
    /** Close the session and its channel. */
    close(): void;
    /** Pause remote output delivery (transport backpressure). */
    pause(): void;
    /** Resume remote output delivery. */
    resume(): void;
}
/**
 * Open a PTY shell session for the web terminal (standalone connection).
 * The shell is a long-lived exclusive stream: it uses its own connection so
 * closing it can never tear down a pooled exec/tunnel sharing the alias.
 */
export declare function openShell(engine: PoolEngine, alias: string, size: {
    cols: number;
    rows: number;
}, onKeyboardInteractive?: KeyboardInteractiveHandler): Promise<ShellSession>;
