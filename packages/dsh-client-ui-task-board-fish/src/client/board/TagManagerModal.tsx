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
 *
 * Clearing is that same delete applied to a judged set instead of one row: the
 * dialog offers a usage threshold, cleanupCandidates names the labels that are
 * both below it and carried only by finished tasks, and the confirmation lists
 * what would go before anything is written. The Host ledger stays the authority
 * either way — this surface only decides what to ask for.
 */
import { useId, useMemo, useState } from 'react'
import type { BoardController } from '../../core/controller.ts'
import { TAG_NAME_MAX_LENGTH, collectKnownTags, type TaskRecord } from '../../core/tasks.ts'
import { cleanupCandidates, type TagCleanupCandidate } from '../../core/use-cases/task-tag.ts'
import { t } from '../locales.ts'
import css from '../board.module.css'
import { ConfirmDialog } from './ConfirmDialog.tsx'
import { IconClose } from './icons.tsx'
import { useDialog, usePresence, type OverlayPhase } from './overlay.tsx'

/** Usage the clear control starts on: labels carried by fewer tasks than this. */
const CLEANUP_THRESHOLD_DEFAULT = 5
/** Floor of the threshold field: a label in use always sits on at least one task. */
const CLEANUP_THRESHOLD_MIN = 1
/** Ceiling of the threshold field, which keeps the field a two-digit control. */
const CLEANUP_THRESHOLD_MAX = 99

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

/**
 * The threshold a typed value actually stands for. A number field only marks an
 * out-of-range value invalid; it still hands the value back, so the range the
 * field declares is folded in here before anything is judged: below the floor
 * becomes the floor, above the ceiling becomes the ceiling, and a value that is
 * not a number at all selects nothing (the manager then answers "no label
 * matches" instead of guessing a bound).
 * @param typed - the raw field value.
 * @returns a threshold inside the field's range, or NaN for "select nothing".
 */
function cleanupThreshold(typed: string): number {
  const value = Number(typed)
  if (!Number.isFinite(value)) return Number.NaN
  return Math.min(CLEANUP_THRESHOLD_MAX, Math.max(CLEANUP_THRESHOLD_MIN, value))
}

/**
 * The confirmation body for a cleanup: every label that would go, each with the
 * number of tasks it would be removed from, so the decision is made against
 * names and sizes rather than against a bare count.
 * @param candidates - what the threshold judged, in listing order.
 * @returns the sentence the confirmation shows.
 */
function cleanupMessage(candidates: readonly TagCleanupCandidate[]): string {
  return t('tags.cleanupConfirm', {
    count: String(candidates.length),
    names: candidates.map(candidate => candidate.name + ' (' + candidate.count + ')').join(', '),
  })
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
  /** What the clear control judged, kept as the draft the confirmation lists. */
  const [confirmCleanup, setConfirmCleanup] = useState<TagCleanupCandidate[] | undefined>(undefined)
  /** The threshold as typed, so an emptied field stays empty instead of snapping back. */
  const [threshold, setThreshold] = useState(String(CLEANUP_THRESHOLD_DEFAULT))
  /** Supporting answer to a clear press (nothing matched), never an error. */
  const [notice, setNotice] = useState<string | undefined>(undefined)
  /** Description target of the corner `?`: the same text as its hover text. */
  const ruleId = useId()
  /**
   * Everything this dialog explains, in reading order: what labels are and what
   * renaming or deleting does to the cards, then the clear rule. The body keeps
   * the list alone; the corner `?` carries the prose.
   */
  const ruleText = `${t('tags.hint')}\n\n${t('tags.cleanupHint')}`
  const confirmPresence = usePresence(confirmDelete !== undefined)
  const cleanupPresence = usePresence(confirmCleanup !== undefined)
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

  /**
   * Judge the ledger against the typed threshold. Nothing is written here: an
   * empty verdict is answered in place, so a threshold nobody agrees with can
   * never delete anything by itself.
   */
  const startCleanup = (): void => {
    setError(undefined)
    setNotice(undefined)
    const candidates = cleanupCandidates(controller.getSnapshot().tasks, cleanupThreshold(threshold))
    if (candidates.length === 0) {
      setNotice(t('tags.cleanupEmpty'))
      return
    }
    setConfirmCleanup(candidates)
  }

  /**
   * Remove the judged labels one ledger edit at a time, in the order they were
   * listed: each delete is its own Host-confirmed transition, so a refused one
   * leaves the rest of the ledger untouched and only counts as a failure.
   */
  const clearLabels = async (candidates: readonly TagCleanupCandidate[]): Promise<void> => {
    setBusy(true)
    setError(undefined)
    setNotice(undefined)
    let failed = 0
    for (const candidate of candidates) {
      const accepted = await controller.deleteTag(candidate.name)
      if (!accepted) failed += 1
    }
    setBusy(false)
    if (failed > 0) setError(t('tags.cleanupFailed', { count: String(failed) }))
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
            {/* The clear control belongs to the whole ledger, not to the row above
                it, so it lives in the card's corner instead of after the list. Its
                rule rides on the `?` as a real bubble rather than a native title:
                Electron did not paint the title here, the bubble also answers
                keyboard focus, and it is the element aria-describedby names. */}
            <div className={css.tagCleanup}>
              <div className={css.helpTipWrap}>
                <button
                  type="button"
                  className={css.helpButton}
                  aria-label={t('tags.help')}
                  aria-describedby={ruleId}
                >
                  ?
                </button>
                <span id={ruleId} className={css.helpTip} role="tooltip">{ruleText}</span>
              </div>
              <label className={css.scheduleZone}>
                <span>{t('tags.cleanupThreshold')}</span>
                <input
                  className={css.input + ' ' + css.tagCleanupInput}
                  type="number"
                  min={CLEANUP_THRESHOLD_MIN}
                  max={CLEANUP_THRESHOLD_MAX}
                  step={1}
                  inputMode="numeric"
                  value={threshold}
                  disabled={busy}
                  aria-label={t('tags.cleanupThreshold')}
                  onChange={event => {
                    setThreshold(event.target.value)
                    setNotice(undefined)
                    setError(undefined)
                  }}
                />
              </label>
              <button type="button" className={css.ghostButton} disabled={busy} onClick={startCleanup}>
                {t('tags.cleanup')}
              </button>
            </div>
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
            {notice !== undefined && <p className={css.tagCleanupNotice} role="status">{notice}</p>}
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

      {cleanupPresence.mounted && confirmCleanup !== undefined && (
        <ConfirmDialog
          title={t('tags.cleanupTitle')}
          message={cleanupMessage(confirmCleanup)}
          confirmLabel={t('tags.cleanupOk')}
          danger
          phase={cleanupPresence.phase}
          onCancel={() => { setConfirmCleanup(undefined) }}
          onConfirm={() => {
            const judged = confirmCleanup
            setConfirmCleanup(undefined)
            void clearLabels(judged)
          }}
        />
      )}
    </>
  )
}
