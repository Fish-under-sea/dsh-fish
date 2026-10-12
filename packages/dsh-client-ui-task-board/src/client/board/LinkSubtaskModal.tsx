/**
 * Link-subtask modal: attach an existing on-board root task under the open
 * task. The candidate list mirrors the Host lineage gate (checkParentLink), so
 * a link the Host would refuse is not offered in the first place; the Host
 * still re-checks the action at submit time.
 */
import { useMemo, useState } from 'react'
import type { BoardController } from '../../core/controller.ts'
import { DEFAULT_SUBTASK_DEPTH, buildLineageIndex, checkParentLink } from '../../core/subtask.ts'
import { hasOpenExecution, type TaskRecord } from '../../core/tasks.ts'
import { t } from '../locales.ts'
import css from '../board.module.css'
import { useDialog, type OverlayPhase } from './overlay.tsx'
import { STATUS_KEY } from './status-key.ts'

/** Link-subtask overlay props. */
export interface LinkSubtaskModalProps {
  controller: BoardController
  /** The task the picked card becomes a subtask of. */
  parent: TaskRecord
  onClose: () => void
  /** Which leg of the enter/exit motion pair the surface is on. */
  phase?: OverlayPhase
}

/** Link-subtask overlay. */
export function LinkSubtaskModal({ controller, parent, onClose, phase = 'open' }: LinkSubtaskModalProps) {
  const dialog = useDialog<HTMLDivElement>(onClose, phase)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const snapshot = controller.getSnapshot()
  const limit = snapshot.host?.maxSubtaskDepth ?? DEFAULT_SUBTASK_DEPTH
  // Only root, on-board tasks can move under another parent; the lineage gate
  // decides the rest (depth, cycle, archived parent).
  //
  // The gate is run once per candidate task, so it is given ONE lineage index
  // for the whole pass: without it every call rebuilds the id/child maps and
  // rescans the ledger, turning a render into quadratic work. The derivation
  // also runs on every controller notification (the SSE heartbeat included),
  // so it is memoized on the inputs it actually reads.
  const tasks = snapshot.tasks
  const candidates = useMemo(() => {
    const lineage = buildLineageIndex(tasks)
    return tasks.filter(task =>
      task.archivedAt === undefined
      // An executing task may already be a participant of another run group;
      // the Host refuses the move, so it is not offered here. A card parked in
      // the running column by hand carries no execution and stays linkable.
      && !hasOpenExecution(task)
      && task.parentId === undefined
      && task.id !== parent.id
      && checkParentLink(tasks, task.id, parent.id, limit, lineage).ok,
    )
  }, [tasks, parent.id, limit])
  const link = async (taskId: string): Promise<void> => {
    setPending(true)
    setError(undefined)
    if (await controller.setParent(taskId, parent.id)) {
      onClose()
      return
    }
    setPending(false)
    setError(controller.getSnapshot().transportError ?? t('new.required'))
  }
  return (
    <div className={css.modalBackdrop} data-state={phase} onMouseDown={dialog.onMouseDown}>
      <div ref={dialog.attach} className={css.modal} role="dialog" aria-modal="true" aria-label={t('link.subtask.title')} tabIndex={-1}>
        <h2 className={css.modalTitle}>{t('link.subtask.title')}</h2>
        <p className={css.fieldHint}>{t('link.subtask.hint')}</p>
        {candidates.length === 0
          ? <p className={css.detailText}>{t('link.subtask.empty')}</p>
          : (
            <ul className={css.pickList}>
              {candidates.map(task => (
                <li key={task.id} className={css.pickRow}>
                  <span className={css.pickTitle}>{task.title}</span>
                  <span className={css.statusBadge} data-status={task.status}>{t(STATUS_KEY[task.status])}</span>
                  <button
                    type="button"
                    className={css.primaryButton}
                    disabled={pending}
                    onClick={() => { void link(task.id) }}
                  >
                    {t('link.subtask.confirm')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        {error !== undefined && <p className={css.formError}>{error}</p>}
        <footer className={css.modalFooter}>
          <button type="button" className={css.ghostButton} onClick={onClose}>{t('new.cancel')}</button>
        </footer>
      </div>
    </div>
  )
}
