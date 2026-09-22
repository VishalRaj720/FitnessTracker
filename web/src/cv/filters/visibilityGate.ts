import type { Pose } from '@/cv/pose/landmarks'
import { visibilityOf } from '@/cv/geometry/angles'

/**
 * Decides whether a frame is trustworthy enough to drive counting.
 * Holds the last good pose for a few frames to bridge brief occlusions;
 * beyond that, reports `gated: true` so the FSM freezes instead of guessing.
 */
export class VisibilityGate {
  private lastGood: Pose | null = null
  private missedFrames = 0

  constructor(
    private required: readonly number[],
    private minVisibility = 0.5,
    private maxHoldFrames = 5,
  ) {}

  update(pose: Pose | null): { pose: Pose | null; gated: boolean; visibility: number } {
    const vis = pose ? visibilityOf(pose, this.required) : 0
    if (pose && vis >= this.minVisibility) {
      this.lastGood = pose
      this.missedFrames = 0
      return { pose, gated: false, visibility: vis }
    }
    this.missedFrames += 1
    if (this.lastGood && this.missedFrames <= this.maxHoldFrames) {
      return { pose: this.lastGood, gated: false, visibility: vis }
    }
    return { pose: null, gated: true, visibility: vis }
  }

  reset(): void {
    this.lastGood = null
    this.missedFrames = 0
  }
}
