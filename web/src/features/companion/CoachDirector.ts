import { companionApi, type CuePayload, type RepKinematicsPayload } from '@/features/companion/api'
import type { ExerciseDefinition } from '@/cv/engine/types'
import type { RepKinematics } from '@/cv/engine/FeatureTrace'

export interface CoachCue {
  text: string
  observation: string | null
  urgency: number
}

/**
 * When to spend a model call.
 *
 * `set-end` is the default because it is what current Gemini latency actually supports.
 * `per-rep` is kept because it is the better experience whenever the model is fast enough,
 * and switching is a one-line change rather than a rewrite.
 */
export type CoachTrigger = 'set-end' | 'per-rep'

export interface CoachDirectorOptions {
  def: ExerciseDefinition
  onCue: (cue: CoachCue) => void
  /** Hard ceiling on model calls for one workout. */
  budget?: number
  trigger?: CoachTrigger
}

const DEFAULT_BUDGET = 60
/** Once most of the budget is gone, analyse every other rep instead of every rep. */
const THROTTLE_AT = 0.8
const REPS_FOR_TREND = 3
const REMEMBER_SAID = 5

/**
 * Turns completed repetitions into coaching.
 *
 * The original design fired on every rep and spoke the answer during the next one, which
 * works only if the round trip beats a repetition. Measured against Gemini's current
 * flash-lite models that round trip is 4-100 s, not sub-second: these are reasoning models
 * and the thinking time dominates. At that latency a per-rep trigger aborts every call as
 * the next rep lands, delivers nothing, and burns free-tier quota doing it.
 *
 * So the default is one call per set, fired as the set ends and answered during the rest
 * period — where 5-30 s is simply not noticeable, and the advice is still about the set the
 * user just did. Flip `trigger` back to 'per-rep' on a faster model or a paid tier.
 *
 * Everything here is best-effort. If the network is gone, the budget is spent, or the model
 * has nothing to add, no cue is emitted and the deterministic cues carry the set on their own.
 */
export class CoachDirector {
  private def: ExerciseDefinition
  private onCue: CoachDirectorOptions['onCue']
  private budget: number
  private trigger: CoachTrigger
  private spent = 0
  private inFlight: AbortController | null = null
  private said: string[] = []
  private repsSinceCall = 0
  private disposed = false
  private latest: { recent: RepKinematics[]; repCount: number; setNumber: number; violations: Record<string, number> } | null = null

  constructor(opts: CoachDirectorOptions) {
    this.def = opts.def
    this.onCue = opts.onCue
    this.budget = opts.budget ?? DEFAULT_BUDGET
    this.trigger = opts.trigger ?? 'set-end'
  }

  get callsSpent(): number {
    return this.spent
  }

  /** Called when the analyzer completes a repetition. */
  onRep(input: {
    recent: RepKinematics[]
    repCount: number
    setNumber: number
    violations: Record<string, number>
  }): void {
    if (this.disposed || !this.def.coaching || input.recent.length === 0) return
    this.latest = input
    if (this.trigger !== 'per-rep') return

    this.repsSinceCall += 1
    const stride = this.spent >= this.budget * THROTTLE_AT ? 2 : 1
    if (this.repsSinceCall < stride) return
    this.repsSinceCall = 0
    // The newest rep is the interesting one, so drop an older request rather than queue.
    this.send(input, { replaceInFlight: true })
  }

  /**
   * The set has finished and the rest period has started. This is the default moment to
   * ask: the data is complete, and a slow answer costs nothing because the user is resting.
   */
  onSetEnd(): void {
    if (this.trigger === 'per-rep') {
      // Mid-set advice is already stale the moment the set stops.
      this.inFlight?.abort()
      this.inFlight = null
    } else if (this.latest) {
      this.send(this.latest, { replaceInFlight: false })
    }
    this.repsSinceCall = 0
    this.latest = null
    this.said = []
  }

  private send(
    input: { recent: RepKinematics[]; repCount: number; setNumber: number; violations: Record<string, number> },
    opts: { replaceInFlight: boolean },
  ): void {
    if (!this.def.coaching) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    if (this.spent >= this.budget) return
    if (this.inFlight) {
      if (!opts.replaceInFlight) return
      this.inFlight.abort()
    }

    const controller = new AbortController()
    this.inFlight = controller
    this.spent += 1

    const payload: CuePayload = {
      exercise_slug: this.def.id,
      set_number: input.setNumber,
      rep_count: input.repCount,
      mode: this.def.mode,
      reps: input.recent.slice(-REPS_FOR_TREND).map(toPayload),
      glossary: this.def.coaching.glossary,
      reference: this.def.coaching.reference,
      notes: this.def.coaching.notes,
      already_said: [...this.said],
      recent_violations: input.violations,
    }

    companionApi
      .cue(payload, controller.signal)
      .then((res) => {
        if (this.disposed || controller.signal.aborted) return
        if (!res.cue || res.urgency <= 0) return
        this.said.push(res.cue)
        if (this.said.length > REMEMBER_SAID) this.said.shift()
        this.onCue({ text: res.cue, observation: res.observation, urgency: res.urgency })
      })
      .catch(() => {
        // Offline, aborted, rate-limited or timed out. Silence is the correct fallback.
      })
      .finally(() => {
        if (this.inFlight === controller) this.inFlight = null
      })
  }

  dispose(): void {
    this.disposed = true
    this.inFlight?.abort()
    this.inFlight = null
  }
}

function toPayload(k: RepKinematics, i: number): RepKinematicsPayload {
  return {
    index: i + 1,
    series: k.series,
    descent_ms: k.descentMs,
    bottom_ms: k.bottomMs,
    ascent_ms: k.ascentMs,
    total_ms: k.totalMs,
  }
}
