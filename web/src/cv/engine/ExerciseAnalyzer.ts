import type { Pose } from '@/cv/pose/landmarks'
import type { AnalyzerEvent, ExerciseDefinition, Features, FormRule, RepStats, Violation } from '@/cv/engine/types'
import { RepCounterFSM } from '@/cv/engine/RepCounterFSM'
import { HoldTimer } from '@/cv/engine/HoldTimer'
import { FeatureTrace, type RepKinematics } from '@/cv/engine/FeatureTrace'
import { VisibilityGate } from '@/cv/filters/visibilityGate'
import { PoseSmoother } from '@/cv/filters/oneEuro'
import { estimateFacing } from '@/cv/geometry/orientation'

export interface AnalyzerSnapshot {
  reps: number
  partials: number
  heldMs: number
  phase: string
  inTolerance: boolean
  formScore: number // running mean of per-rep scores (100 for holds while in tolerance)
  flags: Record<string, number>
  repEvents: number[][] // [tOffsetMs, score, extreme, durationMs]
  visibility: number
  gated: boolean
  cleanStreak: number
}

/**
 * Wires: pose -> gate -> smoother -> features -> FSM / hold timer -> rules -> events.
 * One analyzer per exercise instance (per set). Framework-free and deterministic.
 */
export class ExerciseAnalyzer {
  private fsm: RepCounterFSM | null
  private hold: HoldTimer | null
  private gate: VisibilityGate
  private smoother: PoseSmoother
  private lang: 'en' | 'hi'

  private reps = 0
  private partials = 0
  private scoreSum = 0
  private flags: Record<string, number> = {}
  private repEvents: number[][] = []
  private startTs: number | null = null
  private gated = false
  private lastVisibility = 0
  private visSum = 0
  private visCount = 0
  private lastPhase = 'TOP'
  private cleanStreak = 0
  private holdViolationFrames = 0
  private lastHoldMs = 0
  private lastFeatures: Features = {}
  /** Per-frame feature history, kept so completed reps can be described as a movement. */
  private trace = new FeatureTrace()
  private phaseAt: Record<string, number> = {}
  private repKinematics: RepKinematics[] = []

  constructor(
    public readonly def: ExerciseDefinition,
    opts: { lang?: 'en' | 'hi'; smoothing?: boolean } = {},
  ) {
    this.fsm = def.mode === 'reps' && def.fsm ? new RepCounterFSM(def.fsm) : null
    this.hold = def.mode === 'hold' && def.hold ? new HoldTimer(def.hold) : null
    this.gate = new VisibilityGate(def.requiredLandmarks)
    this.smoother = new PoseSmoother()
    this.lang = opts.lang ?? 'en'
    if (opts.smoothing === false) this.smoother = { apply: (p: Pose) => p, reset: () => {} } as unknown as PoseSmoother
  }

  get features(): Features {
    return this.lastFeatures
  }

  /** Feed one frame. `tMs` must be monotonic (video time or performance.now()). */
  update(rawPose: Pose | null, tMs: number): AnalyzerEvent[] {
    const events: AnalyzerEvent[] = []
    if (this.startTs === null) this.startTs = tMs

    const g = this.gate.update(rawPose)
    this.lastVisibility = g.visibility
    if (rawPose) {
      this.visSum += g.visibility
      this.visCount += 1
    }
    if (g.gated) {
      if (!this.gated) {
        this.gated = true
        events.push({ type: 'gated', reason: 'visibility' })
      }
      if (this.hold) this.hold.update(this.lastFeatures, tMs, true)
      return events
    }
    if (this.gated) {
      this.gated = false
      this.smoother.reset()
      events.push({ type: 'ungated' })
    }

    const pose = this.smoother.apply(g.pose as Pose, tMs)
    const features = this.def.features(pose)
    this.lastFeatures = features
    this.trace.push(features, tMs)
    const facing = estimateFacing(pose)

    if (this.fsm) {
      const out = this.fsm.update(features, tMs)
      if (out.kind === 'phase' && out.phase !== this.lastPhase) {
        this.lastPhase = out.phase
        this.phaseAt[out.phase] = tMs
        events.push({ type: 'phase', phase: out.phase })
      } else if (out.kind === 'rep') {
        this.lastPhase = 'TOP'
        // Describe the rep before judging it. The per-rep rules read this rep's curve and
        // the trend rules compare it with the ones before, so the history has to already
        // include it by the time `evaluate` runs.
        const kinematics = this.buildKinematics(out.stats.startTs, tMs)
        out.stats.kinematics = kinematics
        this.repKinematics.push(kinematics)
        if (this.repKinematics.length > 12) this.repKinematics.shift()
        this.phaseAt = {}
        const violations = this.evaluate('rep_complete', features, out.stats, facing)
        const score = Math.max(0, 100 - violations.reduce((s, v) => s + v.penalty, 0))
        this.reps += 1
        this.scoreSum += score
        for (const v of violations) this.flags[v.ruleId] = (this.flags[v.ruleId] ?? 0) + 1
        this.cleanStreak = violations.length ? 0 : this.cleanStreak + 1
        this.repEvents.push([
          Math.round(tMs - this.startTs),
          score,
          Math.round(out.stats.extreme * 10) / 10,
          Math.round(out.stats.durationMs),
        ])
        events.push({ type: 'phase', phase: 'TOP' })
        events.push({ type: 'rep', count: this.reps, score, violations, stats: out.stats, kinematics })
      } else if (out.kind === 'partial') {
        this.lastPhase = 'TOP'
        this.partials += 1
        const stats: RepStats = {
          extreme: out.extreme,
          durationMs: 0,
          startTs: tMs,
          endTs: tMs,
          atBottom: features,
          atTop: features,
        }
        const violations = this.evaluate('partial', features, stats, facing)
        for (const v of violations) this.flags[v.ruleId] = (this.flags[v.ruleId] ?? 0) + 1
        this.cleanStreak = 0
        events.push({ type: 'phase', phase: 'TOP' })
        events.push({ type: 'partial', violations })
      }
    }

    if (this.hold) {
      const h = this.hold.update(features, tMs, false)
      const violations = h.inTolerance ? [] : this.evaluate('any', features, null, facing)
      if (!h.inTolerance) {
        this.holdViolationFrames += 1
        if (this.holdViolationFrames === 8) {
          for (const v of violations) this.flags[v.ruleId] = (this.flags[v.ruleId] ?? 0) + 1
        }
      } else this.holdViolationFrames = 0
      // Score for holds: fraction of elapsed time spent in tolerance (updated on tick).
      this.lastHoldMs = h.heldMs
      events.push({ type: 'hold_tick', heldMs: h.heldMs, inTolerance: h.inTolerance, violations })
    }

    return events
  }

  private evaluate(phase: FormRule['phase'], f: Features, rep: RepStats | null, facing: string): Violation[] {
    const out: Violation[] = []
    for (const rule of this.def.rules) {
      if (rule.phase !== phase) continue
      if (rule.orientation && facing !== 'unknown' && rule.orientation !== facing) continue
      let violated = false
      try {
        violated = rule.check(f, rep, this.repKinematics)
      } catch {
        violated = false
      }
      if (violated) out.push({ ruleId: rule.id, cue: rule.cue[this.lang], severity: rule.severity, penalty: rule.penalty })
    }
    return out.sort((a, b) => b.severity - a.severity)
  }

  snapshot(): AnalyzerSnapshot {
    const elapsed = this.startTs === null ? 0 : Math.max(1, this.lastHoldMsElapsed())
    const formScore =
      this.def.mode === 'reps'
        ? this.reps
          ? Math.round(this.scoreSum / this.reps)
          : 100
        : Math.round(Math.min(100, (this.lastHoldMs / elapsed) * 100))
    return {
      reps: this.reps,
      partials: this.partials,
      heldMs: this.lastHoldMs,
      phase: this.lastPhase,
      inTolerance: this.hold?.inTolerance ?? false,
      formScore,
      flags: { ...this.flags },
      repEvents: [...this.repEvents],
      visibility: this.lastVisibility,
      gated: this.gated,
      cleanStreak: this.cleanStreak,
    }
  }

  meanVisibility(): number {
    return this.visCount ? this.visSum / this.visCount : 0
  }

  /**
   * Turn the frames of one repetition into a compact description of the movement.
   * Phase boundaries come from the FSM's own transitions, so "descent" means exactly what
   * the rep counter thought it meant.
   */
  private buildKinematics(startTs: number, endTs: number): RepKinematics {
    const bottomAt = this.phaseAt.BOTTOM ?? endTs
    const upAt = this.phaseAt.GOING_UP ?? endTs
    return {
      series: this.trace.sample(startTs, endTs, 8),
      descentMs: Math.max(0, Math.round(bottomAt - startTs)),
      bottomMs: Math.max(0, Math.round(upAt - bottomAt)),
      ascentMs: Math.max(0, Math.round(endTs - upAt)),
      totalMs: Math.max(0, Math.round(endTs - startTs)),
    }
  }

  /** The last `n` completed reps, most recent last. Trend lives here, not in a single rep. */
  recentKinematics(n = 3): RepKinematics[] {
    return this.repKinematics.slice(-n)
  }

  /** For holds, where there are no reps: the last `windowMs` of the feature series. */
  holdKinematics(nowMs: number, windowMs = 6000): RepKinematics {
    return {
      series: this.trace.sample(nowMs - windowMs, nowMs, 8),
      descentMs: 0,
      bottomMs: Math.round(Math.min(windowMs, this.lastHoldMs)),
      ascentMs: 0,
      totalMs: Math.round(windowMs),
    }
  }

  private elapsedMs = 0
  private lastHoldMsElapsed(): number {
    return this.elapsedMs || 1
  }

  /** Call from the runner with the wall-clock elapsed ms for hold scoring. */
  setElapsed(ms: number): void {
    this.elapsedMs = ms
  }
}
