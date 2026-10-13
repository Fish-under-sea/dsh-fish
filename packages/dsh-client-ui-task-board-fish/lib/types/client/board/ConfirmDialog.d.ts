import { type OverlayPhase } from './overlay.tsx';
/** Confirm overlay props. */
export interface ConfirmDialogProps {
    title: string;
    message: string;
    confirmLabel: string;
    /** Render the confirm button in the danger style. */
    danger?: boolean;
    /** Which leg of the enter/exit motion pair the surface is on. */
    phase?: OverlayPhase;
    onCancel: () => void;
    onConfirm: () => void;
}
/** Small confirm overlay. */
export declare function ConfirmDialog({ title, message, confirmLabel, danger, phase, onCancel, onConfirm }: ConfirmDialogProps): import("react").JSX.Element;
