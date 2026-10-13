/**
 * The board's own vector glyphs.
 *
 * Every control glyph the board draws comes from here, so one action always
 * has one metaphor and one stroke recipe: a 16-unit viewBox, `currentColor`,
 * 1.3 stroke, round caps and joins — the same recipe the sidebar panel glyph
 * (`native-panel.tsx`) uses, which is why the board's chrome and its sidebar
 * row read as one product. Icon-only controls pass a localized `title` and an
 * accessible name at the call site; the glyph itself is always decorative.
 *
 * @module @fish-under-sea/dsh-client-ui-task-board-fish/client/board/icons
 */
import type { ReactElement } from 'react';
/** Props of one board glyph: the shared recipe plus an explicit pixel size. */
export interface BoardIconProps {
    /** Rendered square edge in CSS pixels. */
    size?: number;
}
/** Leave the board: the back-to-chat chevron. */
export declare function IconChevronLeft(props: BoardIconProps): ReactElement;
/** Dismiss a transient surface. */
export declare function IconClose(props: BoardIconProps): ReactElement;
/** Add: create a task, a label row, or a subtask. */
export declare function IconPlus(props: BoardIconProps): ReactElement;
/** Open the execution's session transcript. */
export declare function IconSession(props: BoardIconProps): ReactElement;
/** Switch a column to single-line cards. */
export declare function IconCompactRows(props: BoardIconProps): ReactElement;
/** Switch a column back to full cards. */
export declare function IconExpandRows(props: BoardIconProps): ReactElement;
/** A scheduled run: the recurrence mark on a card. */
export declare function IconClock(props: BoardIconProps): ReactElement;
