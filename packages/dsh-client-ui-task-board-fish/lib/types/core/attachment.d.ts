/**
 * Card attachments: the durable metadata a card keeps about the files and
 * images it carries.
 *
 * The ledger stores METADATA only — never bytes, never base64, never a data
 * URL, never an upload timestamp. The bytes live in the official attachment
 * storage; this record says WHICH object, how large it is, and what it is, so
 * an execution can resolve the object and the Host can prove the recorded
 * claim against the storage before the claim reaches the ledger.
 *
 * The module is pure (no cordis, no runtime imports) so both halves — the Host
 * ledger and the browser form — share one vocabulary and one set of limits.
 */
/** What one attachment holds: a raster image or an arbitrary file. */
export type TaskAttachmentKind = 'image' | 'file';
/**
 * One attachment of a card: identity, size and type, plus the digest of the
 * exact bytes the Host stored.
 *
 * An image carries its intrinsic pixel size; a file carries neither. The
 * display name is always the CANONICAL form (see
 * {@link canonicalAttachmentName}): single-line, without any path part, so a
 * name can never break the prompt an execution reads.
 */
export interface TaskAttachment {
    /** Whether the object is a raster image or an arbitrary file. */
    kind: TaskAttachmentKind;
    /** Opaque storage identifier of the stored object; never a path or a URL. */
    attachmentId: string;
    /** Canonical display name; never a local path, never multi-line. */
    name: string;
    /** Exact stored byte length. */
    bytes: number;
    /** Media type of the stored bytes. */
    mediaType: string;
    /** Lowercase hex sha256 digest of the exact stored bytes. */
    sha256: string;
    /** Intrinsic pixel width; images only, always positive. */
    width?: number;
    /** Intrinsic pixel height; images only, always positive. */
    height?: number;
}
/** Maximum number of attachments one card may carry. */
export declare const TASK_ATTACHMENT_LIMIT = 8;
/** Maximum byte length of one attachment (10 MiB). */
export declare const TASK_ATTACHMENT_MAX_BYTES: number;
/** Maximum byte length of all attachments of one card together (32 MiB). */
export declare const TASK_ATTACHMENT_TOTAL_MAX_BYTES: number;
/** Raster media types the official image path accepts. */
export declare const TASK_ATTACHMENT_IMAGE_MEDIA_TYPES: readonly ["image/png", "image/jpeg", "image/webp", "image/gif"];
/**
 * The canonical display name of an attachment.
 *
 * A name reaches the ledger from two directions: the browser picks it, and an
 * execution prompt reads it. Both make one form mandatory — the name must be
 * a single line without any path part, so it can neither break out of the
 * prompt line nor point at a directory.
 *
 * The canonical form is therefore: the LEAF of whatever path-like text was
 * offered, every control character (a newline included) turned into a space,
 * whitespace runs collapsed into one space, the result trimmed and bounded.
 * An empty result becomes a fixed placeholder.
 *
 * The Host upload path canonicalizes the name BEFORE publishing it, and the
 * wire gate accepts only a name that already IS canonical — so the name the
 * ledger holds and the name the storage holds are the same string.
 * @param value - the offered name.
 * @returns the canonical name.
 */
export declare function canonicalAttachmentName(value: unknown): string;
/**
 * Whether an unknown value is a well-formed attachment (the STRICT gate: the
 * wire path uses it, so a hand-written payload cannot smuggle an extra field
 * onto the ledger, a path-like name, or an image without its pixel size).
 * @param value - the candidate attachment.
 * @returns whether the value is a usable attachment.
 */
export declare function isTaskAttachment(value: unknown): value is TaskAttachment;
/**
 * Repair one persisted attachment entry: canonicalize its name and keep the
 * fields that are usable. An entry that cannot be repaired — an unknown kind,
 * a malformed identifier, an image without its pixel size — is dropped.
 * @param value - the persisted entry.
 * @returns the repaired attachment, or undefined when it cannot be repaired.
 */
export declare function repairAttachment(value: unknown): TaskAttachment | undefined;
/**
 * Whether a list satisfies the card-wide attachment limits: the count, the
 * per-item byte cap, and the total byte cap.
 * @param attachments - the candidate list.
 * @returns whether the list fits every limit.
 */
export declare function attachmentsWithinLimits(attachments: readonly TaskAttachment[]): boolean;
/**
 * Drop the repeated storage identifiers of a list, keeping the FIRST entry of
 * each identifier.
 *
 * The storage is content-addressed, so the same bytes uploaded twice produce
 * the same identifier. A list that carried the identifier twice would render
 * two rows for one object and claim it twice against the card's limits, so the
 * list is deduplicated at the boundary that can produce it.
 * @param attachments - the candidate list.
 * @returns the deduplicated list, in the original order.
 */
export declare function dedupeAttachments(attachments: readonly TaskAttachment[]): TaskAttachment[];
/**
 * Whether an unknown value is a well-formed attachment LIST (the strict wire
 * gate). The list must be non-empty: clearing attachments is expressed by
 * omitting the field (create) or by an explicit null (update), never by an
 * empty array. A list that repeats one storage identifier is refused: one
 * object cannot be claimed twice.
 * @param value - the candidate list.
 * @returns whether the list may reach the ledger.
 */
export declare function isTaskAttachmentList(value: unknown): value is TaskAttachment[];
/**
 * Repair a persisted attachment list: canonicalize the names, drop the
 * entries that cannot be repaired, deduplicate the storage identifiers, and
 * cap the count and the byte totals. Returns undefined when nothing usable
 * remains, so the caller clears the field instead of storing an empty list —
 * the same policy the tag and schedule repairs follow.
 * @param value - the persisted value.
 * @returns the repaired list, or undefined when nothing survives.
 */
export declare function normalizeAttachments(value: unknown): TaskAttachment[] | undefined;
/**
 * The attachment of a list whose storage identifier matches, or undefined.
 * @param attachments - the list to search.
 * @param attachmentId - the storage identifier to find.
 * @returns the matching attachment, or undefined.
 */
export declare function findAttachment(attachments: readonly TaskAttachment[] | undefined, attachmentId: string): TaskAttachment | undefined;
