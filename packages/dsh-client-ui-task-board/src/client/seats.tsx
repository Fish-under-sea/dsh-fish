/**
 * The board's child seats, threaded from the slot registration that declares
 * them down to the components that consume them.
 *
 * The framework hands the declaring component a `renderSlot` binding; the board
 * wraps that binding in a React context so a provider's contribution can render
 * deep inside TaskDetail, the card, or the settings card without those
 * components knowing which providers exist.
 *
 * @module dsh-task-board/client/seats
 */
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import {
  TASK_BOARD_CARD_DECORATION,
  TASK_BOARD_DETAIL_SECTION,
  TASK_BOARD_SETTINGS_SECTION,
  type TaskBoardCardDecorationProps,
  type TaskBoardDetailSectionProps,
  type TaskBoardSettingsSectionProps,
} from '../core/extension.ts'

/** The three provider seats, adapted to plain render functions. */
export interface TaskBoardSeats {
  detailSection: (props: TaskBoardDetailSectionProps) => ReactNode
  settingsSection: (props: TaskBoardSettingsSectionProps) => ReactNode
  cardDecoration: (props: TaskBoardCardDecorationProps) => ReactNode
}

/** Nothing registered: every seat renders empty. */
export const EMPTY_TASK_BOARD_SEATS: TaskBoardSeats = {
  detailSection: () => null,
  settingsSection: () => null,
  cardDecoration: () => null,
}

/** The framework `renderSlot` binding shape (key + owner props share). */
export type SlotRenderBinding = (key: string, owner: Record<string, unknown>) => ReactNode

/** Adapt one framework renderSlot binding to the board's seat interface. */
export function seatsFromRenderSlot(renderSlot: SlotRenderBinding | undefined): TaskBoardSeats {
  if (renderSlot === undefined) return EMPTY_TASK_BOARD_SEATS
  return {
    detailSection: props => renderSlot(TASK_BOARD_DETAIL_SECTION, props as unknown as Record<string, unknown>),
    settingsSection: props => renderSlot(TASK_BOARD_SETTINGS_SECTION, props as unknown as Record<string, unknown>),
    cardDecoration: props => renderSlot(TASK_BOARD_CARD_DECORATION, props as unknown as Record<string, unknown>),
  }
}

const TaskBoardSeatsContext = createContext<TaskBoardSeats>(EMPTY_TASK_BOARD_SEATS)

/** Provider the board's registered components wrap their subtree in. */
export const TaskBoardSeatsProvider = TaskBoardSeatsContext.Provider

/** Read the current seat set (empty when no board registration is above). */
export function useTaskBoardSeats(): TaskBoardSeats {
  return useContext(TaskBoardSeatsContext)
}
