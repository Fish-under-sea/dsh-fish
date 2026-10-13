/**
 * Minimal `~/.ssh/config` reader for the one-shot host import: Host blocks with
 * `Include` expansion and explicit skip reasons. Values stay raw strings; the
 * store maps them onto a HostPayload.
 *
 * Deliberate simplifications (documented in the package README):
 *   - `Match` blocks are skipped — their options are conditional and must never
 *     merge into the Host block above them.
 *   - A multi-pattern `Host a b` line only exposes its first pattern.
 *   - Include pathnames accept `~`, globs, and several whitespace-separated
 *     pathnames, but not environment variables, `%` tokens, or quoting.
 *   - Relative Include pathnames resolve against the directory of the config
 *     file the import started from (OpenSSH: `~/.ssh` for a user config).
 *   - A file that already contributed lines is never read twice, which doubles
 *     as the Include cycle guard.
 */
import type { ImportSkipBlock } from './protocol.ts';
/** One parsed Host block. */
export interface SshBlock {
    /** Raw Host line value (may hold several whitespace-separated patterns). */
    pattern: string;
    /** Lowercased option key/value pairs; the last occurrence of a key wins. */
    props: Record<string, string>;
}
/** One config file read, with every Include expanded in place. */
export interface SshConfigRead {
    blocks: SshBlock[];
    skipped: ImportSkipBlock[];
}
/**
 * Parse one ssh_config file (Include expanded) into Host blocks plus the
 * `Match` blocks that were deliberately skipped.
 */
export declare function readSshConfigBlocks(configPath: string): SshConfigRead;
