import { describe, expect, it } from 'vitest'
import { lerpPose } from '@/cv/render/interpolate'
import { makePoseBuffer, POSE_LANDMARK_COUNT, type Pose } from '@/cv/pose/landmarks'

function poseAt(v: number, visibility = 1): Pose {
  const p: Pose = new Array(POSE_LANDMARK_COUNT)
  for (let i = 0; i < POSE_LANDMARK_COUNT; i++) p[i] = { x: v, y: v * 2, z: v * 3, visibility }
  return p
}

describe('lerpPose', () => {
  const buf = makePoseBuffer()

  it('returns the midpoint halfway between two samples', () => {
    const out = lerpPose(poseAt(0), poseAt(1), 0, 100, 50, buf)
    expect(out[0].x).toBeCloseTo(0.5)
    expect(out[0].y).toBeCloseTo(1)
    expect(out[0].z).toBeCloseTo(1.5)
  })

  it('clamps to the earlier pose before the window', () => {
    const prev = poseAt(0)
    expect(lerpPose(prev, poseAt(1), 100, 200, 50, buf)).toBe(prev)
  })

  it('holds the latest pose rather than extrapolating past it', () => {
    const next = poseAt(1)
    // A stalled inference must not let the skeleton drift away from the body.
    expect(lerpPose(poseAt(0), next, 0, 100, 500, buf)).toBe(next)
  })

  it('falls back to the latest pose when there is no history', () => {
    const next = poseAt(1)
    expect(lerpPose(null, next, 0, 100, 50, buf)).toBe(next)
  })

  it('tolerates non-advancing timestamps', () => {
    const next = poseAt(1)
    expect(lerpPose(poseAt(0), next, 100, 100, 100, buf)).toBe(next)
  })

  it('takes the pessimistic visibility so half-tracked limbs are not drawn', () => {
    const out = lerpPose(poseAt(0, 0.9), poseAt(1, 0.1), 0, 100, 50, buf)
    expect(out[0].visibility).toBeCloseTo(0.1)
  })

  it('writes into the shared buffer without allocating a new pose', () => {
    const out1 = lerpPose(poseAt(0), poseAt(1), 0, 100, 25, buf)
    const out2 = lerpPose(poseAt(0), poseAt(1), 0, 100, 75, buf)
    expect(out1).toBe(buf)
    expect(out2).toBe(buf)
    expect(buf[0].x).toBeCloseTo(0.75)
  })
})
