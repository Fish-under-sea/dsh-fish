/**
 * Freeze-request parser and security gate: parses the system-prompt-agreed
 * freeze format into a structured context snapshot (goal / progress / next),
 * redacts sensitive patterns to markers, rejects slash-prefixed DSH command
 * lines, and enforces the 8 KiB per-field byte limit.
 * Pure functions only: no session, network, or filesystem access.
 */
/** Hard per-field limit: 8 KiB measured in UTF-8 bytes. */
export declare const FREEZE_FIELD_BYTE_LIMIT: number;
/** Marker replacing every sensitive match. */
export declare const REDACTED_MARKER = "[REDACTED]";
/** Structured context snapshot carried by a continuation card. */
export interface FreezeSnapshot {
    goal: string;
    progress: string;
    next: string;
}
/** Non-fatal notices produced by the security gate. */
export type FreezeWarning = 'redacted';
export type FreezeResult = {
    ok: true;
    snapshot: FreezeSnapshot;
    warnings: FreezeWarning[];
} | {
    ok: false;
    error: {
        code: string;
        message: string;
    };
};
/** Redact sensitive patterns to the marker; reports whether any hit occurred. */
export declare function redactSensitive(text: string): {
    text: string;
    redacted: boolean;
};
/**
 * True when any line of the text starts with "/" (a DSH command line).
 * Leading horizontal whitespace before the slash counts too: a frozen
 * body line like `  /kill` is still a command, not prose.
 */
export declare function hasSlashCommandLines(text: string): boolean;
/**
 * Sanitize a structured freeze snapshot (the create/update action payload):
 * shape check, slash-command taint rejection, sensitive redaction, and the
 * per-field byte cap - the same gate parseFreezeRequest applies to
 * free-text freeze requests, exposed for the action data plane (issue #4).
 * @param value - the freeze object carried by an action or read back from disk.
 * @param extraKeys - keys allowed alongside goal/progress/next (e.g. the
 *   protocol redacted flag, the ledger frozenAt stamp) and preserved verbatim
 *   when present; their validation stays with the caller.
 */
export declare function sanitizeFreezeSnapshot(value: unknown, extraKeys?: readonly string[]): {
    ok: true;
    snapshot: FreezeSnapshot;
    redacted: boolean;
    extras: Record<string, unknown>;
} | {
    ok: false;
    error: {
        code: string;
        message: string;
    };
};
/**
 * Parse the freeze-request format: a <<<FREEZE ... >>>FREEZE block whose body
 * is 目标: / 进度: / 下一步: section headers, each followed by body lines.
 * The gate applies before returning: slash-command taint rejects the whole
 * request, sensitive patterns are redacted to markers, and each field is
 * capped at FREEZE_FIELD_BYTE_LIMIT UTF-8 bytes.
 */
export declare function parseFreezeRequest(input: string): FreezeResult;
