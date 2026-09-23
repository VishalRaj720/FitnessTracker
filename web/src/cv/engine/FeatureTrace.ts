import type { Features } from '@/cv/engine/types'

/**
 * A fixed-capacity ring buffer of the feature vector, one row per frame.
 *
 * The analyzer computes joint angles every frame and then discards everything but the
 * top/bottom snapshots. Those snapshots are enough to decide whether a rule fired, but not
 * enough to reason about *how* a rep went — tempo, which joint moved first, whether the
 * lean crept up across a set. Keeping the series is what lets the coach say something the
 * rules cannot.
 *
 * Preallocated and written in place: this runs at inference rate, and Phase 1 went to some
 * trouble to get allocation out of that path.
 */
export class FeatureTrace {
  private keys: string[] = []
  private cap: number
  private ts: Float64Array
  private data: Float32Array
  private head = 0
  private size = 0

  constructor(capacity = 256) {
    this.cap = capacity
    this.ts = new Float64Array(capacity)
    this.data = new Float32Array(0)
  }

  get featureKeys(): readonly string[] {
    return this.keys
  }

  push(features: Features, tMs: number): void {
    if (this.keys.length === 0) {
      // Key order is fixed by the first frame; every later frame reads the same columns.
      this.keys = Object.keys(features)
      if (this.keys.length === 0) return
      this.data = new Float32Array(this.cap * this.keys.length)
    }
    const base = this.head * this.keys.length
    for (let k = 0; k < this.keys.length; k++) {
      const v = features[this.keys[k]]
      this.data[base + k] = Number.isFinite(v) ? v : NaN
    }
    this.ts[this.head] = tMs
    this.head = (this.head + 1) % this.cap
    if (this.size < this.cap) this.size += 1
  }

  reset(): void {
    this.head = 0
    this.size = 0
  }

  /**
   * Evenly-spaced samples of each feature across [t0, t1], oldest first.
   * Returns at most `n` points, fewer if the window holds fewer frames.
   */
  sample(t0: number, t1: number, n = 8): Record<string, number[]> {
    const slots: number[] = []
    const start = (this.head - this.size + this.cap) % this.cap
    for (let i = 0; i < this.size; i++) {
      const s = (start + i) % this.cap
      const t = this.ts[s]
      if (t >= t0 && t <= t1) slots.push(s)
    }
    const out: Record<string, number[]> = {}
    if (slots.length === 0 || this.keys.length === 0) return out
    const take = Math.min(n, slots.length)
    for (let k = 0; k < this.keys.length; k++) {
      const series: number[] = new Array(take)
      for (let i = 0; i < take; i++) {
        const idx = take === 1 ? slots.length - 1 : Math.round((i * (slots.length - 1)) / (take - 1))
        const v = this.data[slots[idx] * this.keys.length + k]
        // One decimal is plenty: these are degrees and ratios, and the series is going
        // into a prompt where every token counts.
        series[i] = Number.isFinite(v) ? Math.round(v * 10) / 10 : 0
      }
      out[this.keys[k]] = series
    }
    return out
  }
}

/** What one completed repetition looked like, as numbers a language model can reason over. */
export interface RepKinematics {
  /** Feature name -> evenly spaced samples across the rep, oldest first. */
  series: Record<string, number[]>
  descentMs: number
  bottomMs: number
  ascentMs: number
  totalMs: number
}
