import { type TaskAttachment, type TaskAttachmentKind } from '../../core/attachment.ts';
/** One file the user staged locally; it is uploaded when the card is saved. */
export interface StagedAttachment {
    /** Stable id of the staged row (a monotonic counter, never a clock reading). */
    id: string;
    /** The picked file. */
    file: File;
    /** Whether the file is uploaded as an image or as a verbatim file. */
    kind: TaskAttachmentKind;
    /** Display name of the file. */
    name: string;
    /** Byte length of the file. */
    bytes: number;
    /** Declared media type of the file. */
    mediaType: string;
    /** Local object URL of the preview; images only. */
    previewUrl?: string;
    /** True while the file is being uploaded. */
    pending?: boolean;
    /** Why the upload failed, when it did. */
    error?: string;
}
/** What the card will carry once the form is saved. */
export interface AttachmentSelection {
    /** The attachments already stored on the card and kept by the user. */
    persisted: TaskAttachment[];
    /** The files staged locally and uploaded on save. */
    staged: StagedAttachment[];
}
/** The limits the deployment publishes for attachments. */
export interface AttachmentLimits {
    maxAttachments: number;
    maxBytes: number;
    maxTotalBytes: number;
    /** Maximum number of IMAGES one card may carry (the official per-message budget). */
    maxImages: number;
    /** Maximum byte length of one image. */
    maxImageBytes: number;
    /** Maximum byte length of all images of one card together. */
    maxMessageImageBytes: number;
}
/** The board's own limits, used when the deployment publishes none. */
export declare const DEFAULT_ATTACHMENT_LIMITS: AttachmentLimits;
/** A human-readable byte size. */
export declare function formatAttachmentBytes(bytes: number): string;
/**
 * Whether a picked file is uploaded as an image.
 *
 * Only the raster types the official image path accepts are images; every
 * other file is stored verbatim.
 */
export declare function attachmentKindOf(file: File): TaskAttachmentKind;
/**
 * The attachment field of a card form.
 *
 * The component owns the local staging only: the selection it reports is what
 * the card will carry, and the parent uploads the staged files on save.
 */
export declare function AttachmentField({ selection, onChange, limits, disabled, onError, }: {
    /** What the card currently carries and what is staged on top of it. */
    selection: AttachmentSelection;
    /** Receives the new selection after every change. */
    onChange: (selection: AttachmentSelection) => void;
    /** The deployment limits; the board's own limits are used when absent. */
    limits?: AttachmentLimits;
    /** Whether the field refuses new input. */
    disabled?: boolean;
    /** Receives the reason a selection was refused. */
    onError?: (message: string) => void;
}): import("react").JSX.Element;
