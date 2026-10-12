import type { ReactNode } from 'react';
import { type TaskBoardCardDecorationProps, type TaskBoardDetailSectionProps, type TaskBoardSettingsSectionProps } from '../core/extension.ts';
/** The three provider seats, adapted to plain render functions. */
export interface TaskBoardSeats {
    detailSection: (props: TaskBoardDetailSectionProps) => ReactNode;
    settingsSection: (props: TaskBoardSettingsSectionProps) => ReactNode;
    cardDecoration: (props: TaskBoardCardDecorationProps) => ReactNode;
}
/** Nothing registered: every seat renders empty. */
export declare const EMPTY_TASK_BOARD_SEATS: TaskBoardSeats;
/** The framework `renderSlot` binding shape (key + owner props share). */
export type SlotRenderBinding = (key: string, owner: Record<string, unknown>) => ReactNode;
/** Adapt one framework renderSlot binding to the board's seat interface. */
export declare function seatsFromRenderSlot(renderSlot: SlotRenderBinding | undefined): TaskBoardSeats;
/** Provider the board's registered components wrap their subtree in. */
export declare const TaskBoardSeatsProvider: import("react").Provider<TaskBoardSeats>;
/** Read the current seat set (empty when no board registration is above). */
export declare function useTaskBoardSeats(): TaskBoardSeats;
