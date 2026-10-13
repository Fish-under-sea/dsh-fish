/**
 * OpenSSH-compatible ProxyCommand transport: run the command with the user's
 * shell and expose its stdio as a Duplex that ssh2 accepts as `sock`.
 *
 * The command comes verbatim from the user's own 0600 store file and runs with
 * the DSH host process's privileges — the same trust the `ssh(1)` client gives
 * the identical line in `~/.ssh/config`.
 */
import { type ChildProcess } from 'node:child_process';
import { Duplex } from 'node:stream';
/** Token source for one host: the values %h / %p / %r / %n expand to. */
export interface ProxyTarget {
    host: string;
    port: number;
    user: string;
    /** The name the user addresses this host by (OpenSSH's %n). */
    alias: string;
}
/** Expand the OpenSSH ProxyCommand tokens; unknown %X sequences stay verbatim. */
export declare function expandProxyTokens(command: string, target: ProxyTarget): string;
/** One running proxy command: its transport plus the process behind it. */
export interface ProxyCommandProcess {
    /** The duplex transport handed to ssh2 as `sock`. */
    stream: Duplex;
    /** The spawned shell; killing the stream kills it (and its process group). */
    child: ChildProcess;
}
/**
 * Start one ProxyCommand and bridge its stdio into a Duplex.
 *
 * Failure modes are reported through the stream: a spawn error, or an exit
 * before the SSH handshake finished, destroys it with the exit status and the
 * tail of the command's stderr instead of letting ssh2 wait for its own
 * `readyTimeout`.
 */
export declare function startProxyCommand(rawCommand: string, target: ProxyTarget): ProxyCommandProcess;
