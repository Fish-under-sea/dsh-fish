import type { IncomingMessage } from 'node:http';
import type { FileAttachmentRef, ImageAttachmentRef, ImageMediaType, StoredImageAttachment } from '@deepseek-ai/dsh-attachment/types';
import { type TaskAttachment, type TaskAttachmentKind } from '../core/attachment.ts';
/**
 * The official attachment storage, narrowed to the members the board uses.
 *
 * The board declares the face structurally (like the other optional services
 * it resolves) so the Host half needs no value import of the SDK package: the
 * deployment's own attachment service provides it, and a deployment without
 * one simply refuses attachment work.
 */
export interface TaskBoardAttachmentStore {
    /** Deployment-resolved image policy. */
    readonly imageLimits: {
        maxImageBytes: number;
        maxImagesPerMessage: number;
        maxMessageImageBytes: number;
        maxImagePixels: number;
        maxImageDimension: number;
        mediaTypes: readonly string[];
    };
    /** Validate one image without persisting it. */
    validateImage(input: {
        data: Uint8Array;
        mediaType: string;
        name?: string;
    }): Promise<void>;
    /** Validate and durably commit one image. */
    saveImage(input: {
        data: Uint8Array;
        mediaType: string;
        name?: string;
    }): Promise<ImageAttachmentRef>;
    /** Read one image and verify that the bytes still match the reference. */
    readImage(ref: ImageAttachmentRef, signal?: AbortSignal): Promise<StoredImageAttachment>;
    /** Durably commit one file byte-for-byte from bounded chunks. */
    saveFileStream(input: {
        data: AsyncIterable<Uint8Array>;
        signal?: AbortSignal;
        name?: string;
    }): Promise<FileAttachmentRef>;
    /** Read and verify one verbatim stored file as bounded chunks. */
    readFileStream(ref: FileAttachmentRef, signal?: AbortSignal): AsyncIterable<Uint8Array>;
    /** Locate the verbatim stored file object in the Host filesystem. */
    fileHostPath(ref: FileAttachmentRef): string | undefined;
}
/** The stable failure classes the attachment routes answer with. */
export type TaskBoardAttachmentErrorCode = 'invalid-request' | 'unsupported-type' | 'too-large' | 'invalid-image' | 'storage-unavailable' | 'not-found' | 'unreadable';
/**
 * One attachment failure, carrying the class the route maps to a status and a
 * message that never contains raw bytes or a host path.
 */
export declare class TaskBoardAttachmentError extends Error {
    readonly code: TaskBoardAttachmentErrorCode;
    constructor(code: TaskBoardAttachmentErrorCode, message: string, options?: ErrorOptions);
}
/** The HTTP status one attachment failure class answers with. */
export declare function attachmentErrorStatus(code: TaskBoardAttachmentErrorCode): number;
/** Lowercase hex sha256 digest of the exact bytes. */
export declare function sha256Hex(bytes: Uint8Array): string;
/** Whether a value names one of the raster media types the image path accepts. */
export declare function isImageMediaType(value: unknown): value is ImageMediaType;
/**
 * Normalize a client-declared file media type: a well-formed type is kept
 * (lowercased), anything else falls back to the opaque binary type. The type
 * of a verbatim file is a declaration, not something the storage can prove.
 */
export declare function normalizeFileMediaType(value: unknown): string;
/**
 * The canonical display name of an upload.
 *
 * The Host publishes the canonical name, and the ledger stores the same
 * string: the wire gate accepts only a name that already IS canonical, so a
 * client cannot rename an object into something the storage never saw. The
 * canonical form is single-line and free of any path part, which is what
 * makes it safe to place in an execution prompt.
 */
export declare function sanitizeAttachmentName(value: unknown): string;
/**
 * The per-image byte cap this deployment enforces: the board's own ceiling
 * lowered by the storage's own policy when that policy is stricter.
 */
export declare function effectiveImageByteLimit(store: TaskBoardAttachmentStore | undefined): number;
/**
 * Read a whole request body, refusing it the moment it grows past the cap.
 * The count is the ACTUAL byte length of the stream, not a declared length.
 */
export declare function readRequestBytes(req: IncomingMessage, limit: number): Promise<Uint8Array>;
/**
 * A byte stream that measures and digests what it yields.
 *
 * The file path streams the request straight into the official storage: the
 * bytes are never collected in memory, and the count and digest the board
 * records are the ones computed from the bytes that actually went in.
 */
export declare class MeasuredStream {
    private readonly limit;
    private readonly hash;
    private size;
    private finished;
    constructor(limit: number);
    /** The byte length seen so far. */
    get bytes(): number;
    /** The digest of the bytes seen so far; final once the stream ended. */
    digest(): string;
    /** Whether the whole stream was consumed. */
    get complete(): boolean;
    /** The chunks, refusing the stream the moment it grows past the cap. */
    chunks(source: AsyncIterable<Uint8Array>): AsyncGenerator<Uint8Array>;
}
/**
 * The request body as a byte stream: the file path hands it straight to the
 * official storage, so the bytes are never collected in memory.
 */
export declare function requestChunks(req: IncomingMessage): AsyncIterable<Uint8Array>;
/**
 * The image reference a recorded attachment stands for. The stored object is
 * addressed by its opaque identifier; the rest of the fields are the board's
 * own record of what the storage holds.
 */
export declare function imageRefOf(attachment: TaskAttachment): ImageAttachmentRef;
/** The file reference a recorded attachment stands for. */
export declare function fileRefOf(attachment: TaskAttachment): FileAttachmentRef;
/**
 * Publish one image into the official storage and describe it with
 * host-computed metadata.
 *
 * The image is validated before it is stored (the storage checks the decoded
 * bytes against the declared type), and the recorded digest is computed over
 * the NORMALIZED bytes the storage actually kept — not over what the client
 * sent — so the metadata and the object can never disagree.
 */
export declare function storeImage(store: TaskBoardAttachmentStore, data: Uint8Array, name: string, mediaType: string): Promise<TaskAttachment>;
/**
 * Publish one file into the official storage and describe it with
 * host-computed metadata. The digest is computed from the streamed bytes, so
 * the record and the stored object agree by construction.
 */
export declare function storeFile(store: TaskBoardAttachmentStore, chunks: AsyncIterable<Uint8Array>, name: string, mediaType: string, signal?: AbortSignal): Promise<{
    attachment: TaskAttachment;
    bytes: number;
    sha256: string;
}>;
/**
 * Map an official attachment failure onto the board's own classes, so a
 * storage fault reads as "the storage is unavailable" and a rejected image
 * reads as "the image is not acceptable" — never as an internal error.
 */
export declare function asAttachmentError(error: unknown): TaskBoardAttachmentError;
/**
 * Prove every recorded attachment against the official storage: an image is
 * read back and compared, a file is streamed and its digest recomputed.
 *
 * A reference the storage does not know, and a record whose metadata does not
 * match the stored bytes, are both a refusal: the action never reaches the
 * ledger, so a spoofed client claim can never become a stored fact.
 */
export declare function verifyAttachments(store: TaskBoardAttachmentStore, attachments: readonly TaskAttachment[]): Promise<void>;
/**
 * The official image batch limits of a deployment: how many images one
 * message may carry and how many bytes they may add up to.
 *
 * The board's own caps (eight attachments, 10 MiB each, 32 MiB per card) stay
 * in force; the deployment's policy can only lower them, and it governs the
 * IMAGES of one card because that is what one prompt carries.
 */
export declare function officialImageBatchLimits(store: TaskBoardAttachmentStore | undefined): {
    maxImages: number;
    maxImageBytes: number;
    maxMessageImageBytes: number;
};
/**
 * Refuse a card whose images exceed the deployment's per-message budget.
 *
 * The check counts only the images: plain files travel as paths and never
 * enter the prompt admission, so they are not part of that budget.
 * @param store - the official attachment storage.
 * @param attachments - the card's attachments.
 */
export declare function assertImageBatchWithinLimits(store: TaskBoardAttachmentStore | undefined, attachments: readonly TaskAttachment[]): void;
/** Read one image back and compare it with the recorded metadata. */
export declare function verifyImage(store: TaskBoardAttachmentStore, attachment: TaskAttachment): Promise<void>;
/** Stream one file back and recompute its digest. */
export declare function verifyFile(store: TaskBoardAttachmentStore, attachment: TaskAttachment): Promise<void>;
/**
 * The limits the board publishes for its attachments: the board's own caps,
 * lowered by the deployment's image policy where that policy is stricter.
 */
export declare function publishedAttachmentLimits(store: TaskBoardAttachmentStore | undefined): {
    maxAttachments: number;
    maxBytes: number;
    maxTotalBytes: number;
    maxImages: number;
    maxImageBytes: number;
    maxMessageImageBytes: number;
};
/** One image resolved for an execution prompt. */
export interface ExecutionImagePart {
    type: 'image';
    mediaType: string;
    data: string;
    name?: string;
}
/** One file resolved for an execution prompt: its readable host path. */
export interface ExecutionFilePart {
    name: string;
    path: string;
    bytes: number;
    mediaType: string;
}
/** The attachments of a card, resolved for one execution. */
export interface ResolvedAttachments {
    /** The images, in the order the card lists them. */
    images: ExecutionImagePart[];
    /** The files, in the order the card lists them. */
    files: ExecutionFilePart[];
}
/**
 * Resolve a card's attachments for one execution: images become prompt image
 * parts, files become readable host paths.
 *
 * Every execution resolves the attachments afresh — the recorded metadata is
 * never trusted on its own, and a file whose host path is missing or
 * unreadable fails the run instead of being silently dropped.
 */
export declare function resolveExecutionAttachments(store: TaskBoardAttachmentStore, attachments: readonly TaskAttachment[]): Promise<ResolvedAttachments>;
/**
 * The attachment section of an execution prompt: the readable paths of the
 * card's files, marked read-only.
 *
 * It is a section of its own — never folded into the handover preamble — so
 * the two kinds of reference stay distinguishable to the reading agent.
 */
export declare function attachmentPromptPreamble(files: readonly ExecutionFilePart[]): string | undefined;
/** The model-info reader the image preflight uses. */
export type ModelInfoResolver = (provider: string, model: string, signal?: AbortSignal) => Promise<{
    inputModalities?: readonly string[];
} | undefined>;
/**
 * Refuse an execution whose route cannot read images.
 *
 * The check uses the ACTUAL route of the session the run is about to use and
 * the model's own declared input modalities. A route that declares no
 * modalities is UNKNOWN, and an unknown route is allowed: the official model
 * catalog publishes no modality information, so it cannot answer this
 * question, and refusing on its silence would block every image run.
 */
export declare function assertRouteAcceptsImages(resolveModelInfo: ModelInfoResolver | undefined, provider: string, model: string): Promise<void>;
/** The attachment kinds a card may carry, for the wire gates. */
export declare const ATTACHMENT_KINDS: readonly TaskAttachmentKind[];
