/**
 * One execution's goal-acceptance report.
 *
 * Rendered inside the execution-history row, so a rerun or a scheduled run
 * keeps its OWN report and a later cycle never overwrites an earlier verdict.
 * The row itself only carries the verdict: the judge route, the acceptance
 * count, the per-criterion scores and their threshold, the findings, the
 * evidence scope and the token usage sit behind one disclosure, because the
 * same machine explanation repeated on all thirty-four rows of a card was what
 * buried the row a reader needed. Expanding it shows every field the board
 * decided on — nothing is dropped, only folded.
 *
 * Deliberately adds no new `data-dsh-part` value: the part enum is owned by the
 * cross-repository semantic-attribute contract, and this report reuses the
 * execution row's existing markup instead of extending that enum.
 */
import { useId, useState } from 'react'
import {
  MAX_INVALID_ATTEMPTS,
  MAX_QUALITY_ATTEMPTS,
  exceptionAttempts,
  invalidAttempts,
  qualityAttempts,
  verificationPhase,
  verificationTotals,
  type AcceptanceAuditRecord,
  type AcceptanceCleanupRecord,
  type ExecutionVerification,
  type VerificationAttempt,
  type VerificationCriterionFinding,
} from '../../core/verification.ts'
import { t } from '../locales.ts'
import type { TaskBoardKey } from '../locales.ts'
import css from '../board.module.css'
import { usePresence } from './overlay.tsx'

/** Render one 0..1 score as a percentage. */
function percent(value: number): string {
  return (value * 100).toFixed(1) + '%'
}

/** The judge route of one attempt, with its effective reasoning level. */
function routeLabel(attempt: VerificationAttempt): string {
  const model = attempt.route.provider === '' ? attempt.route.model : attempt.route.provider + '/' + attempt.route.model
  const effort = attempt.route.reasoningEffort
  const key: TaskBoardKey = effort === undefined || effort === '' ? 'verify.judgeNoEffort' : 'verify.judge'
  return t(key, effort === undefined || effort === '' ? { model } : { model, effort })
}

/** Board phase → report badge key. */
const PHASE_STATUS_KEY: Record<ReturnType<typeof verificationPhase>, TaskBoardKey> = {
  off: 'verify.status.off',
  executing: 'verify.status.pending',
  verifying: 'verify.status.verifying',
  repairing: 'verify.status.failed',
  passed: 'verify.status.passed',
  failed: 'verify.status.failed',
  invalid: 'verify.status.invalidHeld',
}

/**
 * Board phase → the badge's colour slot. One slot per meaning instead of one
 * per phase: a phase that is still running reads as a warning, a refused
 * acceptance reads as a failure, and an acceptance that never applied reads as
 * neutral — never as a pass.
 */
const PHASE_TONE: Record<ReturnType<typeof verificationPhase>, 'success' | 'error' | 'warn' | 'neutral'> = {
  off: 'neutral',
  executing: 'warn',
  verifying: 'warn',
  repairing: 'error',
  passed: 'success',
  failed: 'error',
  invalid: 'error',
}

/** Evidence location → locale key, for one structured finding's citation. */
const LOCATION_KEY: Record<VerificationCriterionFinding['location'], TaskBoardKey> = {
  task: 'verify.location.task',
  trajectory: 'verify.location.trajectory',
  workspace: 'verify.location.workspace',
  baseline: 'verify.location.baseline',
  unknown: 'verify.location.unknown',
}

/** Invalid reason → locale key. */
function invalidReasonKey(attempt: VerificationAttempt): TaskBoardKey {
  switch (attempt.invalidReason) {
    case 'missing-finding': return 'verify.invalidReason.missing-finding'
    case 'unlocatable-quote': return 'verify.invalidReason.unlocatable-quote'
    case 'baseline-finding': return 'verify.invalidReason.baseline-finding'
    case 'vacuous-finding': return 'verify.invalidReason.vacuous-finding'
    case 'insufficient-evidence': return 'verify.invalidReason.insufficient-evidence'
    default: return 'verify.invalidReason.unknown'
  }
}

/** Audit stage → locale key (the lightweight credential after cleanup). */
const AUDIT_STAGE_KEY: Record<AcceptanceAuditRecord['stage'], TaskBoardKey> = {
  quality: 'verify.cleanup.stage.quality',
  invalid: 'verify.cleanup.stage.invalid',
  exception: 'verify.cleanup.stage.exception',
  budget: 'verify.cleanup.stage.budget',
}

/** Stable key for one finding row. */
function findingKey(attempt: VerificationAttempt, index: number): string {
  return attempt.at.toString(36) + '-' + String(index)
}

/** One recorded attempt: a quality verdict, an invalid veto, an anomaly, or a budget stop. */
function AttemptRow({ attempt, detailRemoved }: { attempt: VerificationAttempt, detailRemoved: boolean }) {
  // Everything that is not a quality verdict renders as an anomaly row: a
  // budget stop carries no score either, and an invalid acceptance carries a
  // score the board REFUSED to book, so showing either as a scored failure
  // would read as a judgement the board never made. The invalid row gets its
  // own badge and reason line, because it is a distinct outcome.
  const invalid = attempt.stage === 'invalid'
  const exception = attempt.stage !== 'quality' && !invalid
  const result = exception ? 'failed' : attempt.passed ? 'succeeded' : 'failed'
  return (
    <li className={css.attemptRow} data-result={result}>
      <div className={css.attemptHead}>
        <span className={css.executionBadge} data-result={result}>
          {invalid ? t('verify.status.invalid') : exception ? t('verify.status.exception') : attempt.passed ? t('verify.status.passed') : t('verify.status.failed')}
        </span>
        <span className={css.executionTimes}>
          {invalid
            ? t('verify.attemptInvalid', { index: String(attempt.index) })
            : exception
              ? t('verify.attemptException', { index: String(attempt.index) })
              : t('verify.attempt', { index: String(attempt.index) })}
          {' · '}{routeLabel(attempt)}
          {!exception && !invalid && ' · ' + t('verify.rounds', { rounds: String(attempt.rounds) })}
        </span>
      </div>
      {invalid && (
        <span className={css.executionTimes}>
          {t('verify.invalidDetail', { reason: t(invalidReasonKey(attempt)) })}
        </span>
      )}
      {attempt.error !== undefined && <span className={css.executionTimes}>{attempt.error}</span>}
      {!exception && (
        <>
          <span className={css.executionTimes}>
            {t('verify.summary', {
              score: percent(attempt.score),
              threshold: percent(attempt.criteria[0]?.threshold ?? 0),
              baseline: percent(attempt.baseline),
            })}
          </span>
          <span className={css.executionTimes}>{t('verify.criteria')}</span>
          <ul className={css.executionList}>
            {attempt.criteria.map(criterion => (
              <li key={criterion.id} className={css.executionTimes}>
                {t('verify.criterion', {
                  name: criterion.name,
                  score: percent(criterion.score),
                  threshold: percent(criterion.threshold),
                })}
              </li>
            ))}
          </ul>
        </>
      )}
      {(attempt.criterionFindings ?? []).length > 0 && (
        <>
          <span className={css.executionTimes}>{t('verify.criterionFindings')}</span>
          <ul className={css.executionList}>
            {(attempt.criterionFindings ?? []).map((finding, index) => (
              <li key={findingKey(attempt, index)} className={css.executionTimes}>
                {t('verify.criterionFindingFull', {
                  criterion: finding.criterionId,
                  location: t(LOCATION_KEY[finding.location]),
                  quote: finding.quote,
                  requirement: finding.requirement,
                  observation: finding.observation,
                  gap: finding.gap,
                })}
              </li>
            ))}
          </ul>
        </>
      )}
      {attempt.findings.length > 0 && (
        <>
          <span className={css.executionTimes}>{t('verify.findings')}</span>
          <ul className={css.executionList}>
            {attempt.findings.map((finding, index) => (
              <li key={findingKey(attempt, index)} className={css.executionTimes}>{finding}</li>
            ))}
          </ul>
        </>
      )}
      {!exception && !invalid && attempt.findings.length === 0 && (
        // A cleaned attempt has no findings because the acceptance removed them,
        // not because the judge gave none: saying "the judge reported no
        // finding" here would invite exactly the misreading the cleanup rule
        // exists to avoid.
        <span className={css.executionTimes}>{t(detailRemoved ? 'verify.detailRemoved' : 'verify.noFindings')}</span>
      )}
      <span className={css.executionTimes}>
        {t('verify.evidence', {
          chars: String(attempt.evidence.chars),
          entries: String(attempt.evidence.entries),
          omitted: String(attempt.evidence.omittedCharacters),
        })}
        {attempt.evidence.workspaceFiles !== undefined && attempt.evidence.workspaceFiles > 0
          ? ' · ' + t('verify.workspaceEvidence', { files: String(attempt.evidence.workspaceFiles) })
          : ''}
      </span>
      <span className={css.executionTimes}>
        {t('verify.usage', {
          calls: String(attempt.usage.calls),
          input: String(attempt.usage.inputTokens),
          output: String(attempt.usage.outputTokens),
          reasoning: String(attempt.usage.reasoningTokens),
        })}
        {attempt.usage.usageIncomplete === true ? t('verify.usageIncomplete') : ''}
      </span>
    </li>
  )
}

/**
 * Retention notice of one execution's acceptance detail.
 *
 * It exists so a reader never mistakes a cleaned-up report for a judge that
 * produced no evidence: the notice says the detail WAS produced and was removed
 * by the automatic cleanup, and lists the lightweight credential that survives.
 * A pending or failed cleanup is reported the same way — never as a missing
 * verdict and never as a revoked pass.
 */
function CleanupNotice({ cleanup }: { cleanup: AcceptanceCleanupRecord }) {
  const key: TaskBoardKey = cleanup.state === 'cleaned'
    ? 'verify.cleanup.cleaned'
    : cleanup.state === 'failed' ? 'verify.cleanup.failed' : 'verify.cleanup.pending'
  return (
    <>
      <span className={css.executionTimes}>
        {cleanup.state === 'failed'
          ? t(key, { attempts: String(cleanup.attempts), error: cleanup.lastError ?? '' })
          : t(key)}
      </span>
      {cleanup.audit.length > 0 && (
        <ul className={css.executionList}>
          {cleanup.audit.map((record, index) => (
            <li key={record.at.toString(36) + '-' + record.stage + '-' + String(index)} className={css.executionTimes}>
              {t('verify.cleanup.audit', {
                index: String(index + 1),
                stage: t(AUDIT_STAGE_KEY[record.stage]),
                score: percent(record.score),
                hash: record.evidenceHash.slice(0, 12),
              })}
              {record.findingSummary === undefined ? '' : ' · ' + record.findingSummary}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/**
 * Render one execution's acceptance report.
 * @param props - the execution's persisted acceptance block.
 * @returns the verdict badge with its fold-out detail, or nothing when
 * acceptance never applied.
 */
export function VerificationReport({ verification }: { verification: ExecutionVerification }) {
  const [expanded, setExpanded] = useState(false)
  const presence = usePresence(expanded)
  const panelId = useId()
  const phase = verificationPhase(verification)
  if (phase === 'off' && verification.contract.enabled === false && verification.applicability !== 'skipped') return null
  const totals = verificationTotals(verification)
  const route = verification.contract.route
  const applicabilityKey: TaskBoardKey | undefined = verification.applicability === 'disabled'
    ? 'verify.applicability.disabled'
    : verification.applicability === 'skipped'
      ? 'verify.applicability.skipped'
      : verification.applicability === 'goal-unavailable'
        ? 'verify.applicability.goalUnavailable'
        : verification.applicability === 'goal-disabled'
          ? 'verify.applicability.goalDisabled'
          : verification.applicability === 'team-member' ? 'verify.applicability.teamMember' : undefined
  return (
    <div className={css.verifyReport}>
      <button
        type="button"
        className={css.verifyBadge}
        data-tone={PHASE_TONE[phase]}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => { setExpanded(!expanded) }}
      >
        {t('verify.title')}
        <span className={css.verifyVerdict}>{t(PHASE_STATUS_KEY[phase])}</span>
        <span className={css.disclosureChevron} data-open={expanded} aria-hidden="true" />
      </button>
      {presence.mounted && (
        <div className={css.verifyPanel} id={panelId} data-state={presence.phase}>
          <span className={css.executionTimes}>
            {t('verify.invalidCounts', {
              quality: String(qualityAttempts(verification).length),
              max: String(MAX_QUALITY_ATTEMPTS),
              invalid: String(invalidAttempts(verification).length),
              maxInvalid: String(MAX_INVALID_ATTEMPTS),
              exceptions: String(exceptionAttempts(verification).length),
            })}
          </span>
          {route !== undefined && (
            <span className={css.executionTimes}>
              {verification.contract.modelSource === 'inherit'
                ? t('verify.judgeInherited', { model: route.provider + '/' + route.model })
                : t(route.reasoningEffort === undefined || route.reasoningEffort === '' ? 'verify.judgeNoEffort' : 'verify.judge', {
                  model: route.provider + '/' + route.model,
                  ...(route.reasoningEffort === undefined ? {} : { effort: route.reasoningEffort }),
                })}
            </span>
          )}
          {verification.contract.effortFallback !== undefined && (
            <span className={css.executionTimes}>
              {t('verify.effortFallback', {
                requested: verification.contract.effortFallback.requested,
                resolved: verification.contract.effortFallback.resolved ?? t('settings.goalVerificationResolvedNoEffort'),
              })}
            </span>
          )}
          {applicabilityKey !== undefined && <span className={css.executionTimes}>{t(applicabilityKey)}</span>}
          {verification.failedReason !== undefined && (
            <span className={css.executionTimes}>{t('verify.finalFailure', { reason: verification.failedReason })}</span>
          )}
          {totals.calls > 0 && (
            <span className={css.executionTimes}>
              {t('verify.usage', {
                calls: String(totals.calls),
                input: String(totals.inputTokens),
                output: String(totals.outputTokens),
                reasoning: String(totals.reasoningTokens),
              })}
              {totals.usageIncomplete ? t('verify.usageIncomplete') : ''}
            </span>
          )}
          {verification.attempts.length > 0 && (
            <ul className={css.executionList}>
              {[...verification.attempts].reverse().map(attempt => (
                <AttemptRow
                  key={attempt.at.toString(36) + '-' + attempt.stage + '-' + String(attempt.index)}
                  attempt={attempt}
                  detailRemoved={verification.cleanup?.state === 'cleaned'}
                />
              ))}
            </ul>
          )}
          {verification.cleanup !== undefined && <CleanupNotice cleanup={verification.cleanup} />}
        </div>
      )}
    </div>
  )
}
