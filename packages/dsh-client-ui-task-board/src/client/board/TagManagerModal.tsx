/**
 * Label manager: the board's label row can only shrink through here.
 *
 * The filter row is the union of every label in use across the ledger, so a
 * label created once — by an experiment, a pasted task, an import — stayed on
 * the board forever: there was no way to rename a typo, merge two labels that
 * mean the same thing, or remove one nobody uses. This dialog is that way out.
 * It lists the labels with their usage counts and offers the two ledger-wide
 * transitions, both of which go through the controller so the Host ledger stays
 * the authority (and a shared board stays consistent for everyone watching it).
 *
 * Renaming onto a name already in use merges the two labels; the dialog says so
 * before the edit is submitted. Deleting is confirmed first, and the
 * confirmation names how many tasks the label is removed from.
 */
import { useMemo, useState } from 'react'
import type { BoardController } from '../../core/controller.ts'
import { TAG_NAME_MAX_LENGTH, collectKnownTags, type TaskRecord } from '../../core/tasks.ts'
import { t } from '../locales.ts'
import css from '../board.module.css'
import { ConfirmDialog } from './ConfirmDialog.tsx'
import { IconClose } from './icons.tsx'
import { useDialog, usePresence, type OverlayPhase } from './overlay.tsx'

/** One label as the manager lists it: its definition plus how many tasks carry it. */
export interface TagUsage {
  name: string
  promptPrefix?: string
  /** Tasks carrying the label right now. */
  count: number
}

/**
 * Labels in use, in board order (first occurrence wins, exactly like the
 * filter row), each with its usage count.
 * @param tasks - the whole ledger (board and archive).
 * @returns one row per label.
 */
export function tagUsage(tasks: readonly TaskRecord[]): TagUsage[] {
  const counts = new Map<string, number>()
  for (const task of tasks) {
    for (const tag of task.tags ?? []) counts.set(tag.name, (counts.get(tag.name) ?? 0) + 1)
  }
  return collectKnownTags(tasks).map(tag => ({
    name: tag.name,
    ...(tag.promptPrefix === undefined ? {} : { promptPrefix: tag.promptPrefix }),
    count: counts.get(tag.name) ?? 0,
  }))
}

/** Label-manager overlay props. */
export interface TagManagerModalProps {
  controller: BoardController
  onClose: () => void
  /** Which leg of the enter/exit motion pair the surface is on. */
  phase?: OverlayPhase
}

/** Label-manager overlay. */
export function TagManagerModal({ controller, onClose, phase = 'open' }: TagManagerModalProps) {
  /** The label whose row is being renamed, and the draft name. */
  const [editing, setEditing] = useState<string | undefined>(undefined)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [confirmDelete, setConfirmDelete] = useState<string | undefined>(undefined)
  const confirmPresence = usePresence(confirmDelete !== undefined)
  // Escape and a backdrop press peel one layer at a time: an open row editor
  // first, then the dialog — so a half-typed rename is never lost to the same
  // key that closes the surface under it.
  const dismiss = (): void => {
    if (editing !== undefined) {
      setEditing(undefined)
      setError(undefined)
      return
    }
    onClose()
  }
  const dialog = useDialog<HTMLDivElement>(dismiss, phase)
  const snapshot = controller.getSnapshot()
  const rows = useMemo(() => tagUsage(snapshot.tasks), [snapshot.tasks])
  const deleting = rows.find(row => row.name === confirmDelete)
  /** The label the typed name would merge into, when it is already in use. */
  const mergesInto = editing === undefined ? undefined : rows.find(row => row.name === draft.trim() && row.name !== editing)

  const startRename = (row: TagUsage): void => {
    setEditing(row.name)
    setDraft(row.name)
    setError(undefined)
  }

  const submitRename = async (from: string): Promise<void> => {
    const to = draft.trim()
    if (to === '' || to === from) {
      setEditing(undefined)
      return
    }
    setBusy(true)
    setError(undefined)
    const accepted = await controller.renameTag(from, to)
    setBusy(false)
    if (accepted) {
      setEditing(undefined)
      return
    }
    setError(controller.getSnapshot().transportError ?? t('tags.renameFailed'))
  }

  const remove = async (name: string): Promise<void> => {
    setBusy(true)
    setError(undefined)
    const accepted = await controller.deleteTag(name)
    setBusy(false)
    if (!accepted) setError(controller.getSnapshot().transportError ?? t('tags.deleteFailed'))
  }

  return (
    <>
      <div className={css.modalBackdrop} data-state={phase} onMouseDown={dialog.onMouseDown}>
        <div
          ref={dialog.attach}
          className={css.modal}
          role="dialog"
          aria-modal="true"
          aria-label={t('tags.title')}
          tabIndex={-1}
        >
          <header className={css.modalHeader}>
            <h2 className={css.modalTitle}>{t('tags.title')}</h2>
            <button
              type="button"
              className={css.iconButton}
              aria-label={t('detail.close')}
              title={t('detail.close')}
              onClick={onClose}
            >
              <IconClose size={16} />
            </button>
          </header>

          <div className={css.modalBody}>
            <p className={css.fieldHint}>{t('tags.hint')}</p>
            {rows.length === 0
              ? <p className={css.detailText}>{t('tags.empty')}</p>
              : (
                <ul className={css.tagManageList}>
                  {rows.map(row => (
                    <li key={row.name} className={css.tagManageRow}>
                      {editing === row.name
                        ? (
                          <>
                            <input
                              className={css.input + ' ' + css.tagManageInput}
                              value={draft}
                              maxLength={TAG_NAME_MAX_LENGTH}
                              spellCheck={false}
                              aria-label={t('tags.renameLabel', { name: row.name })}
                              onChange={event => { setDraft(event.target.value); setError(undefined) }}
                              onKeyDown={event => {
                                if (event.key === 'Enter') void submitRename(row.name)
                              }}
                            />
                            <button
                              type="button"
                              className={css.primaryButton}
                              disabled={busy || draft.trim() === ''}
                              onClick={() => { void submitRename(row.name) }}
                            >
                              {t('tags.save')}
                            </button>
                            <button
                              type="button"
                              className={css.ghostButton}
                              disabled={busy}
                              onClick={() => { setEditing(undefined); setError(undefined) }}
                            >
                              {t('new.cancel')}
                            </button>
                          </>
                          )
                        : (
                          <>
                            <span className={css.tagManageName}>{row.name}</span>
                            <span className={css.tagManageCount}>{t('tags.usage', { count: String(row.count) })}</span>
                            <button
                              type="button"
                              className={css.ghostButton}
                              disabled={busy}
                              onClick={() => { startRename(row) }}
                            >
                              {t('tags.rename')}
                            </button>
                            <button
                              type="button"
                              className={css.ghostButton}
                              disabled={busy}
                              onClick={() => { setConfirmDelete(row.name) }}
                            >
                              {t('tags.delete')}
                            </button>
                          </>
                          )}
                      {editing === row.name && mergesInto !== undefined && (
                        <span className={css.tagManageMerge}>{t('tags.mergeHint', { name: mergesInto.name })}</span>
                      )}
                    </li>
                  ))}
                </ul>
                )}
            {error !== undefined && <p className={css.formError}>{error}</p>}
          </div>

          <footer className={css.modalFooter}>
            <button type="button" className={css.ghostButton} onClick={onClose}>{t('tags.done')}</button>
          </footer>
        </div>
      </div>

      {confirmPresence.mounted && deleting !== undefined && (
        <ConfirmDialog
          title={t('tags.deleteTitle')}
          message={t('tags.deleteConfirm', { name: deleting.name, count: String(deleting.count) })}
          confirmLabel={t('tags.deleteOk')}
          danger
          phase={confirmPresence.phase}
          onCancel={() => { setConfirmDelete(undefined) }}
          onConfirm={() => {
            setConfirmDelete(undefined)
            void remove(deleting.name)
          }}
        />
      )}
    </>
  )
}
