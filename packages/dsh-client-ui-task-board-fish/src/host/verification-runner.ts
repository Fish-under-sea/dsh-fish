/**
 * Goal acceptance runner: evidence assembly and the judge calls of one
 * acceptance attempt.
 *
 * Lives in the host half because it needs the live session event log and the
 * official `llm` service; every rule it applies (criteria, scale, tags,
 * thresholds, budgets, caps) comes from `../core/verification.ts`, which mirrors
 * the installed dsh-llm-verifier 0.8.4 default final acceptance.
 */
import { createUserMessage, type FinishReason, type LlmRuntime } from '@deepseek-ai/dsh-llm'
import { openOneShotStream } from './llm-dispatch.ts'
import { createHash } from 'node:crypto'
import { DEFAULT_VERIFICATION_BUDGET_MS } from '../core/verification-budget.ts'
import {
  CODING_CRITERIA,
  EMPTY_WORK_BASELINE,
  workSlotOfRound,
  VERIFICATION_DETAIL_MAX_FINDINGS,
  VERIFICATION_DETAIL_MAX_PROBLEM_CHARS,
  VERIFICATION_DETAIL_MAX_QUOTE_CHARS,
  assessAcceptanceValidity,
  type AcceptanceEvidenceText,
  type VerificationCriterionFinding,
  type VerificationInvalidReason,
  VERIFICATION_ROUNDS,
  VERIFICATION_THRESHOLD,
  acceptancePassed,
  buildAcceptancePrompt,
  extractScore,
  type VerificationAttempt,
  type CatalogGroup,
  type CatalogModel,
  type CatalogReasoningEffort,
  type ModelCatalogView,
  type VerificationContract,
  type VerificationCriterion,
  type VerificationCriterionScore,
  type VerificationEvidenceSummary,
  type VerificationRoute,
  type VerificationSettings,
  type VerificationUsage,
} from '../core/verification.ts'

/** Largest trace handed to the judge, mirroring the verifier's default cap. */
export const VERIFICATION_MAX_TRACE_CHARS = 80_000
/** Largest single trace entry; one huge tool result must not eat the budget. */
export const VERIFICATION_MAX_ENTRY_CHARS = 4_000
/** Largest per-finding text kept from one judge answer. */
export const VERIFICATION_MAX_FINDING_CHARS = 400
/** Largest verbatim citation kept from one finding. */
export const VERIFICATION_MAX_QUOTE_CHARS = VERIFICATION_DETAIL_MAX_QUOTE_CHARS
/** Largest requirement/observation/gap statement kept from one finding. */
export const VERIFICATION_MAX_PROBLEM_CHARS = VERIFICATION_DETAIL_MAX_PROBLEM_CHARS
/** Structured findings kept per judge answer and per acceptance. */
export const VERIFICATION_MAX_FINDINGS_PER_CALL = 3
export const VERIFICATION_MAX_FINDINGS = VERIFICATION_DETAIL_MAX_FINDINGS
/**
 * Default ceiling of ONE judge request. The effective ceiling is a row setting
 * (`goalVerificationCallTimeoutSeconds`), read live by the gate, because 120s was
 * tight for a reasoning model reading an 80,000 character trace with a 16,384
 * token output cap: every timeout it produced was charged as an acceptance
 * anomaly against a budget that then failed the card.
 */
export const VERIFICATION_CALL_TIMEOUT_MS = 150_000
export const VERIFICATION_MAX_TOKENS = 16_384
export const VERIFICATION_TEMPERATURE = 0.2
export const VERIFICATION_REQUEST_ATTEMPTS = 3

/** Redaction patterns, mirrored from the verifier's defaults. */
export const VERIFICATION_REDACT_PATTERNS: readonly string[] = [
  "Bearer\\s+[A-Za-z0-9._~+\\/=-]+",
  '(?:api[_-]?key|token|password|secret)\\s*[=:]\\s*["\']?[^\\s,"\';}]+',
]

/** Why one acceptance could not produce a verdict. */
export type VerificationErrorKind = 'route-unavailable' | 'timeout' | 'auth' | 'parse' | 'request' | 'aborted' | 'budget'

/**
 * The time one acceptance attempt may still spend.
 *
 * `deadline` is the instant the whole attempt runs out; `callTimeoutMs` is the
 * ceiling of a single judge call. The pair is what ties the retry budget to the
 * acceptance budget: a call is not started unless its own ceiling still fits
 * inside what is left, because starting one the outer budget will abort anyway
 * only burns wall time and turns a slow machine into an anomaly.
 */
export interface AcceptanceBudget {
  /** Absolute instant (ms epoch) the acceptance attempt runs out at. */
  deadline: number
  /** Ceiling of one judge call in milliseconds. */
  callTimeoutMs: number
  /** Clock the caller runs on, injected so tests drive it deterministically. */
  now: () => number
}

/** An acceptance anomaly: never a quality verdict, always recorded as one. */
export class VerificationError extends Error {
  constructor(
    readonly kind: VerificationErrorKind,
    message: string,
    readonly usage: VerificationUsage = emptyUsage(),
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'VerificationError'
  }
}

/** Fresh zeroed usage counters. */
export function emptyUsage(): VerificationUsage {
  return { calls: 0, inputTokens: 0, outputTokens: 0, reasoningTokens: 0 }
}

/** Whether a thrown error is worth one more request attempt. */
function retryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /rate|quota|timeout|timed out|temporar|network|fetch|socket|5\d\d|overload/i.test(message)
}

/** Redact one text in place, failing closed on an unusable pattern. */
function redact(text: string, patterns: readonly string[]): string {
  let result = text
  for (const pattern of patterns) {
    if (pattern.length === 0 || pattern.length > 500) continue
    // Reject nested/unbounded quantifiers that can backtrack catastrophically.
    if (/\([^)]*[+*][^)]*\)[+*{]|\.\*[+*{]|\.\+[+*{]/u.test(pattern)) continue
    try {
      result = result.replace(new RegExp(pattern, 'giu'), '[REDACTED]')
    } catch {
      // An unusable pattern is skipped rather than failing the acceptance.
    }
  }
  return result
}

/** Bound one text, keeping its tail: the newest output is what the judge grades. */
function boundTail(text: string, maxChars: number, notice: string): { text: string; omitted: number } {
  if (text.length <= maxChars) return { text, omitted: 0 }
  const omitted = text.length - maxChars
  const prefix = notice.replace('%d', String(omitted))
  if (prefix.length >= maxChars) return { text: text.slice(-maxChars), omitted }
  return { text: prefix + text.slice(-(maxChars - prefix.length)), omitted }
}

/** One rendered content block of a tool result or assistant message. */
function blockText(block: unknown): string {
  if (typeof block !== 'object' || block === null) return ''
  const row = block as Record<string, unknown>
  const type = row.type
  if (type === 'text' && typeof row.text === 'string') return row.text
  if (type === 'reasoning' && typeof row.text === 'string') return '[Reasoning] ' + row.text
  if (type === 'tool-call') return '[Tool Call] ' + String(row.name ?? '') + ' ' + String(row.arguments ?? '')
  if (type === 'tool-result') {
    const nested = Array.isArray(row.content) ? row.content : []
    return '[Tool Result] ' + nested.map(blockText).filter(part => part !== '').join('\n')
  }
  if (type === 'file') return '[File] ' + String(row.path ?? row.filename ?? row.title ?? 'attachment')
  return ''
}

/** Render one message's blocks as plain text. */
function messageText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content.map(blockText).filter(part => part !== '').join('\n')
}

/** Structural view of one session event, as the host log carries it. */
interface RawEvent {
  type?: unknown
  seq?: unknown
  time?: unknown
  data?: unknown
}

/** Read one session's events across the shapes the SDK cohort exposes. */
export function sessionEvents(session: unknown): readonly RawEvent[] {
  const candidate = session as { snapshotEvents?: () => readonly RawEvent[]; events?: readonly RawEvent[] } | undefined
  if (typeof candidate?.snapshotEvents === 'function') return candidate.snapshotEvents()
  return candidate?.events ?? []
}

/** Evidence assembled for one acceptance attempt. */
export interface AcceptanceEvidence {
  problem: string
  trace: string
  entries: number
  fromSeq?: number
  toSeq?: number
  omittedCharacters: number
  hash: string
}

/**
 * Assemble the evidence one acceptance judges.
 *
 * The window starts at the execution's own `startedAt`, never at the session's
 * first event: a reused session carries the history of earlier executions, and
 * those runs must not be judged as this one's work. Only observed output is
 * rendered — tool calls with their arguments and their results, assistant
 * prose, goal round markers and team messages — and the result is redacted and
 * capped before it ever reaches a judge.
 * @param session - the live session of the execution.
 * @param problem - the execution's composed prompt, shown as the task statement.
 * @param startedAt - the instant the execution opened (ms epoch).
 * @returns the bounded, redacted evidence.
 */
/**
 * The session events inside one execution's own window.
 *
 * A reused session carries the history of earlier executions; only the events
 * at or after this execution's start belong to the work being judged.
 * @param session - the live session.
 * @param startedAt - the execution's start instant (ms epoch).
 * @returns the events of this execution, oldest first.
 */
export function evidenceEvents(session: unknown, startedAt: number): readonly RawEvent[] {
  return sessionEvents(session).filter(event => typeof event.time !== 'number' || startedAt <= 0 || event.time >= startedAt)
}

export function collectEvidence(session: unknown, problem: string, startedAt: number): AcceptanceEvidence {
  const events = evidenceEvents(session, startedAt)
    .slice()
    .sort((a, b) => (typeof a.seq === 'number' && typeof b.seq === 'number' ? a.seq - b.seq : 0))
  const entries: string[] = []
  for (const event of events) {
    const data = (typeof event.data === 'object' && event.data !== null ? event.data : {}) as Record<string, unknown>
    const seq = typeof event.seq === 'number' ? event.seq : 0
    if (event.type === 'user/message') {
      const source = (typeof data.source === 'object' && data.source !== null ? data.source : {}) as Record<string, unknown>
      const kind = String(source.kind ?? '')
      if (kind !== 'user' && kind !== 'team-message' && kind !== 'goal') continue
      const label = kind === 'goal' ? 'Goal Round' : kind === 'team-message' ? 'Team Message' : 'User'
      entries.push('--- ' + label + ' seq ' + seq + ' ---\n' + messageText(data.content))
    } else if (event.type === 'assistant/message') {
      const message = (typeof data.message === 'object' && data.message !== null ? data.message : {}) as Record<string, unknown>
      entries.push('--- Assistant turn ' + String(data.turn ?? '?') + ' step ' + String(data.step ?? '?') + ' ---\n' + messageText(message.content))
    } else if (event.type === 'tool/call') {
      entries.push('--- Tool Call turn ' + String(data.turn ?? '?') + ' step ' + String(data.step ?? '?') + ' ---\n[Command] ' + String(data.name ?? '') + ' ' + String(data.arguments ?? ''))
    } else if (event.type === 'tool/result') {
      const message = (typeof data.message === 'object' && data.message !== null ? data.message : {}) as Record<string, unknown>
      const failed = message.isError === true ? ' [Error]' : ''
      entries.push('--- Tool Result' + failed + ' turn ' + String(data.turn ?? '?') + ' step ' + String(data.step ?? '?') + ' ---\n[Output] ' + messageText(message.content))
    } else if (event.type === 'tool/ptc-dispatch' || event.type === 'tool/code-dispatch') {
      const label = event.type === 'tool/ptc-dispatch' ? 'PTC Dispatch' : 'Code Dispatch'
      const status = data.isError === true ? ' [Error]' : ''
      const args = data.arguments === undefined ? '' : ' ' + (typeof data.arguments === 'string' ? data.arguments : JSON.stringify(data.arguments))
      entries.push('--- ' + label + ' ' + String(data.name ?? '') + status + ' seq ' + seq + ' ---\n[Command] ' + String(data.name ?? '') + args + '\n[Output] ' + messageText(data.content))
    } else if (event.type === 'team/message/queued') {
      const message = (typeof data.message === 'object' && data.message !== null ? data.message : {}) as Record<string, unknown>
      entries.push('--- Team Message Queued from ' + String(message.senderName ?? 'Teammate') + ' seq ' + seq + ' ---\n' + messageText(message.content))
    }
  }
  const bounded = entries
    .map(entry => entry.length <= VERIFICATION_MAX_ENTRY_CHARS ? entry : entry.slice(0, VERIFICATION_MAX_ENTRY_CHARS) + '\n[Entry truncated]')
    .filter(entry => entry.trim() !== '')
  const joined = redact(bounded.join('\n\n'), VERIFICATION_REDACT_PATTERNS)
  const window = boundTail(joined, VERIFICATION_MAX_TRACE_CHARS, '[Earlier trace truncated: %d characters omitted]\n')
  const problemText = redact(problem, VERIFICATION_REDACT_PATTERNS).trim()
  const hash = createHash('sha256').update(problemText).update('\u0000').update(window.text).digest('hex')
  const seqs = events.map(event => (typeof event.seq === 'number' ? event.seq : undefined)).filter((seq): seq is number => seq !== undefined)
  return {
    problem: problemText,
    trace: window.text,
    entries: bounded.length,
    ...(seqs.length === 0 ? {} : { fromSeq: Math.min(...seqs), toSeq: Math.max(...seqs) }),
    omittedCharacters: window.omitted,
    hash,
  }
}

/** One judge answer's parsed verdict. */
interface JudgeAnswer {
  scoreWork: number
  scoreBaseline: number
  findings: string[]
  usage: VerificationUsage
}

/**
 * One finding the judge reported, before its citation is resolved against the
 * evidence the judge actually saw.
 */
interface RawFinding {
  /** The criterion id this finding is attached to (always the caller's id). */
  criterionId: string
  /** The criterion name as the prompt offered it. */
  criterionName: string
  /** Which evidence block the citation claims to come from. */
  location: VerificationCriterionFinding['location']
  quote: string
  requirement: string
  observation: string
  gap: string
  body: string
  action?: string
}

/** How one cited slot maps onto the caller's own evidence under a swapped round. */
function locationOfSlot(slot: 'A' | 'B', round: number): VerificationCriterionFinding['location'] {
  // The odd round swaps the two slots: citing the slot the work occupies is a
  // citation of the work's own trajectory, and citing the other one is a
  // citation of the empty-work baseline, which can never veto the work.
  return slot === workSlotOfRound(round) ? 'trajectory' : 'baseline'
}

/** Resolve one `location` (or legacy `evidence`) attribute into an evidence location. */
function readLocation(raw: string, round: number): VerificationCriterionFinding['location'] | undefined {
  const value = raw.trim().toUpperCase()
  if (value === 'TASK') return 'task'
  if (value === 'CONTEXT' || value === 'WORKSPACE') return 'workspace'
  if (value === 'TRAJECTORY_A' || value === 'A') return locationOfSlot('A', round)
  if (value === 'TRAJECTORY_B' || value === 'B') return locationOfSlot('B', round)
  return undefined
}

/**
 * Parse the `<finding ...>` elements out of one judge answer.
 *
 * A finding must name the criterion this prompt offered and cite an evidence
 * location the prompt actually rendered; a finding for another criterion, a
 * citation of a location that was never offered, and an empty body are dropped
 * here rather than echoed back as if the judge had located something. The
 * quote is carried verbatim: whether it really occurs in the evidence it names
 * is decided by the caller, which is the only side holding the evidence text.
 */
function parseFindings(text: string, criterion: VerificationCriterion, round: number): RawFinding[] {
  const pattern = /<finding\s+([^>]*)>([\s\S]*?)<\/finding>/giu
  const attributes = /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]*)"/gu
  const found: RawFinding[] = []
  const seen = new Set<string>()
  for (let match = pattern.exec(text); match !== null && found.length < VERIFICATION_MAX_FINDINGS_PER_CALL; match = pattern.exec(text)) {
    const attrs = new Map<string, string>()
    for (let attribute = attributes.exec(match[1] ?? ''); attribute !== null; attribute = attributes.exec(match[1] ?? '')) {
      if (['criterion', 'evidence', 'location', 'requirement', 'observation', 'gap', 'quote', 'action'].includes(attribute[1] ?? '')) {
        attrs.set(attribute[1] ?? '', attribute[2] ?? '')
      }
    }
    const named = attrs.get('criterion') ?? ''
    // A finding must name the criterion this prompt offered; anything else is
    // dropped, never echoed.
    if (named !== '' && named.toLowerCase() !== criterion.name.toLowerCase() && named.toLowerCase() !== criterion.id.toLowerCase()) continue
    const location = readLocation(attrs.get('location') ?? attrs.get('evidence') ?? '', round)
    if (location === undefined) continue
    const quote = (attrs.get('quote') ?? '').trim().slice(0, VERIFICATION_MAX_QUOTE_CHARS)
    const requirement = (attrs.get('requirement') ?? '').trim().slice(0, VERIFICATION_MAX_PROBLEM_CHARS)
    const observation = (attrs.get('observation') ?? '').trim().slice(0, VERIFICATION_MAX_PROBLEM_CHARS)
    const gap = (attrs.get('gap') ?? '').trim().slice(0, VERIFICATION_MAX_PROBLEM_CHARS)
    const body = (match[2] ?? '').trim().slice(0, VERIFICATION_MAX_FINDING_CHARS)
    if (body === '' && quote === '') continue
    const action = (attrs.get('action') ?? '').trim().slice(0, 300)
    const key = criterion.id + '|' + location + '|' + quote + '|' + body
    if (seen.has(key)) continue
    seen.add(key)
    found.push({
      criterionId: criterion.id,
      criterionName: criterion.name,
      location,
      quote,
      requirement,
      observation,
      gap,
      body,
      ...(action === '' ? {} : { action }),
    })
  }
  return found
}

/** Render one finding as the single feedback line the agent reads. */
function renderFinding(finding: RawFinding): string {
  const locator = '[' + finding.criterionName + ' ' + finding.location + ']'
  const action = finding.action === undefined ? '' : ' → 建议核实：' + finding.action
  const detail = finding.body !== '' ? finding.body : finding.quote
  return locator + ' ' + detail + action
}

/**
 * One judge request's outcome.
 *
 * Every attempt is admitted against the acceptance budget first: a call whose
 * own ceiling no longer fits in the time left is refused before it is opened,
 * so a slow route cannot spend the whole acceptance budget on calls the outer
 * abort is going to kill anyway.
 */
async function judgeOnce(
  llm: LlmRuntime,
  route: VerificationRoute,
  prompt: string,
  signal: AbortSignal,
  budget: AcceptanceBudget,
): Promise<{ text: string; usage: VerificationUsage }> {
  const usage = emptyUsage()
  let lastError: unknown
  /** The outer abort is the acceptance budget running out, not a cancellation. */
  const stopped = (): VerificationError => budget.now() >= budget.deadline
    ? new VerificationError('budget', 'the acceptance budget ran out before the judge answered', usage)
    : new VerificationError('aborted', 'the acceptance was cancelled', usage)
  for (let attempt = 0; attempt < VERIFICATION_REQUEST_ATTEMPTS; attempt++) {
    if (signal.aborted) throw stopped()
    if (budget.deadline - budget.now() <= budget.callTimeoutMs) {
      throw new VerificationError('budget', 'the acceptance budget cannot fit another judge call', usage)
    }
    const timeout = new AbortController()
    const timer = setTimeout(() => { timeout.abort(new Error('task-board verification: the judge request timed out')) }, budget.callTimeoutMs)
    const forward = (): void => { timeout.abort(signal.reason) }
    signal.addEventListener('abort', forward, { once: true })
    try {
      // The judge dispatches through the registration-bound prepared call, the
      // same path the official agent loop uses: the public `stream()` is a
      // mutable instance property a third-party plugin may replace, and a
      // replacement with the `llm/stream` listener signature broke every
      // acceptance with "next(...) is not a function or its return value is not
      // async iterable".
      const stream = await openOneShotStream(
        llm,
        {
          provider: route.provider,
          model: route.model,
          ...(route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort }),
          temperature: VERIFICATION_TEMPERATURE,
          maxTokens: VERIFICATION_MAX_TOKENS,
        },
        {
          messages: [createUserMessage({ content: [{ type: 'text' as const, text: prompt }], source: { kind: 'user' as const } })],
          signal: timeout.signal,
        },
      )
      let text = ''
      usage.calls += 1
      let finishReason: FinishReason | undefined
      for await (const chunk of stream) {
        const row = chunk as unknown as Record<string, unknown>
        if (row.type === 'text-delta' && typeof row.text === 'string') text += row.text
        else if (row.type === 'usage') {
          const reported = (typeof row.usage === 'object' && row.usage !== null ? row.usage : {}) as Record<string, unknown>
          usage.inputTokens += typeof reported.inputTokens === 'number' ? reported.inputTokens : 0
          usage.outputTokens += typeof reported.outputTokens === 'number' ? reported.outputTokens : 0
          usage.reasoningTokens += typeof reported.reasoningTokens === 'number' ? reported.reasoningTokens : 0
        } else if (row.type === 'finish') {
          finishReason = chunk.type === 'finish' ? chunk.reason : undefined
        }
      }
      if (signal.aborted) throw stopped()
      if (timeout.signal.aborted) throw new VerificationError('timeout', 'the judge request timed out', usage)
      if (finishReason?.kind === 'error' || finishReason?.kind === 'aborted') {
        const failure = finishReason.failure
        const message = redact([failure.code, failure.status, failure.message].filter(value => value !== undefined).join(': '), VERIFICATION_REDACT_PATTERNS).slice(0, 2_000)
        const kind = finishReason.kind === 'aborted' ? 'aborted'
          : failure.status === 401 || failure.status === 403 ? 'auth' : 'request'
        throw new VerificationError(kind, message, usage)
      }
      if (finishReason?.kind === 'max-tokens') {
        throw new VerificationError('parse', 'the judge answer hit the output ceiling (' + VERIFICATION_MAX_TOKENS + ' tokens) and carries no usable verdict', usage)
      }
      if (text.trim() === '') {
        throw new VerificationError('parse', 'the judge returned an empty answer', usage)
      }
      try {
        extractScore(text, 'score_A')
        extractScore(text, 'score_B')
      } catch {
        throw new VerificationError('parse', 'the judge answer did not contain valid score_A and score_B A-T scores', usage)
      }
      return { text, usage }
    } catch (error) {
      lastError = error
      if (error instanceof VerificationError && (error.kind === 'aborted' || error.kind === 'auth')) throw error
      if (signal.aborted) throw stopped()
      if (timeout.signal.aborted) {
        lastError = new VerificationError('timeout', 'the judge request timed out after ' + Math.round(budget.callTimeoutMs / 1000) + 's', usage)
      }
      const parseFailure = lastError instanceof VerificationError && lastError.kind === 'parse'
      if (attempt + 1 >= VERIFICATION_REQUEST_ATTEMPTS || (!parseFailure && !retryable(lastError))) break
      if (!parseFailure) usage.usageIncomplete = true
      await new Promise(resolve => { setTimeout(resolve, 500 * (attempt + 1)) })
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', forward)
    }
  }
  const failure = lastError
  if (failure instanceof VerificationError) throw new VerificationError(failure.kind, failure.message, usage)
  const message = failure instanceof Error ? failure.message : String(failure)
  const kind: VerificationErrorKind = /401|403|unauthor|api key|forbidden|credential/i.test(message) ? 'auth' : 'request'
  throw new VerificationError(kind, message, usage)
}

/** The verdict of one acceptance attempt. */
export interface AcceptanceResult {
  attempt: VerificationAttempt
}

/**
 * Run one acceptance: every criterion is judged twice, the odd round with the
 * A/B slots swapped, and the per-round scores are mapped back and averaged per
 * criterion.
 * @param input - the judge route, evidence, threshold, time budget and cancellation.
 * @returns the recorded attempt (quality verdict, anomaly, or budget stop).
 */
export async function runAcceptance(input: {
  llm: LlmRuntime
  route: VerificationRoute
  evidence: AcceptanceEvidence
  threshold: number
  index: number
  signal: AbortSignal
  /** Instant (ms epoch) the attempt runs out at; defaults to now plus the default budget. */
  deadline?: number
  /** Ceiling of one judge call; defaults to {@link VERIFICATION_CALL_TIMEOUT_MS}. */
  callTimeoutMs?: number
  /** Host-observed workspace changes, rendered as the prompt's reference context. */
  context?: string
  /** How many changed files that context shows. */
  workspaceFiles?: number
  now?: () => number
}): Promise<AcceptanceResult> {
  const now = input.now ?? Date.now
  const startedAt = now()
  const budget: AcceptanceBudget = {
    deadline: input.deadline ?? startedAt + DEFAULT_VERIFICATION_BUDGET_MS,
    callTimeoutMs: input.callTimeoutMs ?? VERIFICATION_CALL_TIMEOUT_MS,
    now,
  }
  const usage = emptyUsage()
  const evidenceSummary: VerificationEvidenceSummary = {
    chars: input.evidence.trace.length,
    omittedCharacters: input.evidence.omittedCharacters,
    entries: input.evidence.entries,
    hash: input.evidence.hash,
    ...(input.evidence.fromSeq === undefined ? {} : { fromSeq: input.evidence.fromSeq }),
    ...(input.evidence.toSeq === undefined ? {} : { toSeq: input.evidence.toSeq }),
    ...(input.workspaceFiles === undefined || input.workspaceFiles <= 0 ? {} : { workspaceFiles: input.workspaceFiles }),
  }
  const findings: string[] = []
  const seenFindings = new Set<string>()
  const structured: VerificationCriterionFinding[] = []
  const seenStructured = new Set<string>()
  // The exact evidence texts this acceptance handed to the judge, retained so
  // the validity check can verify every citation against what was really shown.
  const evidenceText: AcceptanceEvidenceText = {
    task: input.evidence.problem,
    trajectory: input.evidence.trace,
    workspace: input.context ?? '',
  }
  try {
    const perCriterion = new Map<string, { criterion: VerificationCriterion; work: number[]; baseline: number[] }>()
    for (const criterion of CODING_CRITERIA) perCriterion.set(criterion.id, { criterion, work: [], baseline: [] })
    for (const criterion of CODING_CRITERIA) {
      for (let repeat = 0; repeat < VERIFICATION_ROUNDS; repeat++) {
        const swapped = repeat % 2 === 1
        const candidateA = swapped ? EMPTY_WORK_BASELINE : input.evidence.trace
        const candidateB = swapped ? input.evidence.trace : EMPTY_WORK_BASELINE
        const prompt = buildAcceptancePrompt(input.evidence.problem, candidateA, candidateB, criterion, undefined, input.context, workSlotOfRound(repeat))
        const answer = await judgeOnce(input.llm, input.route, prompt, input.signal, budget)
        const scoreA = extractScore(answer.text, 'score_A')
        const scoreB = extractScore(answer.text, 'score_B')
        if (answer.usage.usageIncomplete === true) usage.usageIncomplete = true
        usage.calls += answer.usage.calls
        usage.inputTokens += answer.usage.inputTokens
        usage.outputTokens += answer.usage.outputTokens
        usage.reasoningTokens += answer.usage.reasoningTokens
        const bucket = perCriterion.get(criterion.id)!
        bucket.work.push(swapped ? scoreB : scoreA)
        bucket.baseline.push(swapped ? scoreA : scoreB)
        for (const finding of parseFindings(answer.text, criterion, repeat)) {
          if (structured.length < VERIFICATION_MAX_FINDINGS) {
            const key = finding.criterionId + '|' + finding.location + '|' + finding.quote + '|' + finding.body
            if (!seenStructured.has(key)) {
              seenStructured.add(key)
              structured.push({
                criterionId: finding.criterionId,
                requirement: finding.requirement !== '' ? finding.requirement : finding.criterionName,
                observation: finding.observation !== '' ? finding.observation : finding.body,
                gap: finding.gap !== '' ? finding.gap : finding.body,
                quote: finding.quote,
                location: finding.location,
                ...(finding.action === undefined ? {} : { action: finding.action }),
              })
            }
          }
          const line = renderFinding(finding)
          if (seenFindings.has(line)) continue
          seenFindings.add(line)
          if (findings.length < VERIFICATION_MAX_FINDINGS) findings.push(line)
        }
      }
    }
    const criteria: VerificationCriterionScore[] = CODING_CRITERIA.map(criterion => {
      const bucket = perCriterion.get(criterion.id)!
      const score = average(bucket.work)
      const baseline = average(bucket.baseline)
      return { id: criterion.id, name: criterion.name, score, baseline, threshold: input.threshold, passed: score >= input.threshold }
    })
    const score = average(criteria.map(criterion => criterion.score))
    const baseline = average(criteria.map(criterion => criterion.baseline))
    const passed = acceptancePassed(score, baseline, criteria, input.threshold)
    // A veto is only bookable when its evidence holds up; a rejecting attempt
    // that cannot substantiate the rejection is recorded as INVALID so it can
    // never consume the quality budget or fail the card.
    const validity = passed
      ? { valid: true as const }
      : assessAcceptanceValidity({
        criteria,
        findings: structured,
        evidence: evidenceText,
        omittedCharacters: input.evidence.omittedCharacters,
      })
    return {
      attempt: {
        index: input.index,
        at: startedAt,
        stage: validity.valid ? 'quality' : 'invalid',
        passed: validity.valid ? passed : false,
        score,
        baseline,
        criteria,
        findings,
        usage,
        evidence: evidenceSummary,
        route: input.route,
        channel: 'explicit-tag',
        rounds: VERIFICATION_ROUNDS,
        ...(structured.length === 0 ? {} : { criterionFindings: structured }),
        ...(validity.valid ? {} : {
          invalidReason: (validity as { reason: VerificationInvalidReason }).reason,
          error: classifyInvalid(validity as { reason: VerificationInvalidReason; detail: string }),
        }),
      },
    }
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error))
    const kind = failure instanceof VerificationError ? failure.kind : 'request'
    const merged = mergeUsage(usage, failure instanceof VerificationError ? failure.usage : emptyUsage())
    return {
      attempt: {
        index: input.index,
        at: startedAt,
        // A budget stop is its own stage: the time ran out before any verdict,
        // which is neither a judgement of the work nor an anomaly of the
        // judge route, so it is charged to no budget.
        stage: kind === 'budget' ? 'budget' : 'exception',
        passed: false,
        score: 0,
        baseline: 0,
        criteria: [],
        findings,
        usage: merged,
        evidence: evidenceSummary,
        route: input.route,
        channel: 'explicit-tag',
        rounds: VERIFICATION_ROUNDS,
        error: classifyMessage(kind, failure.message),
      },
    }
  }
}

/** Average of a list, 0 when empty. */
function average(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((total, value) => total + value, 0) / values.length
}

/** Fold one usage record into another. */
function mergeUsage(target: VerificationUsage, source: VerificationUsage): VerificationUsage {
  return {
    calls: target.calls + source.calls,
    inputTokens: target.inputTokens + source.inputTokens,
    outputTokens: target.outputTokens + source.outputTokens,
    reasoningTokens: target.reasoningTokens + source.reasoningTokens,
    ...(target.usageIncomplete === true || source.usageIncomplete === true ? { usageIncomplete: true } : {}),
  }
}

/** Prefix one invalid-acceptance message with its class so the report stays actionable. */
function classifyInvalid(validity: { reason: VerificationInvalidReason; detail: string }): string {
  const labels: Record<VerificationInvalidReason, string> = {
    'missing-finding': '验收无效（未达标判据没有对应的结构化问题反馈）',
    'unlocatable-quote': '验收无效（问题反馈引用不存在于本次裁判所见的证据中）',
    'baseline-finding': '验收无效（问题反馈指向空工作基线而非本次工作）',
    'vacuous-finding': '验收无效（问题反馈空泛，未说明实际观测与差异）',
    'insufficient-evidence': '验收无效（裁判所见证据不足，无法支撑否决）',
  }
  return labels[validity.reason] + ': ' + validity.detail
}

/** Prefix one anomaly message with its class so the report stays actionable. */
function classifyMessage(kind: VerificationErrorKind, message: string): string {
  const labels: Record<VerificationErrorKind, string> = {
    'route-unavailable': '验收异常（裁判路由不可用）',
    timeout: '验收异常（裁判超时）',
    auth: '验收异常（鉴权失败）',
    parse: '验收异常（裁判回答无法解析）',
    request: '验收异常（裁判请求失败）',
    aborted: '验收异常（验收被取消）',
    budget: '验收未完成（时间预算耗尽，未产生任何判定，不计入异常额度）',
  }
  return labels[kind] + ': ' + message
}



