import type { Features, Phase, RepFsmConfig, RepStats } from '@/cv/engine/types'

export type FsmOutput =
  | { kind: 'none' }
  | { kind: 'phase'; phase: Phase }
  | { kind: 'rep'; stats: RepStats }
  | { kind: 'partial'; extreme: number }

/**
 * Generic 4-phase rep counter with hysteresis and frame confirmation.
 * Internally the feature is normalised so that TOP is always the HIGH value;
 * exercises whose rest position is the low value are negated on the way in.
 */
export class RepCounterFSM {
  phase: Phase = 'TOP'
  private sign: number
  private topEnter: number
  private topExit: number
  private bottomEnter: number
  private bottomExit: number
  private partialThreshold: number | null
  private confirm: number
  private pendingPhase: Phase | null = null
  private pendingFrames = 0

  private repStartTs = 0
  private extreme = Number.POSITIVE_INFINITY
  private extremeRaw = 0
  private atBottom: Features = {}
  private leftTopAt: number | null = null
  private everReachedBottom = false

  constructor(private cfg: RepFsmConfig) {
    this.sign = cfg.restIs === 'high' ? 1 : -1
    this.topEnter = cfg.topEnter * this.sign
    this.topExit = cfg.topExit * this.sign
    this.bottomEnter = cfg.bottomEnter * this.sign
    this.bottomExit = cfg.bottomExit * this.sign
    this.partialThreshold = cfg.partialThreshold != null ? cfg.partialThreshold * this.sign : null
    this.confirm = cfg.confirmFrames ?? 2
  }

  reset(): void {
    this.phase = 'TOP'
    this.pendingPhase = null
    this.pendingFrames = 0
    this.extreme = Number.POSITIVE_INFINITY
    this.leftTopAt = null
    this.everReachedBottom = false
  }

  /** Feed one frame. Returns at most one significant output. */
  update(features: Features, tMs: number): FsmOutput {
    const raw = features[this.cfg.feature]
    if (raw === undefined || !Number.isFinite(raw)) return { kind: 'none' }
    const v = raw * this.sign

    // Track the extreme (lowest normalised value) while away from TOP.
    if (this.phase !== 'TOP' && v < this.extreme) {
      this.extreme = v
      this.extremeRaw = raw
    }

    let next: Phase | null = null
    switch (this.phase) {
      case 'TOP':
        if (v < this.topExit) next = 'GOING_DOWN'
        break
      case 'GOING_DOWN':
        if (v < this.bottomEnter) next = 'BOTTOM'
        else if (v > this.topEnter) next = 'TOP' // turned back early -> partial
        break
      case 'BOTTOM':
        if (v > this.bottomExit) next = 'GOING_UP'
        break
      case 'GOING_UP':
        if (v > this.topEnter) next = 'TOP'
        else if (v < this.bottomEnter) next = 'BOTTOM' // bounced back down
        break
    }

    if (next === null) {
      this.pendingPhase = null
      this.pendingFrames = 0
      return { kind: 'none' }
    }

    // Frame confirmation: a transition must persist for `confirm` consecutive frames.
    if (this.pendingPhase === next) this.pendingFrames += 1
    else {
      this.pendingPhase = next
      this.pendingFrames = 1
    }
    if (this.pendingFrames < this.confirm) return { kind: 'none' }
    this.pendingPhase = null
    this.pendingFrames = 0

    const prev = this.phase
    this.phase = next

    if (prev === 'TOP' && next === 'GOING_DOWN') {
      this.leftTopAt = tMs
      this.repStartTs = tMs
      this.extreme = v
      this.extremeRaw = raw
      this.everReachedBottom = false
      return { kind: 'phase', phase: next }
    }
    if (next === 'BOTTOM') {
      this.everReachedBottom = true
      this.atBottom = { ...features }
      return { kind: 'phase', phase: next }
    }
    if (next === 'TOP') {
      const duration = tMs - (this.leftTopAt ?? tMs)
      const reached = this.everReachedBottom
      const extremeRaw = this.extremeRaw
      const extremeNorm = this.extreme
      this.leftTopAt = null
      this.everReachedBottom = false
      this.extreme = Number.POSITIVE_INFINITY
      if (!reached) {
        // Went down but not far enough. Only call it a "partial" when the attempt was
        // meaningful (past partialThreshold); a small shuffle is just a phase change.
        const meaningful = this.partialThreshold === null || extremeNorm <= this.partialThreshold
        return meaningful ? { kind: 'partial', extreme: extremeRaw } : { kind: 'phase', phase: next }
      }
      if (duration < this.cfg.minRepMs) {
        return { kind: 'phase', phase: next } // too fast to be a real rep (jitter)
      }
      return {
        kind: 'rep',
        stats: {
          extreme: extremeRaw,
          durationMs: duration,
          startTs: this.repStartTs,
          endTs: tMs,
          atBottom: this.atBottom,
          atTop: { ...features },
        },
      }
    }
    return { kind: 'phase', phase: next }
  }
}
