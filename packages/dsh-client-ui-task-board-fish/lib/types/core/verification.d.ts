/**
 * Goal acceptance domain: the board's evaluator-backed certification layer for
 * task executions that run in goal form.
 *
 * The board owns WHEN acceptance runs (the goal's completion gate), the
 * per-cycle budget, the feedback it returns, the settlement rule and the
 * report. The algorithm it runs is the DEFAULT final acceptance of the
 * installed `dsh-llm-verifier` 0.8.4 (MIT), mirrored here rather than imported:
 * that plugin is a third-party plugin, not a dependency of this repository, and
 * a host half may only depend on the official `@deepseek-ai/*` SDK.
 *
 * Mirrored contract, byte-identical where the judge prompt depends on it:
 * the three coding criteria of `DEFAULT_CRITERIA` (`CRITERIA_PRESETS.coding`),
 * the 20-letter A-T scale, the required `<score_A>`/`<score_B>` verdict tags,
 * the untrusted-evidence framing, `EMPTY_WORK_BASELINE` as candidate B, two
 * rounds per criterion with the A/B slots swapped on the odd round, per-round
 * scores mapped back to the caller's slots and averaged per criterion, and the
 * pass rule `winner === 'A' && total >= threshold && every criterion >= threshold`.
 *
 * This module is framework-free (no cordis, no SDK imports) so the whole rule
 * set is unit-testable in isolation; the model call itself lives in the host
 * half (`src/host/verification-runner.ts`).
 */
/** Schema version of the persisted verification block (per execution record). */
export declare const VERIFICATION_SCHEMA_VERSION: 1;
/** Acceptance threshold mirrored from the verifier's `autoVerifyThreshold` default. */
export declare const VERIFICATION_THRESHOLD = 0.65;
/** Rounds per criterion: the verifier's `autoVerifyFinalRepeats` default. */
export declare const VERIFICATION_ROUNDS = 2;
/**
 * Quality acceptances one goal completion cycle may spend: the first verdict,
 * then one re-verification after the agent repaired the work. A second failure
 * ends the cycle (see {@link MAX_EXCEPTION_ATTEMPTS} for the separate anomaly
 * budget).
 */
export declare const MAX_QUALITY_ATTEMPTS = 2;
/**
 * Anomaly budget of one cycle. A timeout, an authentication failure or an
 * unparseable judge answer is not a quality verdict, so it never consumes a
 * quality attempt.
 *
 * Reaching it does NOT judge the card: an unusable judge route is a property of
 * the environment, not of the work, so a card must never be failed for it. The
 * gate instead HOLDS the cycle open and runs no further judge call until the
 * recorded anomalies are cleared by an explicit user action (see
 * {@link withoutAcceptanceAnomalies}), which is what keeps the bound: one cycle
 * spends at most this many judge rounds, and clearing them is a human decision.
 */
export declare const MAX_EXCEPTION_ATTEMPTS = 2;
/**
 * Retries of an INVALID acceptance: a quality veto whose required evidence is
 * missing, unlocatable, or aimed at the empty-work baseline is not a judgement
 * of the work, so it is recorded in its own stage and spent against this
 * bound instead of the quality budget. Reaching it stops the judge calls and
 * HOLDS the cycle for a human, exactly like a spent anomaly budget: an
 * evidence-free veto must never fail a card, and it must never re-run forever.
 */
export declare const MAX_INVALID_ATTEMPTS = 2;
/**
 * Capacity bound of the per-attempt acceptance detail — the repair/review
 * material the acceptance mechanism itself creates. It is deliberately the
 * ONLY large acceptance-only material this mechanism persists: findings are
 * capped in count and rendered size, so nothing here needs an extra full
 * evidence copy. It is removed by the automatic cleanup once the execution
 * passed and settled (see {@link withAcceptanceDetailCleared}).
 */
export declare const VERIFICATION_DETAIL_MAX_FINDINGS = 12;
/** Longest verbatim citation kept from one judge finding. */
export declare const VERIFICATION_DETAIL_MAX_QUOTE_CHARS = 600;
/** Longest rendered detail kept for one attempt, across every finding. */
export declare const VERIFICATION_DETAIL_MAX_CHARS = 16000;
/**
 * Shortest citation a veto may rest on. A one- or two-character quote matches
 * almost any trace, so it cannot locate anything.
 */
export declare const VERIFICATION_MIN_QUOTE_CHARS = 12;
/** Shortest requirement/observation/gap text that states a real difference. */
export declare const VERIFICATION_MIN_PROBLEM_CHARS = 4;
/**
 * Longest criterion identifier one persisted finding may name. An identifier,
 * not prose: the reader rejects anything longer instead of clipping it, because
 * a mangled id would silently detach the finding from the criterion it judges.
 */
export declare const VERIFICATION_DETAIL_MAX_CRITERION_ID_CHARS = 64;
/**
 * Longest requirement / observation / gap / suggested-action text one finding
 * keeps. Shared by the WRITER (which clips the judge's attributes to it) and the
 * READER (which clips a hand-edited document back to it), so the acceptance
 * detail has one capacity bound rather than two that can drift.
 */
export declare const VERIFICATION_DETAIL_MAX_PROBLEM_CHARS = 400;
/**
 * Attempts one execution's acceptance cleanup may spend. Cleanup is started
 * only after the pass record and the settlement are durable, is idempotent,
 * and a failure never revokes the pass; the bound keeps a permanently failing
 * filesystem from retrying forever, and the Host retries the remainder on its
 * next start.
 */
export declare const MAX_CLEANUP_ATTEMPTS = 3;
/** The fixed baseline a session acceptance measures itself against. */
export declare const EMPTY_WORK_BASELINE = "(No useful work or verification was performed.)";
/** Ground-truth note prepended to every judge prompt. */
export declare const DEFAULT_GROUND_TRUTH_NOTE = "**IMPORTANT:** Focus on observed tool and terminal output as ground truth. Do NOT trust the agent's self-assessment or claims of success.";
/** Injected-content guardrail shared by every judge prompt. */
export declare const UNTRUSTED_EVIDENCE_NOTE: string;
/** Role sentence for a completed-artifact review of a coding task. */
export declare const EVALUATOR_ROLE = "You are an expert evaluator of AI coding agents. You will see a task description and two agent trajectories, then evaluate them on ONE specific criterion, stated at the end.";
/** The 20-point A-T scale, mirrored from the verifier. */
export declare const GRANULARITY = 20;
/** One criterion of the coding rubric. */
export interface VerificationCriterion {
    id: string;
    name: string;
    description: string;
}
/** The coding rubric, identical to the verifier's `DEFAULT_CRITERIA`. */
export declare const CODING_CRITERIA: readonly VerificationCriterion[];
/** Rating scale text rendered into every judge prompt. */
export declare const SCALE_DESCRIPTION: string;
/**
 * Which trajectory slot holds the WORK during one round.
 *
 * The even round (0) puts the work in slot A and the empty-work baseline in
 * slot B; the odd round (1) swaps them, which is how the acceptance cancels
 * position bias. The judge prompt ALWAYS introduces the work as
 * `location="TRAJECTORY_B"`, because that is the slot the work occupies in the
 * prompt's own framing; the parser maps the cited slot back through this table.
 * @param round - the round index (0-based).
 * @returns the slot letter the work occupies in that round.
 */
export declare function workSlotOfRound(round: number): 'A' | 'B';
/** A-T letters in scale order (A = best). */
export declare const LETTERS: readonly string[];
/**
 * Normalize one score token to an A-T letter.
 * @param token - the raw captured token.
 * @returns the uppercase letter, or undefined when it is not one of A-T.
 */
export declare function normalizeScoreLetter(token: string): string | undefined;
/** Numeric value of one A-T letter (A = 20 ... T = 1). */
export declare function letterValue(letter: string): number;
/**
 * Read the LAST `<tag> LETTER </tag>` verdict out of one judge answer.
 *
 * The tag contract is the verifier's explicit-tag channel: this deployment's
 * only scoring channel, because the official DSH adapters expose no token
 * logprobs (the verifier's direct top-logprob transport needs a capability the
 * public SDK does not carry). A missing or unusable tag is an exception, never
 * a score: the verdict stays fail-closed.
 * @param text - the raw judge answer.
 * @param tag - the tag name, e.g. `score_A`.
 * @returns the score in 0..1 (A = 1.0, T = 0.0).
 * @throws Error when the answer carries no valid A-T verdict for this tag.
 */
export declare function extractScore(text: string, tag: string): number;
/**
 * Render one untrusted content block with deterministic nonce-tagged delimiters.
 * @param tag - block tag.
 * @param token - content-derived delimiter token.
 * @param content - the untrusted content.
 * @returns the wrapped block.
 */
export declare function renderDelimitedBlock(tag: string, token: string, content: string): string;
/**
 * Deterministic per-prompt delimiter token (FNV-1a, same construction as the
 * verifier's). Not random: the token must depend on the whole content so that
 * identical inputs render an identical prompt while injected text cannot
 * predict the terminator.
 * @param parts - the content parts.
 * @returns a short base-36 token.
 */
export declare function evidenceNonce(...parts: readonly string[]): string;
/**
 * One pairwise judge prompt focused on a single criterion.
 *
 * Everything that does not depend on the criterion comes first and only the
 * criterion varies at the tail, so a prefix-caching backend serves the
 * evidence-heavy body from cache across the criteria of one acceptance.
 * @param problem - the task statement.
 * @param traceA - candidate A's trajectory.
 * @param traceB - candidate B's trajectory.
 * @param criterion - the criterion this call scores.
 * @param groundTruthNote - note prepended to every judge prompt.
 * @param context - optional reference context (the host's own record of what
 *   changed on disk), rendered as its own data-only block between the task and
 *   the two candidates. Omitted renders nothing, which keeps the prompt
 *   byte-identical for a deployment that serves no change service.
 * @returns the rendered prompt.
 */
export declare function buildAcceptancePrompt(problem: string, traceA: string, traceB: string, criterion: VerificationCriterion, groundTruthNote?: string, context?: string, 
/**
 * The trajectory slot that holds the WORK this round. The judge is told the
 * slot explicitly, so the citation it returns names the work whichever way
 * the A/B slots were arranged. Defaults to A (round 0's arrangement).
 */
workSlot?: 'A' | 'B'): string;
/** Where the judge route of one execution came from. */
export type VerificationRouteSource = 'inherit' | 'explicit';
/** The resolved judge route of one execution's acceptance. */
export interface VerificationRoute {
    provider: string;
    model: string;
    reasoningEffort?: string;
}
/** One reasoning-effort option an adapter exposes for an exact model route. */
export interface CatalogReasoningEffort {
    id: string;
    name?: string;
}
/** One adapter-discovered model of the host catalog. */
export interface CatalogModel {
    id: string;
    name?: string;
    reasoning?: {
        efforts: CatalogReasoningEffort[];
        defaultEffort?: string;
    };
}
/** One provider route and its models. */
export interface CatalogGroup {
    id: string;
    name?: string;
    models: CatalogModel[];
}
/** The host model catalog the acceptance settings resolve against. */
export interface ModelCatalogView {
    /** The route an unconfigured session starts at: the host's own configuration. */
    default?: VerificationRoute;
    groups: CatalogGroup[];
}
/** The acceptance settings as the configuration holds them. */
export interface VerificationSettings {
    enabled: boolean;
    /** Qualified provider/model route, or '' to inherit the host default. */
    model: string;
    /** Reasoning effort id, or '' to inherit. */
    reasoningEffort: string;
}
/** The acceptance configuration frozen when one execution started. */
export interface VerificationContract {
    /** Whether acceptance is required for this execution (the switch at start time). */
    enabled: boolean;
    /** Whether the judge model came from the host default or from configuration. */
    modelSource: VerificationRouteSource;
    /** Resolved judge route; absent when the deployment serves no model catalog. */
    route?: VerificationRoute;
    /** The reasoning effort configuration asked for, when it named one. */
    requestedEffort?: string;
    /**
     * Set when an explicitly configured reasoning effort is not supported by the
     * resolved model: the incompatible value is NOT sent, and the acceptance runs
     * on `resolved` (the model's own default when that is defined).
     */
    effortFallback?: {
        requested: string;
        resolved?: string;
    };
    /** Rubric preset. The first version always judges with the coding criteria. */
    preset: 'coding';
    /** Acceptance threshold frozen with the contract. */
    threshold: number;
}
/** One criterion's verdict inside an acceptance attempt. */
export interface VerificationCriterionScore {
    id: string;
    name: string;
    /** Score of the task's own work (0..1). */
    score: number;
    /** Score of the empty-work baseline in the same comparison. */
    baseline: number;
    threshold: number;
    passed: boolean;
}
/** Token accounting of one acceptance attempt. */
export interface VerificationUsage {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    /** At least one call's usage was unknown; the counts are a floor. */
    usageIncomplete?: boolean;
}
/** Scope of the evidence one attempt judged. */
export interface VerificationEvidenceSummary {
    /** Characters handed to the judge after redaction. */
    chars: number;
    /** Characters dropped by the total cap (the newest text is kept). */
    omittedCharacters: number;
    /** Trace entries rendered. */
    entries: number;
    /** Sequence window the evidence was read from. */
    fromSeq?: number;
    toSeq?: number;
    /** Digest of the judged evidence; the pass record is bound to it. */
    hash: string;
    /** Files of host-observed workspace changes rendered into the prompt (0 = none). */
    workspaceFiles?: number;
}
/**
 * One judge finding, structured against the requirement it vetoes.
 *
 * The acceptance only counts a criterion as vetoed when the judge names that
 * criterion, states the requirement, the observation and the difference, and
 * cites a passage that really occurs in THIS acceptance's evidence (the task
 * text, the candidate's own trajectory, or the host's workspace record). A
 * finding that names the empty-work baseline, another criterion, or a passage
 * that is not in the reviewed evidence is dropped here, so it can never become
 * the evidence for a veto.
 */
export interface VerificationCriterionFinding {
    /** Criterion id this finding vetoes. */
    criterionId: string;
    /** The requirement the criterion demands of the work. */
    requirement: string;
    /** What was actually observed in the evidence. */
    observation: string;
    /** The difference: why that observation does not satisfy the requirement. */
    gap: string;
    /** Verbatim citation from the evidence; verified to occur in it. */
    quote: string;
    /**
     * Which part of the reviewed evidence the citation was located in.
     * `baseline` means the judge cited the empty-work baseline, which is never
     * the work's own evidence and can never veto a criterion.
     */
    location: 'task' | 'trajectory' | 'workspace' | 'baseline' | 'unknown';
    /** Optional suggested action from the judge. */
    action?: string;
}
/** Why an acceptance produced no valid quality verdict. */
export type VerificationInvalidReason = 
/** The failing criteria have no structured finding of their own. */
'missing-finding'
/** A finding's citation does not occur in the evidence the judge saw. */
 | 'unlocatable-quote'
/** A finding vetoes the empty-work baseline instead of the work. */
 | 'baseline-finding'
/** A finding's text is empty or a generic evaluation. */
 | 'vacuous-finding'
/** The judged evidence was truncated and cannot substantiate the veto. */
 | 'insufficient-evidence';
/** One recorded acceptance attempt: a quality verdict, an anomaly, a budget stop, or an invalid veto. */
export interface VerificationAttempt {
    /** 1-based ordinal within its own stage. */
    index: number;
    /** When the attempt ran (ms epoch). */
    at: number;
    /**
     * `budget` records an acceptance the time budget ended before it could
     * reach a verdict. It is neither a quality verdict nor an environment
     * anomaly: the judge route may be perfectly healthy, the machine simply had
     * no time left, so it is charged to no budget at all and cleared by the same
     * explicit user action that clears anomalies.
     *
     * `invalid` records an acceptance that produced no usable quality verdict
     * because the veto's required evidence was missing, unlocatable, or aimed at
     * the empty-work baseline. It is neither a judgement of the work nor an
     * environment anomaly: it consumes its own bounded retry budget, fails
     * nothing, and is cleared by the same explicit user action that clears
     * anomalies.
     */
    stage: 'quality' | 'exception' | 'budget' | 'invalid';
    /** Quality: whether the work passed. A recorded anomaly is never a pass. */
    passed: boolean;
    /** Total score of the task's own work (0 for an anomaly). */
    score: number;
    /** Score of the empty-work baseline. */
    baseline: number;
    criteria: VerificationCriterionScore[];
    /** Bounded, locatable feedback for the agent. */
    findings: string[];
    usage: VerificationUsage;
    evidence: VerificationEvidenceSummary;
    route: VerificationRoute;
    /** Scoring channel that answered. This deployment serves explicit tags only. */
    channel: 'explicit-tag';
    rounds: number;
    /** Anomaly reason; absent on a quality verdict. */
    error?: string;
    /**
     * Structured, locatable findings of a QUALITY attempt, keyed by criterion.
     * A veto is only counted when the failing criterion appears here with a
     * verified citation; otherwise the attempt is recorded as invalid instead.
     */
    criterionFindings?: VerificationCriterionFinding[];
    /** Why an invalid attempt carried no usable verdict; absent on other stages. */
    invalidReason?: VerificationInvalidReason;
}
/** Persisted acceptance state of one execution. */
export interface ExecutionVerification {
    contract: VerificationContract;
    attempts: VerificationAttempt[];
    /** True while an acceptance is running, so the board can show 验收中. */
    inFlight?: boolean;
    /**
     * Why this execution may not settle as succeeded without a pass record:
     * `disabled` when the switch was off at start, `skipped` when the CARD opted
     * out of the gate (`TaskRecord.skipVerification`), `goal-unavailable` when
     * the run never became a goal run (so no completion gate could ever fire),
     * and `team-member` for a teammate execution (the Lead's acceptance covers
     * the team's aggregated evidence), and `goal-disabled` when the GLOBAL
     * native /goal switch was off at start, so this execution never became a
     * goal run and its completion gate can never fire.
     */
    applicability: 'enforced' | 'disabled' | 'skipped' | 'goal-unavailable' | 'team-member' | 'goal-disabled';
    /** Set when the cycle is spent and the execution must fail. */
    failedReason?: string;
    failedAt?: number;
    /**
     * Retention record of the acceptance-only detail this execution created.
     *
     * An execution that PASSED and settled has its bulky acceptance-only material
     * (attempt findings, invalid diagnostics, judge metadata beyond the audit
     * summary) removed automatically; this record is the lightweight audit trail
     * that proves the cleanup happened and preserves the minimal credential
     * (verdict, scores, time, model, evidence hash) the completion gate needs.
     * Absent means nothing has been cleaned for this execution.
     */
    cleanup?: AcceptanceCleanupRecord;
}
/** Permanent, lightweight acceptance credential kept after a passed execution settles. */
export interface AcceptanceAuditRecord {
    /** Stage of the attempt the credential describes. */
    stage: VerificationAttempt['stage'];
    /** Whether the attempt passed. */
    passed: boolean;
    /** When the attempt ran (ms epoch). */
    at: number;
    /** Total score of the task's own work. */
    score: number;
    /** Empty-work baseline score. */
    baseline: number;
    /** Per-criterion scores and thresholds. */
    criteria: VerificationCriterionScore[];
    /** Digest of the judged evidence; binds the pass record to what was reviewed. */
    evidenceHash: string;
    /** Judge route of the attempt. */
    route: VerificationRoute;
    /** Anomaly or invalid reason, when the attempt carried one. */
    error?: string;
    /** One-line problem summary kept for the audit trail. */
    findingSummary?: string;
    /** Token accounting of the attempt. */
    usage: VerificationUsage;
}
/**
 * State of the automatic acceptance-detail cleanup of one execution.
 *
 * `state` is `pending` until the cleanup actually removed the detail (or found
 * nothing left to remove); `failed` records the last failure so a Host restart
 * can retry it. The pass record and the settlement are durable before a cleanup
 * starts, so a failure here never revokes a valid pass.
 */
export interface AcceptanceCleanupRecord {
    state: 'pending' | 'cleaned' | 'failed';
    /** Attempts spent; bounded by {@link MAX_CLEANUP_ATTEMPTS}. */
    attempts: number;
    /** When the cleanup first ran (ms epoch). */
    startedAt: number;
    /** When the detail was actually removed (ms epoch); absent while pending. */
    cleanedAt?: number;
    /** Why the last attempt failed; absent when none did. */
    lastError?: string;
    /** Minimal credential kept for every attempt this execution recorded. */
    audit: AcceptanceAuditRecord[];
}
/**
 * UI/board phase of one execution's acceptance.
 *
 * `invalid` is its own phase, not a variant of `failed`: the cycle spent its
 * invalid-acceptance budget without a usable veto, so the judge is no longer
 * called and a human decision is required. A reader must never read it as a
 * quality rejection.
 */
export type VerificationPhase = 'off' | 'executing' | 'verifying' | 'repairing' | 'passed' | 'failed' | 'invalid';
/** Quality attempts spent by this cycle. */
export declare function qualityAttempts(verification: ExecutionVerification | undefined): VerificationAttempt[];
/** Anomaly attempts spent by this cycle. */
export declare function exceptionAttempts(verification: ExecutionVerification | undefined): VerificationAttempt[];
/**
 * Attempts the time budget ended before a verdict, charged to no budget. They
 * are kept so the report can say WHY an acceptance produced nothing, and they
 * are cleared by the same explicit user action that clears anomalies.
 */
export declare function budgetAttempts(verification: ExecutionVerification | undefined): VerificationAttempt[];
/**
 * Invalid acceptances spent by this cycle: a veto whose required evidence was
 * missing, unlocatable, or aimed at the empty-work baseline. They are NOT
 * quality verdicts, so they never close the cycle and never fail the card; the
 * bound is what keeps an evidence-free judge from re-running forever.
 */
export declare function invalidAttempts(verification: ExecutionVerification | undefined): VerificationAttempt[];
/** Whether this cycle still has invalid-acceptance budget left. */
export declare function hasInvalidBudget(verification: ExecutionVerification | undefined): boolean;
/**
 * The acceptance block with every non-quality attempt dropped: the explicit
 * reset a user performs after fixing the environment (issue #1828).
 *
 * Only attempts that are not a quality verdict are dropped. A quality verdict
 * is the board's own judgement of the work and survives every reset, so this
 * can never buy an extra acceptance or re-open a judged failure; it only lets
 * the environment be judged again.
 * @param verification - the persisted acceptance state.
 * @returns the cleared block, or undefined when there is nothing to clear.
 */
export declare function withoutAcceptanceAnomalies(verification: ExecutionVerification): ExecutionVerification | undefined;
/**
 * The one-line problem summary a cleaned execution keeps: the failing criteria
 * with their scores, plus how many locatable findings were removed. This is the
 * lightweight audit material that survives the detail cleanup.
 * @param attempt - the attempt whose detail is being removed.
 * @returns the bounded summary line.
 */
export declare function findingSummaryOf(attempt: VerificationAttempt): string | undefined;
/**
 * The audit credential of one attempt: everything the completion gate, the
 * report and a later review need, and nothing that makes the ledger heavy.
 * @param attempt - the attempt being condensed.
 * @returns the lightweight audit record.
 */
export declare function auditOf(attempt: VerificationAttempt): AcceptanceAuditRecord;
/**
 * Remove this execution's OWN acceptance-only detail while keeping the light
 * audit record — the acceptance mechanism's side of requirement 2.
 *
 * Only material the acceptance mechanism itself created is removed: the
 * per-attempt findings, the invalid diagnostics and the token/evidence detail
 * beyond the summary. Everything a human needs to see the verdict survives
 * (stage, pass flag, time, scores, evidence hash, judge route, usage totals),
 * so the completion gate's pass record and a later review are unaffected, and
 * NO user file, task artifact, raw session history or other execution's record
 * is ever touched by this function.
 * @param verification - the execution's acceptance block.
 * @param now - cleanup instant (ms epoch).
 * @returns the cleaned block, or undefined when there is nothing to remove.
 */
export declare function withAcceptanceDetailCleared(verification: ExecutionVerification, now: number): ExecutionVerification | undefined;
/** The quality attempt that passed, when one did. */
export declare function passedAttempt(verification: ExecutionVerification | undefined): VerificationAttempt | undefined;
/**
 * Whether the board requires a matching pass record before this execution may
 * settle as succeeded. False when acceptance was off at start, and false for a
 * run that never became a goal run or for a teammate execution — those settle
 * on their own verdict, which is why {@link ExecutionVerification.applicability}
 * is persisted rather than re-derived.
 * @param verification - the execution's persisted acceptance state.
 * @returns true when a pass record is required.
 */
export declare function verificationRequired(verification: ExecutionVerification | undefined): boolean;
/**
 * Whether this execution's acceptance gate was never opened: acceptance was
 * enforced, the judge recorded nothing at all, and no cycle ever closed. Zero
 * attempts is therefore a fact about the RUN, not a verdict about the work — a
 * session that narrated completion instead of calling
 * `update_goal(action: complete)` produces exactly this shape, and its failure
 * reason must stay distinguishable from a quality verdict (issue #1837).
 * @param verification - the execution's persisted acceptance state.
 * @returns true when no acceptance attempt ever ran.
 */
export declare function verificationNeverInvoked(verification: ExecutionVerification | undefined): boolean;
/**
 * Whether this execution's acceptance produced no usable veto at all: it was
 * enforced, the judge recorded attempts, and every one of them is INVALID.
 *
 * Such a run must never be described as an evidence-backed quality veto (issue
 * #1837's sibling): the judge could not locate its own rejection, so the run
 * ended for lack of a matching pass rather than because the work was judged
 * and rejected. The settlement reason names that difference.
 * @param verification - the execution's persisted acceptance state.
 * @returns true when nothing but invalid acceptances were recorded.
 */
export declare function verificationOnlyInvalid(verification: ExecutionVerification | undefined): boolean;
/** Whether this cycle still has quality budget left. */
export declare function hasQualityBudget(verification: ExecutionVerification | undefined): boolean;
/** Whether this cycle still has anomaly budget left. */
export declare function hasExceptionBudget(verification: ExecutionVerification | undefined): boolean;
/** Derived board phase of one execution's acceptance. */
export declare function verificationPhase(verification: ExecutionVerification | undefined): VerificationPhase;
/** The text of each evidence part one acceptance handed to the judge. */
export interface AcceptanceEvidenceText {
    /** The task statement block. */
    task: string;
    /** The candidate's own trajectory block (the WORK). */
    trajectory: string;
    /** The host's rendered workspace-change block; empty when none was served. */
    workspace: string;
}
/** The input the program-level validity check reads from one finished attempt. */
export interface AcceptanceValidityInput {
    /** Per-criterion scores the attempt recorded. */
    criteria: readonly VerificationCriterionScore[];
    /** Structured findings the judge's answer produced. */
    findings: readonly VerificationCriterionFinding[];
    /** The exact evidence texts the judge was shown. */
    evidence: AcceptanceEvidenceText;
    /** Characters the evidence cap dropped from the trajectory. */
    omittedCharacters: number;
}
/** The verdict of the program-level validity check. */
export type AcceptanceValidity = {
    valid: true;
} | {
    valid: false;
    reason: VerificationInvalidReason;
    detail: string;
};
/**
 * Program-level validity of a REJECTING acceptance, decided before any quality
 * verdict is booked (requirement 1: the rule cannot live in a prompt alone).
 *
 * A veto is only usable when every criterion that failed has its own structured
 * finding carrying the requirement, the observation, the difference and a
 * citation that really occurs in the evidence the judge saw. A citation aimed at
 * the empty-work baseline, a citation that is not in the reviewed evidence, an
 * empty or generic statement, and a truncated review that cannot substantiate
 * the veto are all invalid acceptances: no quality verdict, no quality budget,
 * and no card failure.
 * @param input - the attempt's scores, findings and the evidence it judged.
 * @returns valid, or the reason and detail of the invalidity.
 */
export declare function assessAcceptanceValidity(input: AcceptanceValidityInput): AcceptanceValidity;
/**
 * The acceptance rule, mirrored from the verifier's `sessionAccepted`:
 * the work must BEAT the empty-work baseline, reach the total threshold, and
 * reach the threshold on every criterion. A tie or a loss against the baseline
 * fails, so a session indistinguishable from the baseline can never pass.
 * @param score - total score of the task's own work.
 * @param baseline - total score of the empty-work baseline.
 * @param criteria - per-criterion scores of the task's own work.
 * @param threshold - acceptance threshold.
 * @returns true when the work passes.
 */
export declare function acceptancePassed(score: number, baseline: number, criteria: readonly {
    score: number;
}[], threshold: number): boolean;
/**
 * Repair a persisted acceptance block, or drop it.
 *
 * Deliberately fail-soft on the FIELD and fail-closed on the VERDICT: a block
 * that does not parse is dropped (the execution keeps its own record, and the
 * board then treats the execution as unverified), while a block that does parse
 * keeps every recorded attempt verbatim. Dropping a malformed block can only
 * make the board MORE strict, never less.
 * @param value - the persisted value.
 * @returns the repaired block, or undefined when it is unusable.
 */
export declare function normalizeVerification(value: unknown): ExecutionVerification | undefined;
/** Totals spanning every attempt of one execution (for the report and the card). */
export interface VerificationTotals {
    quality: number;
    exceptions: number;
    /** Invalid acceptances: no usable veto, so no quality verdict and no card failure. */
    invalid: number;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    usageIncomplete: boolean;
}
/** Sum the attempts of one execution. */
export declare function verificationTotals(verification: ExecutionVerification | undefined): VerificationTotals;
/**
 * The failure feedback one acceptance returns to the fixing agent. It names
 * what failed, with the numbers, the locator lines the judge reported and the
 * remaining budget, so the next round can act on it instead of restating the
 * work.
 * @param attempt - the failed quality attempt.
 * @param remaining - quality attempts still available after this one.
 * @returns the model-facing feedback text.
 */
export declare function qualityFeedback(attempt: VerificationAttempt, remaining: number): string;
/**
 * The feedback one INVALID acceptance returns.
 *
 * The claim is refused (the board still has no pass record, so completion may
 * not take effect) but the agent is NOT handed a repair instruction: there is
 * no located problem to repair, and telling it to "fix" an evidence-free veto
 * would be exactly the blind repair the requirement forbids. The text says what
 * was missing, what happens next, and what the agent should do instead (make
 * the missing output itself observable, or let a human look).
 * @param attempt - the invalid attempt.
 * @param remaining - invalid-acceptance attempts left after this one.
 * @returns the model-facing text.
 */
export declare function invalidAcceptanceFeedback(attempt: VerificationAttempt, remaining: number): string;
/**
 * The reason one execution records when its invalid-acceptance budget is spent.
 *
 * Deliberately NOT a quality failure: no veto was ever substantiated, so the
 * card stays open for a human and the reason says the acceptance is INVALID
 * rather than rejected.
 * @param used - invalid attempts spent.
 * @returns the user- and model-facing text.
 */
export declare function invalidHoldReason(used: number): string;
/** Human-readable text of one invalid reason. */
export declare function invalidReasonText(reason: VerificationInvalidReason | undefined): string;
/**
 * The reason one exhausted acceptance cycle records as the execution's final
 * failure. Unlike {@link qualityFeedback} — which the fixing agent reads while
 * budget remains — this reason is also persisted on the ledger, echoed on every
 * later completion attempt and shown on the card, so it carries the full
 * picture: the scores, the baseline comparison, every failing criterion and the
 * judge's locatable findings, so a later agent (or the user) can act on WHAT to
 * improve, not only on how badly the attempt scored.
 * @param attempt - the failed quality attempt that spent the last budget.
 * @param used - quality attempts spent by the cycle.
 * @param threshold - the contract threshold the work was judged against.
 * @returns the model- and user-facing failure reason.
 */
export declare function finalFailureReason(attempt: VerificationAttempt, used: number, threshold: number): string;
/**
 * The locatable problem lines of one attempt, structured findings first.
 *
 * A structured finding renders the requirement, the observed fact, the gap and
 * the citation in a fixed order, so the fixing agent reads WHAT was required,
 * WHAT was seen, WHY it falls short and WHERE to look — never a bare complaint.
 * @param attempt - the attempt whose findings are rendered.
 * @returns one line per finding, bounded.
 */
export declare function locatedFindingLines(attempt: VerificationAttempt): string[];
/** `0.42` style percentage. */
export declare function percent(value: number): string;
/** Split a qualified `provider/model` route; undefined when it is not one. */
export declare function parseModelRoute(qualified: string | undefined): {
    provider: string;
    model: string;
} | undefined;
/**
 * Normalize the raw `session/modelCatalog` reply into the shape the acceptance
 * settings read. Everything is optional in the wire value, so every level is
 * checked: an unreadable catalog degrades to "unknown", never to a crash.
 * @param value - the raw gateway reply.
 * @returns the normalized catalog, or undefined when nothing usable arrived.
 */
export declare function normalizeCatalog(value: unknown): ModelCatalogView | undefined;
/** Whether the catalog declares the route at all. */
export declare function catalogHasRoute(catalog: ModelCatalogView | undefined, provider: string, model: string): boolean;
/**
 * Resolve the acceptance configuration into the contract one execution freezes.
 *
 * "Inherit host" means the host's own model catalog default, never the card's
 * pinned execution model. An explicitly configured reasoning effort is sent
 * ONLY when the target model's adapter declares it: an unsupported value is
 * dropped instead of being passed through, and the fallback to the target
 * model's own default is recorded so the settings card and the report can show
 * exactly what will be sent.
 * @param settings - the live configuration.
 * @param catalog - the host model catalog, when this cohort serves one.
 * @param threshold - acceptance threshold to freeze.
 * @returns the contract.
 */
export declare function resolveContract(settings: VerificationSettings, catalog: ModelCatalogView | undefined, threshold?: number): VerificationContract;
