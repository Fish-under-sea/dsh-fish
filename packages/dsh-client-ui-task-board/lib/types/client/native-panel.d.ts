import type { ReactNode } from 'react';
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { TASK_BOARD_PANEL_ID, type BoardController } from '../core/controller.ts';
import { type SlotRenderBinding } from './seats.tsx';
/** The panel id shared by the sidebar row and the main-slot occupant. */
export { TASK_BOARD_PANEL_ID };
/**
 * The sidebar row glyph the shell asks for at its own size and active state.
 * The shell owns the button, label, tooltip and rail geometry; this component
 * draws only the glyph, like every other panel row.
 *
 * The glyph carries `data-dsh-panel-entry` because it is the only DOM the
 * panel's own code owns inside that shell-owned row: the L2 contract (skins)
 * resolves which row belongs to which plugin through it, since the shell
 * stamps no per-entry hook of its own (see contracts/semantic-attrs-v1.md).
 * @param props - the shell's icon share: square edge and selection state.
 * @returns the decorative board glyph.
 */
export declare function TaskBoardPanelIcon({ size }: {
    size: number;
    active: boolean;
}): React.ReactElement;
/**
 * The main-slot page. The layout mounts it only while the board is the selected
 * panel, so the conversation keeps the center column untouched the rest of the
 * time; the wrapper carries the pinned `data-dsh-taskboard-view` semantic
 * anchor (L2 contract, skins) and the container query context the board's
 * responsive rules read.
 * @param props - the framework main-slot share plus this entry's injected face.
 * @returns the board page.
 */
export declare function TaskBoardPanel({ controller, renderSlot }: {
    controller: BoardController;
    /** Child-slot renderer the registration declares (detail + card decoration). */
    renderSlot?: SlotRenderBinding;
}): ReactNode;
/**
 * Register the board's sidebar row and center-column page.
 *
 * Both seats are declared by shell plugins this package does not depend on at
 * runtime, so each registration is wrapped in `ctx.slots.inject`: the callback
 * runs only after the owning entry declares the seat, and a shell that never
 * declares it leaves the board simply absent instead of failing boot.
 * @param ctx - client root context (services: slots).
 * @param controller - the board controller the page and the row drive.
 * @returns disposer releasing both registrations.
 */
export declare function registerTaskBoardPanel(ctx: ClientContext, controller: BoardController): () => void;
