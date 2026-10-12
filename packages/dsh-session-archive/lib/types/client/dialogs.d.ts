/**
 * Dialog surfaces for the session-archive section: the physical-delete
 * confirmation (with family cascade accounting and a strong second
 * confirmation for large deletes), the live batch progress, and the
 * session preview. All dialogs are keyboard-accessible (Esc closes, focus
 * moves in on open and back on close) and render with role=dialog.
 * @module @fish-under-sea/dsh-session-archive/client/dialogs
 */
import { type ReactNode } from 'react';
import type { ConfirmDeleteState, BatchProgress } from './archive-store.ts';
/** Human-readable byte size. */
export declare function formatBytes(bytes: number | undefined): string;
export declare function formatTime(ms: number | undefined): string;
interface ModalProps {
    title: string;
    onClose: () => void;
    children: ReactNode;
    danger?: boolean;
    /** Extra width for content-heavy surfaces (session preview). */
    wide?: boolean;
}
/** Shared modal shell: focus on open, Esc to close, restore focus after. */
export declare function Modal({ title, onClose, children, danger, wide }: ModalProps): ReactNode;
/** Delete confirmation with full cascade accounting. */
export declare function DeleteConfirmDialog(props: {
    state: ConfirmDeleteState;
    onConfirm: () => void;
    onCancel: () => void;
}): ReactNode;
/** Live batch progress with per-session skip/fail reasons. */
export declare function BatchDialog(props: {
    batch: BatchProgress;
    onClose: () => void;
    onRetryFailed: () => void;
}): ReactNode;
/** Session preview: basic info + a tolerant conversation excerpt. */
export declare function PreviewDialog(props: {
    preview: {
        id: string;
        status: 'loading' | 'ready' | 'error';
        data?: {
            title?: string;
            createdAt?: number;
            cwd?: string;
            sizeBytes?: number;
            messageCount: number;
            excerpt: readonly {
                role: string;
                text: string;
            }[];
        };
        error?: string;
    };
    onClose: () => void;
    onRetry: () => void;
}): ReactNode;
export {};
