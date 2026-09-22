/**
 * One Euro filter (Casiez et al., 2012): low jitter at rest, low lag during fast motion.
 * Applied per landmark coordinate.
 */
export class OneEuroFilter {
  private xPrev: number | null = null
  private dxPrev = 0
  private tPrev: number | null = null

  constructor(
    private minCutoff = 1.0,
    private beta = 0.01,
    private dCutoff = 1.0,
  ) {}

  private alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff)
    return 1 / (1 + tau / dt)
  }

  filter(x: number, tMs: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x
      this.tPrev = tMs
      return x
    }
    const dt = Math.max(1e-3, (tMs - this.tPrev) / 1000)
    this.tPrev = tMs
    const dx = (x - this.xPrev) / dt
    const aD = this.alpha(this.dCutoff, dt)
    const dxHat = aD * dx + (1 - aD) * this.dxPrev
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat)
    const a = this.alpha(cutoff, dt)
    const xHat = a * x + (1 - a) * this.xPrev
    this.xPrev = xHat
    this.dxPrev = dxHat
    return xHat
  }

  reset(): void {
    this.xPrev = null
    this.dxPrev = 0
    this.tPrev = null
  }
}

import type { Pose } from '@/cv/pose/landmarks'
import { POSE_LANDMARK_COUNT } from '@/cv/pose/landmarks'

/** Smooths x/y of all 33 landmarks. Visibility is passed through unfiltered. */
export class PoseSmoother {
  private fx: OneEuroFilter[]
  private fy: OneEuroFilter[]

  constructor(minCutoff = 1.2, beta = 0.02) {
    this.fx = Array.from({ length: POSE_LANDMARK_COUNT }, () => new OneEuroFilter(minCutoff, beta))
    this.fy = Array.from({ length: POSE_LANDMARK_COUNT }, () => new OneEuroFilter(minCutoff, beta))
  }

  apply(pose: Pose, tMs: number): Pose {
    return pose.map((l, i) => ({
      x: this.fx[i].filter(l.x, tMs),
      y: this.fy[i].filter(l.y, tMs),
      z: l.z,
      visibility: l.visibility,
    }))
  }

  reset(): void {
    for (const f of this.fx) f.reset()
    for (const f of this.fy) f.reset()
  }
}
