/**
 * Admission control for the session-creating half of a run.
 *
 * A run opens one session, so the burst this bounds is several runs starting at
 * once — several cards run from different tabs, or a due schedule firing while
 * a manual run is still launching. Unbounded, the Host asks DSH for N sessions
 * in the same tick: the burst the repository's measured guidance caps at three
 * heavy implementation subagents (docs/multi-agent-resources.md), with no
 * mechanism enforcing it.
 *
 * The queue is SERVICE-wide, not per run group: the pressure it bounds is the
 * machine's (the Host process's memory and the swap it drives), and two run
 * groups opened from two tabs share one Host. Admission is round-robin across
 * run groups — FIFO inside a group — so one run cannot starve another opened
 * after it, and no entry can be starved.
 *
 * The width is read through a live callback, so a settings edit takes effect on
 * the next admission without remounting anything.
 *
 * @module dsh-task-board/host/launch-admission
 */

/** One launch the queue has not started yet. */
export interface QueuedLaunch {
  /** Run group this launch belongs to; the unit of round-robin fairness. */
  readonly groupId: string
  /**
   * Perform the launch. The slot is held until this promise settles, which
   * makes "in flight" mean "still creating and prompting its session".
   * A rejection is swallowed here so one broken launch can never wedge the
   * slot; the caller owns reporting.
   */
  start(): Promise<void>
  /**
   * Called by {@link LaunchAdmissionQueue.drain} for a launch that never
   * started, so the caller can take its execution out of the running column.
   */
  abandon(): void
}

export class LaunchAdmissionQueue {
  /** Waiting launches per run group, in arrival order. */
  private readonly waiting = new Map<string, QueuedLaunch[]>()
  /** Run groups in round-robin order. */
  private rotation: string[] = []
  /** Slot holders of the launches in flight, one per admitted launch. */
  private readonly inFlight = new Set<() => void>()
  /** Highest number of launches in flight at once; observability and tests. */
  peakInFlight = 0

  /**
   * @param width - live admission width (already normalized by the caller).
   */
  constructor(private readonly width: () => number) {}

  /** Launches the queue has not admitted yet. */
  get pendingCount(): number {
    let total = 0
    for (const queue of this.waiting.values()) total += queue.length
    return total
  }

  /** Launches currently holding a slot. */
  get inFlightCount(): number {
    return this.inFlight.size
  }

  /** Admit one launch, immediately if a slot is free. */
  enqueue(launch: QueuedLaunch): void {
    const queue = this.waiting.get(launch.groupId)
    if (queue === undefined) {
      this.waiting.set(launch.groupId, [launch])
      this.rotation.push(launch.groupId)
    } else {
      queue.push(launch)
    }
    this.pump()
  }

  /**
   * Abandon every waiting launch: the queue is being torn down, so an entry
   * that never started can never start. Launches already in flight are left
   * alone — their session may already exist, and the callers that own them
   * settle them through the normal path.
   * @returns the abandoned launches, in abandonment order.
   */
  drain(): QueuedLaunch[] {
    const abandoned: QueuedLaunch[] = []
    for (const groupId of this.rotation) {
      for (const launch of this.waiting.get(groupId) ?? []) abandoned.push(launch)
    }
    this.rotation = []
    this.waiting.clear()
    for (const launch of abandoned) launch.abandon()
    return abandoned
  }

  private pump(): void {
    while (this.inFlight.size < this.width()) {
      const launch = this.takeNext()
      if (launch === undefined) return
      this.admit(launch)
    }
  }

  /** The next launch by round-robin across groups and FIFO inside one. */
  private takeNext(): QueuedLaunch | undefined {
    while (this.rotation.length > 0) {
      const groupId = this.rotation.shift()
      if (groupId === undefined) return undefined
      const queue = this.waiting.get(groupId)
      if (queue === undefined || queue.length === 0) {
        this.waiting.delete(groupId)
        continue
      }
      const launch = queue.shift()
      if (launch === undefined) continue
      if (queue.length === 0) this.waiting.delete(groupId)
      // A group that still has work goes to the back of the rotation, so every
      // other run group gets its turn before this one's next member.
      else this.rotation.push(groupId)
      return launch
    }
    return undefined
  }

  private admit(launch: QueuedLaunch): void {
    const release = (): void => {
      this.inFlight.delete(release)
      this.pump()
    }
    this.inFlight.add(release)
    if (this.inFlight.size > this.peakInFlight) this.peakInFlight = this.inFlight.size
    void Promise.resolve()
      .then(() => launch.start())
      .catch(() => { /* a rejected launch still releases its slot; the caller reports it */ })
      .then(release)
  }
}
