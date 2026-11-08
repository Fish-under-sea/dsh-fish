/**
 * Host-side attachment plumbing: the trusted upload path, the verification
 * against the official attachment storage, and the execution-time resolution
 * of a card's attachments into prompt parts.
 *
 * The board keeps METADATA in the ledger; the bytes live in the official
 * storage (`ctx.attachments`). This module is the only place that touches
 * both: it publishes bytes into the storage, proves a recorded claim against
 * it, and reads the objects back for an execution.
 *
 * The official storage has NO deletion API. Removing an attachment or deleting
 * a card therefore removes METADATA only: the stored object stays where it is.
 */
import { createHash } from 'node:crypto'
import { accessSync, constants as fsConstants } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import type {
  FileAttachmentRef,
  ImageAttachmentRef,
  ImageMediaType,
  StoredImageAttachment,
} from '@deepseek-ai/dsh-attachment/types'
import {
  canonicalAttachmentName,
  TASK_ATTACHMENT_IMAGE_MEDIA_TYPES,
  TASK_ATTACHMENT_LIMIT,
  TASK_ATTACHMENT_MAX_BYTES,
  TASK_ATTACHMENT_TOTAL_MAX_BYTES,
  type TaskAttachment,
  type TaskAttachmentKind,
} from '../core/attachment.ts'

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
    maxImageBytes: number
    maxImagesPerMessage: number
    maxMessageImageBytes: number
    maxImagePixels: number
    maxImageDimension: number
    mediaTypes: readonly string[]
  }
  /** Validate one image without persisting it. */
  validateImage(input: { data: Uint8Array; mediaType: string; name?: string }): Promise<void>
  /** Validate and durably commit one image. */
  saveImage(input: { data: Uint8Array; mediaType: string; name?: string }): Promise<ImageAttachmentRef>
  /** Read one image and verify that the bytes still match the reference. */
  readImage(ref: ImageAttachmentRef, signal?: AbortSignal): Promise<StoredImageAttachment>
  /** Durably commit one file byte-for-byte from bounded chunks. */
  saveFileStream(input: { data: AsyncIterable<Uint8Array>; signal?: AbortSignal; name?: string }): Promise<FileAttachmentRef>
  /** Read and verify one verbatim stored file as bounded chunks. */
  readFileStream(ref: FileAttachmentRef, signal?: AbortSignal): AsyncIterable<Uint8Array>
  /** Locate the verbatim stored file object in the Host filesystem. */
  fileHostPath(ref: FileAttachmentRef): string | undefined
}

/** The stable failure classes the attachment routes answer with. */
export type TaskBoardAttachmentErrorCode =
  | 'invalid-request'
  | 'unsupported-type'
  | 'too-large'
  | 'invalid-image'
  | 'storage-unavailable'
  | 'not-found'
  | 'unreadable'

/**
 * One attachment failure, carrying the class the route maps to a status and a
 * message that never contains raw bytes or a host path.
 */
export class TaskBoardAttachmentError extends Error {
  constructor(readonly code: TaskBoardAttachmentErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'TaskBoardAttachmentError'
  }
}

/** The HTTP status one attachment failure class answers with. */
export function attachmentErrorStatus(code: TaskBoardAttachmentErrorCode): number {
  if (code === 'invalid-request' || code === 'invalid-image' || code === 'unreadable') return 400
  if (code === 'unsupported-type') return 415
  if (code === 'too-large') return 413
  if (code === 'not-found') return 404
  return 503
}

/** Lowercase hex sha256 digest of the exact bytes. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Whether a value names one of the raster media types the image path accepts. */
export function isImageMediaType(value: unknown): value is ImageMediaType {
  return typeof value === 'string'
    && (TASK_ATTACHMENT_IMAGE_MEDIA_TYPES as readonly string[]).includes(value.toLowerCase())
}

/**
 * Normalize a client-declared file media type: a well-formed type is kept
 * (lowercased), anything else falls back to the opaque binary type. The type
 * of a verbatim file is a declaration, not something the storage can prove.
 */
export function normalizeFileMediaType(value: unknown): string {
  if (typeof value !== 'string') return 'application/octet-stream'
  const trimmed = value.trim().toLowerCase()
  if (trimmed === '' || trimmed.length > 255) return 'application/octet-stream'
  return /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(trimmed) ? trimmed : 'application/octet-stream'
}

/**
 * The canonical display name of an upload.
 *
 * The Host publishes the canonical name, and the ledger stores the same
 * string: the wire gate accepts only a name that already IS canonical, so a
 * client cannot rename an object into something the storage never saw. The
 * canonical form is single-line and free of any path part, which is what
 * makes it safe to place in an execution prompt.
 */
export function sanitizeAttachmentName(value: unknown): string {
  return canonicalAttachmentName(value)
}

/**
 * The per-image byte cap this deployment enforces: the board's own ceiling
 * lowered by the storage's own policy when that policy is stricter.
 */
export function effectiveImageByteLimit(store: TaskBoardAttachmentStore | undefined): number {
  const deployment = store?.imageLimits?.maxImageBytes
  if (typeof deployment !== 'number' || !Number.isFinite(deployment) || deployment <= 0) return TASK_ATTACHMENT_MAX_BYTES
  return Math.min(TASK_ATTACHMENT_MAX_BYTES, deployment)
}

/**
 * Read a whole request body, refusing it the moment it grows past the cap.
 * The count is the ACTUAL byte length of the stream, not a declared length.
 */
export async function readRequestBytes(req: IncomingMessage, limit: number): Promise<Uint8Array> {
  const chunks: Buffer[] = []
  let size = 0
  let overflow = false
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > limit) {
      // The rest of the body is drained rather than abandoned: the caller
      // still answers with a typed refusal, and the memory stays bounded.
      overflow = true
      chunks.length = 0
      continue
    }
    chunks.push(buffer)
  }
  if (overflow) throw new TaskBoardAttachmentError('too-large', `attachment exceeds the ${limit} byte limit`)
  return new Uint8Array(Buffer.concat(chunks))
}

/**
 * A byte stream that measures and digests what it yields.
 *
 * The file path streams the request straight into the official storage: the
 * bytes are never collected in memory, and the count and digest the board
 * records are the ones computed from the bytes that actually went in.
 */
export class MeasuredStream {
  private readonly hash = createHash('sha256')
  private size = 0
  private finished = false

  constructor(private readonly limit: number) {}

  /** The byte length seen so far. */
  get bytes(): number {
    return this.size
  }

  /** The digest of the bytes seen so far; final once the stream ended. */
  digest(): string {
    return this.hash.digest('hex')
  }

  /** Whether the whole stream was consumed. */
  get complete(): boolean {
    return this.finished
  }

  /** The chunks, refusing the stream the moment it grows past the cap. */
  async *chunks(source: AsyncIterable<Uint8Array>): AsyncGenerator<Uint8Array> {
    for await (const chunk of source) {
      this.size += chunk.byteLength
      if (this.size > this.limit) {
        throw new TaskBoardAttachmentError('too-large', `attachment exceeds the ${this.limit} byte limit`)
      }
      this.hash.update(chunk)
      yield chunk
    }
    this.finished = true
  }
}

/**
 * The request body as a byte stream: the file path hands it straight to the
 * official storage, so the bytes are never collected in memory.
 */
export function requestChunks(req: IncomingMessage): AsyncIterable<Uint8Array> {
  return req as unknown as AsyncIterable<Uint8Array>
}

/**
 * The image reference a recorded attachment stands for. The stored object is
 * addressed by its opaque identifier; the rest of the fields are the board's
 * own record of what the storage holds.
 */
export function imageRefOf(attachment: TaskAttachment): ImageAttachmentRef {
  // The stored object is addressed by its pixel size, so a record without one
  // cannot address it: the reference is refused rather than completed with a
  // manufactured 0x0.
  if (attachment.width === undefined || attachment.height === undefined) {
    throw new TaskBoardAttachmentError(
      'unreadable',
      `attachment ${attachment.attachmentId} carries no image dimensions`,
    )
  }
  return {
    attachmentId: attachment.attachmentId as ImageAttachmentRef['attachmentId'],
    mediaType: attachment.mediaType as ImageMediaType,
    bytes: attachment.bytes,
    width: attachment.width,
    height: attachment.height,
    ...(attachment.name === '' ? {} : { name: attachment.name }),
  }
}

/** The file reference a recorded attachment stands for. */
export function fileRefOf(attachment: TaskAttachment): FileAttachmentRef {
  return {
    attachmentId: attachment.attachmentId as FileAttachmentRef['attachmentId'],
    name: attachment.name,
    bytes: attachment.bytes,
  }
}

/**
 * Publish one image into the official storage and describe it with
 * host-computed metadata.
 *
 * The image is validated before it is stored (the storage checks the decoded
 * bytes against the declared type), and the recorded digest is computed over
 * the NORMALIZED bytes the storage actually kept — not over what the client
 * sent — so the metadata and the object can never disagree.
 */
export async function storeImage(
  store: TaskBoardAttachmentStore,
  data: Uint8Array,
  name: string,
  mediaType: string,
): Promise<TaskAttachment> {
  if (!isImageMediaType(mediaType)) {
    throw new TaskBoardAttachmentError('unsupported-type', `${mediaType} is not an accepted image type`)
  }
  const limit = effectiveImageByteLimit(store)
  if (data.byteLength > limit) {
    throw new TaskBoardAttachmentError('too-large', `image exceeds the ${limit} byte limit`)
  }
  const type = mediaType.toLowerCase() as ImageMediaType
  try {
    await store.validateImage({ data, mediaType: type, name })
    const ref = await store.saveImage({ data, mediaType: type, name })
    const stored = await store.readImage(ref)
    // The stored name is the storage's own: the ledger records it verbatim
    // after canonicalization, so the two can never disagree.
    return {
      kind: 'image',
      attachmentId: String(ref.attachmentId),
      name: canonicalAttachmentName(stored.ref.name ?? name),
      bytes: stored.ref.bytes,
      mediaType: stored.ref.mediaType,
      sha256: sha256Hex(stored.data),
      width: stored.ref.width,
      height: stored.ref.height,
    }
  } catch (error) {
    throw asAttachmentError(error)
  }
}

/**
 * Publish one file into the official storage and describe it with
 * host-computed metadata. The digest is computed from the streamed bytes, so
 * the record and the stored object agree by construction.
 */
export async function storeFile(
  store: TaskBoardAttachmentStore,
  chunks: AsyncIterable<Uint8Array>,
  name: string,
  mediaType: string,
  signal?: AbortSignal,
): Promise<{ attachment: TaskAttachment; bytes: number; sha256: string }> {
  const measured = new MeasuredStream(TASK_ATTACHMENT_MAX_BYTES)
  try {
    const ref = await store.saveFileStream({
      data: measured.chunks(chunks),
      ...(signal === undefined ? {} : { signal }),
      name,
    })
    const sha256 = measured.digest()
    return {
      attachment: {
        kind: 'file',
        attachmentId: String(ref.attachmentId),
        // The storage sanitizes the leaf of the name it was given, but it
        // cannot prove which name a client claimed later: the ledger
        // therefore keeps the CANONICAL form of the stored name, so a rename
        // on the wire stays single-line and safe for the prompt.
        name: canonicalAttachmentName(ref.name || name),
        bytes: ref.bytes,
        mediaType: normalizeFileMediaType(mediaType),
        sha256,
      },
      bytes: measured.bytes,
      sha256,
    }
  } catch (error) {
    throw asAttachmentError(error)
  }
}

/**
 * Map an official attachment failure onto the board's own classes, so a
 * storage fault reads as "the storage is unavailable" and a rejected image
 * reads as "the image is not acceptable" — never as an internal error.
 */
export function asAttachmentError(error: unknown): TaskBoardAttachmentError {
  if (error instanceof TaskBoardAttachmentError) return error
  const code = (error as { code?: unknown } | null)?.code
  if (typeof code === 'string') {
    if (code === 'IMAGE_TOO_LARGE' || code === 'IMAGES_TOO_LARGE') {
      return new TaskBoardAttachmentError('too-large', 'the attachment exceeds the deployment size limit', { cause: error })
    }
    if (code === 'TOO_MANY_IMAGES') {
      return new TaskBoardAttachmentError('too-large', 'the attachment exceeds the deployment image count limit', { cause: error })
    }
    if (code === 'UNSUPPORTED_IMAGE_TYPE' || code === 'IMAGE_TYPE_MISMATCH') {
      return new TaskBoardAttachmentError('unsupported-type', 'the attachment is not an accepted image type', { cause: error })
    }
    if (code === 'INVALID_IMAGE' || code === 'INVALID_IMAGE_BASE64' || code === 'IMAGE_TOO_MANY_PIXELS' || code === 'IMAGE_DIMENSION_TOO_LARGE') {
      return new TaskBoardAttachmentError('invalid-image', 'the attachment is not a readable image', { cause: error })
    }
    if (code === 'ATTACHMENT_NOT_FOUND') {
      return new TaskBoardAttachmentError('not-found', 'the attachment is not in the storage', { cause: error })
    }
    if (code === 'ATTACHMENT_READ_FAILED' || code === 'ATTACHMENT_CORRUPT') {
      return new TaskBoardAttachmentError('unreadable', 'the stored attachment could not be read back', { cause: error })
    }
    if (code === 'ATTACHMENT_WRITE_FAILED' || code === 'ATTACHMENT_FILES_UNSUPPORTED' || code === 'ATTACHMENT_PROJECTION_UNSUPPORTED') {
      return new TaskBoardAttachmentError('storage-unavailable', 'the attachment storage refused the write', { cause: error })
    }
  }
  return new TaskBoardAttachmentError('storage-unavailable', 'the attachment storage is unavailable', { cause: error })
}

/**
 * Prove every recorded attachment against the official storage: an image is
 * read back and compared, a file is streamed and its digest recomputed.
 *
 * A reference the storage does not know, and a record whose metadata does not
 * match the stored bytes, are both a refusal: the action never reaches the
 * ledger, so a spoofed client claim can never become a stored fact.
 */
export async function verifyAttachments(
  store: TaskBoardAttachmentStore,
  attachments: readonly TaskAttachment[],
): Promise<void> {
  // The official per-message budget is checked FIRST: a card whose images
  // exceed the deployment's own batch limits must never reach the prompt
  // admission, however well each individual object is stored.
  assertImageBatchWithinLimits(store, attachments)
  for (const attachment of attachments) {
    if (attachment.kind === 'image') await verifyImage(store, attachment)
    else await verifyFile(store, attachment)
  }
}

/**
 * The official image batch limits of a deployment: how many images one
 * message may carry and how many bytes they may add up to.
 *
 * The board's own caps (eight attachments, 10 MiB each, 32 MiB per card) stay
 * in force; the deployment's policy can only lower them, and it governs the
 * IMAGES of one card because that is what one prompt carries.
 */
export function officialImageBatchLimits(store: TaskBoardAttachmentStore | undefined): {
  maxImages: number
  maxImageBytes: number
  maxMessageImageBytes: number
} {
  const limits = store?.imageLimits
  const maxImages = typeof limits?.maxImagesPerMessage === 'number' && limits.maxImagesPerMessage > 0
    ? Math.min(TASK_ATTACHMENT_LIMIT, limits.maxImagesPerMessage)
    : TASK_ATTACHMENT_LIMIT
  const maxMessageImageBytes = typeof limits?.maxMessageImageBytes === 'number' && limits.maxMessageImageBytes > 0
    ? Math.min(TASK_ATTACHMENT_TOTAL_MAX_BYTES, limits.maxMessageImageBytes)
    : TASK_ATTACHMENT_TOTAL_MAX_BYTES
  return {
    maxImages,
    maxImageBytes: effectiveImageByteLimit(store),
    maxMessageImageBytes,
  }
}

/**
 * Refuse a card whose images exceed the deployment's per-message budget.
 *
 * The check counts only the images: plain files travel as paths and never
 * enter the prompt admission, so they are not part of that budget.
 * @param store - the official attachment storage.
 * @param attachments - the card's attachments.
 */
export function assertImageBatchWithinLimits(
  store: TaskBoardAttachmentStore | undefined,
  attachments: readonly TaskAttachment[],
): void {
  if (store === undefined) return
  const limits = officialImageBatchLimits(store)
  const images = attachments.filter(attachment => attachment.kind === 'image')
  if (images.length > limits.maxImages) {
    throw new TaskBoardAttachmentError(
      'too-large',
      `the card carries ${images.length} images, the deployment admits ${limits.maxImages} per message`,
    )
  }
  const bytes = images.reduce((sum, attachment) => sum + attachment.bytes, 0)
  if (bytes > limits.maxMessageImageBytes) {
    throw new TaskBoardAttachmentError(
      'too-large',
      `the card's images total ${bytes} bytes, the deployment admits ${limits.maxMessageImageBytes} per message`,
    )
  }
  for (const image of images) {
    if (image.bytes > limits.maxImageBytes) {
      throw new TaskBoardAttachmentError(
        'too-large',
        `an image exceeds the deployment limit of ${limits.maxImageBytes} bytes`,
      )
    }
  }
}

/** Read one image back and compare it with the recorded metadata. */
export async function verifyImage(store: TaskBoardAttachmentStore, attachment: TaskAttachment): Promise<void> {
  let stored: StoredImageAttachment
  try {
    stored = await store.readImage(imageRefOf(attachment))
  } catch (error) {
    throw asAttachmentError(error)
  }
  const digest = sha256Hex(stored.data)
  // The stored name is compared too, WHEN the storage echoes one: the storage
  // owns the display name of an image, so a client that renamed it is refused
  // rather than believed. A storage that keeps no name of its own cannot
  // disprove the claim that way; the bytes and the digest still prove the
  // object, and the canonical name keeps the claim safe for the prompt.
  const storedName = stored.ref.name
  if (stored.ref.bytes !== attachment.bytes
    || stored.ref.mediaType !== attachment.mediaType
    || digest !== attachment.sha256
    || stored.ref.width !== attachment.width
    || stored.ref.height !== attachment.height
    || (storedName !== undefined && canonicalAttachmentName(storedName) !== attachment.name)) {
    throw new TaskBoardAttachmentError('unreadable', `attachment ${attachment.attachmentId} does not match the stored object`)
  }
}

/** Stream one file back and recompute its digest. */
export async function verifyFile(store: TaskBoardAttachmentStore, attachment: TaskAttachment): Promise<void> {
  const hash = createHash('sha256')
  let bytes = 0
  try {
    for await (const chunk of store.readFileStream(fileRefOf(attachment))) {
      bytes += chunk.byteLength
      hash.update(chunk)
    }
  } catch (error) {
    throw asAttachmentError(error)
  }
  if (bytes !== attachment.bytes || hash.digest('hex') !== attachment.sha256) {
    throw new TaskBoardAttachmentError('unreadable', `attachment ${attachment.attachmentId} does not match the stored object`)
  }
}

/**
 * The limits the board publishes for its attachments: the board's own caps,
 * lowered by the deployment's image policy where that policy is stricter.
 */
export function publishedAttachmentLimits(store: TaskBoardAttachmentStore | undefined): {
  maxAttachments: number
  maxBytes: number
  maxTotalBytes: number
  maxImages: number
  maxImageBytes: number
  maxMessageImageBytes: number
} {
  const batch = officialImageBatchLimits(store)
  return {
    maxAttachments: TASK_ATTACHMENT_LIMIT,
    maxBytes: TASK_ATTACHMENT_MAX_BYTES,
    maxTotalBytes: TASK_ATTACHMENT_TOTAL_MAX_BYTES,
    maxImages: batch.maxImages,
    maxImageBytes: batch.maxImageBytes,
    maxMessageImageBytes: batch.maxMessageImageBytes,
  }
}

/** One image resolved for an execution prompt. */
export interface ExecutionImagePart {
  type: 'image'
  mediaType: string
  data: string
  name?: string
}

/** One file resolved for an execution prompt: its readable host path. */
export interface ExecutionFilePart {
  name: string
  path: string
  bytes: number
  mediaType: string
}

/** The attachments of a card, resolved for one execution. */
export interface ResolvedAttachments {
  /** The images, in the order the card lists them. */
  images: ExecutionImagePart[]
  /** The files, in the order the card lists them. */
  files: ExecutionFilePart[]
}

/**
 * Resolve a card's attachments for one execution: images become prompt image
 * parts, files become readable host paths.
 *
 * Every execution resolves the attachments afresh — the recorded metadata is
 * never trusted on its own, and a file whose host path is missing or
 * unreadable fails the run instead of being silently dropped.
 */
export async function resolveExecutionAttachments(
  store: TaskBoardAttachmentStore,
  attachments: readonly TaskAttachment[],
): Promise<ResolvedAttachments> {
  // The deployment's per-message image budget is checked before anything is
  // read: a card over that budget must not reach the prompt admission.
  assertImageBatchWithinLimits(store, attachments)
  const images: ExecutionImagePart[] = []
  const files: ExecutionFilePart[] = []
  for (const attachment of attachments) {
    if (attachment.kind === 'image') {
      let stored: StoredImageAttachment
      try {
        stored = await store.readImage(imageRefOf(attachment))
      } catch (error) {
        throw asAttachmentError(error)
      }
      images.push({
        type: 'image',
        mediaType: stored.ref.mediaType,
        data: Buffer.from(stored.data).toString('base64'),
        name: attachment.name,
      })
      continue
    }
    const ref = fileRefOf(attachment)
    let path: string | undefined
    try {
      path = store.fileHostPath(ref)
    } catch (error) {
      throw asAttachmentError(error)
    }
    if (path === undefined || path === '') {
      throw new TaskBoardAttachmentError(
        'unreadable',
        `attachment ${attachment.attachmentId} has no readable path in this deployment`,
      )
    }
    try {
      accessSync(path, fsConstants.R_OK)
    } catch (error) {
      throw new TaskBoardAttachmentError(
        'unreadable',
        `attachment ${attachment.name} is not readable in this deployment`,
        { cause: error },
      )
    }
    files.push({ name: attachment.name, path, bytes: attachment.bytes, mediaType: attachment.mediaType })
  }
  return { images, files }
}

/**
 * The attachment section of an execution prompt: the readable paths of the
 * card's files, marked read-only.
 *
 * It is a section of its own — never folded into the handover preamble — so
 * the two kinds of reference stay distinguishable to the reading agent.
 */
export function attachmentPromptPreamble(files: readonly ExecutionFilePart[]): string | undefined {
  if (files.length === 0) return undefined
  const lines = files.map(file => `- ${file.name}（${file.path}，${file.bytes} 字节，${file.mediaType}）`)
  return `附件文件（任务看板附件，只读路径；请直接读取这些文件，不要修改或移动它们）：
${lines.join('\n')}`
}

/** The model-info reader the image preflight uses. */
export type ModelInfoResolver = (
  provider: string,
  model: string,
  signal?: AbortSignal,
) => Promise<{ inputModalities?: readonly string[] } | undefined>

/**
 * Refuse an execution whose route cannot read images.
 *
 * The check uses the ACTUAL route of the session the run is about to use and
 * the model's own declared input modalities. A route that declares no
 * modalities is UNKNOWN, and an unknown route is allowed: the official model
 * catalog publishes no modality information, so it cannot answer this
 * question, and refusing on its silence would block every image run.
 */
export async function assertRouteAcceptsImages(
  resolveModelInfo: ModelInfoResolver | undefined,
  provider: string,
  model: string,
): Promise<void> {
  if (resolveModelInfo === undefined) return
  const info = await resolveModelInfo(provider, model)
  const modalities = info?.inputModalities
  if (!Array.isArray(modalities)) return
  if (!modalities.includes('image')) {
    throw new Error(`the model route ${provider}/${model} does not accept image input`)
  }
}

/** The attachment kinds a card may carry, for the wire gates. */
export const ATTACHMENT_KINDS: readonly TaskAttachmentKind[] = ['image', 'file']
