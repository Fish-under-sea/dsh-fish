/**
 * Session storage file layer: legacy jsonl.zstd directory discovery, segment
 * matching, path-safety checks, size accounting, and session-rdb sqlite row
 * deletion. The physical-delete boundary — every path removal here is
 * validated to stay inside the sessions root and never follows symlinks out.
 * @module @fish-under-sea/dsh-session-archive-fish/host/session-files
 */
/**
 * Canonical session id for one segment dir name. DSH persistence keys the
 * segment off the session id: a `session-<uuid>` id lands as segment
 * `<uuid>` (and some layouts keep the prefix). One dir maps to exactly one
 * canonical id — the `session-`-prefixed form used everywhere else — so the
 * inventory never produces phantom duplicate rows.
 */
export declare function canonicalSessionId(segment: string): string;
export interface SessionDirIndex {
    /** session id (as used in the archive set) -> absolute dir path. */
    byId: Map<string, string>;
    /** Summed file sizes per session id, when the dir exists. */
    sizes: Map<string, number>;
    /** Segment dirs that could not be read at all. */
    unreadable: string[];
}
/** True when `child` is `root` itself or lies under it (realpath-ed, lexical). */
export declare function isInside(root: string, child: string): boolean;
/**
 * Scan the sessions root once and index every session dir. A session dir is
 * any directory under `<sessionsRoot>/<project>/` (the project key dirs are
 * the cwd-encoded ones). Symlinks are never followed into the index: a link
 * under the sessions root pointing outside is recorded as unreadable instead.
 */
export declare function indexSessionDirs(sessionsRoot: string): SessionDirIndex;
/**
 * Resolve one session's storage dir against an index. Returns undefined when
 * the session has no legacy directory (rdb-stored or foreign).
 */
export declare function findSessionDir(index: SessionDirIndex, id: string): string | undefined;
/** The session-rdb sqlite locations DSH/dsh-perf use, most likely first. */
export declare function rdbDbPaths(dshHome: string): string[];
/** The session-rdb fingerprint: application_id + user_version (dsh-perf contract). */
export declare function isSessionRdb(dbPath: string): boolean;
/**
 * Delete one session's rows from a session-rdb store. FK cascades remove the
 * event tables; returns true when a row was deleted, false when the session
 * was absent. Throws on storage errors (the caller converts to a failure).
 */
export declare function deleteRdbSession(dbPath: string, id: string): boolean;
/**
 * Physically remove one session directory. The dir must already be resolved
 * from the index (which never follows escaping symlinks); this re-validates
 * the realpath against the sessions root before the recursive removal, so no
 * caller-supplied path can delete anything outside session storage.
 */
export declare function removeSessionDir(dirPath: string, sessionsRoot: string): void;
