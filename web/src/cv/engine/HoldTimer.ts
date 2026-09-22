import type { Features, HoldConfig } from '@/cv/engine/types'

/** Accumulates time while the primary feature stays inside [min, max]. */
export class HoldTimer {
  heldMs = 0
  inTolerance = false
  private lastTs: number | null = null
  private outFrames = 0
  private grace: number

  constructor(private cfg: HoldConfig) {
    this.grace = cfg.graceFrames ?? 3
  }

  reset(): void {
    this.heldMs = 0
    this.inTolerance = false
    this.lastTs = null
    this.outFrames = 0
  }

  /** Call once per frame. When `gated` is true the timer pauses without penalty. */
  update(features: Features, tMs: number, gated = false): { heldMs: number; inTolerance: boolean } {
    const v = features[this.cfg.feature]
    const ok = !gated && v !== undefined && v >= this.cfg.min && v <= this.cfg.max
    if (ok) {
      this.outFrames = 0
      if (this.inTolerance && this.lastTs !== null) this.heldMs += Math.min(250, tMs - this.lastTs)
      this.inTolerance = true
    } else {
      this.outFrames += 1
      if (this.outFrames > this.grace) this.inTolerance = false
      else if (this.inTolerance && this.lastTs !== null) this.heldMs += Math.min(250, tMs - this.lastTs)
    }
    this.lastTs = tMs
    return { heldMs: this.heldMs, inTolerance: this.inTolerance }
  }
}
