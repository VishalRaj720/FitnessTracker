import { describe, expect, it } from 'vitest'
import { DEMO_CLIPS, sampleClipWorld } from '@/cv/demo/clips'
import { projectToPose } from '@/cv/demo/project'
import { EXERCISE_DEFINITIONS } from '@/cv/exercises'
import { checkFraming, estimateFacing } from '@/cv/geometry/orientation'
import { toIsotropic, type Pose } from '@/cv/pose/landmarks'

/**
 * The demo rig works in metres, where both axes share a unit. The camera does not: MediaPipe
 * divides x by the frame width and y by the frame height. Every other CV test feeds the
 * analyzer metre-space poses, so none of them could see what a non-square camera frame does
 * to an angle. These film the demo into real frame shapes and check the camera path
 * measures the same body the rig built.
 */

const FRAMES = [
  { name: 'portrait phone 3:4', w: 480, h: 640 },
  { name: 'landscape webcam 16:9', w: 1280, h: 720 },
] as const

/** Report a metre-space pose the way MediaPipe would for a W x H frame, body centred. */
function film(pose: Pose, w: number, h: number): Pose {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of pose) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  const pxPerM = 0.7 * Math.min(w / (maxX - minX), h / (maxY - minY))
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return pose.map((p) => ({
    x: (w / 2 + (p.x - cx) * pxPerM) / w,
    y: (h / 2 + (p.y - cy) * pxPerM) / h,
    z: p.z,
    visibility: p.visibility,
  }))
}

function poseAt(slug: string, u: number): Pose {
  const clip = DEMO_CLIPS[slug]
  return projectToPose(sampleClipWorld(clip, u), clip.view)
}

// Absolute frame position, not a measurement of the body, so it is expected to move.
const POSITIONAL = new Set(['hipY'])
const SAMPLES = [0, 0.15, 0.3, 0.5, 0.7, 0.85]

describe('camera aspect ratio', () => {
  for (const { name, w, h } of FRAMES) {
    describe(name, () => {
      it('gives the analyzer the same features the rig built, once made isotropic', () => {
        for (const [slug, def] of Object.entries(EXERCISE_DEFINITIONS)) {
          for (const u of [...SAMPLES, DEMO_CLIPS[slug].holdAt]) {
            const truth = def.features(poseAt(slug, u))
            const seen = def.features(toIsotropic(film(poseAt(slug, u), w, h), w / h))
            for (const [k, v] of Object.entries(truth)) {
              if (POSITIONAL.has(k)) continue
              expect(seen[k], `${slug}.${k} at u=${u}`).toBeCloseTo(v, 4)
            }
          }
        }
      })

      it('recognises the orientation each exercise requires', () => {
        for (const [slug, def] of Object.entries(EXERCISE_DEFINITIONS)) {
          const filmed = film(poseAt(slug, DEMO_CLIPS[slug].holdAt), w, h)
          const fc = checkFraming(filmed, def.requiredLandmarks, def.orientation, w / h)
          expect(fc.inFrame, slug).toBe(true)
          expect(fc.facingOk, `${slug} facing ${fc.facing}`).toBe(true)
        }
      })
    })
  }

  // The next two pin the bug this fixed, so dropping the correction fails loudly.

  it('counts a parallel squat filmed by a 16:9 webcam', () => {
    // Uncorrected, the rig's 92° bottom read ~114°: above the FSM's bottom threshold, so a
    // perfect rep was scored as a partial and the user was told to go lower.
    const { w, h } = FRAMES[1]
    const { bottomEnter } = EXERCISE_DEFINITIONS.squat.fsm!
    const filmed = film(poseAt('squat', DEMO_CLIPS.squat.holdAt), w, h)
    expect(EXERCISE_DEFINITIONS.squat.features(filmed).kneeAngle).toBeGreaterThan(bottomEnter)
    expect(EXERCISE_DEFINITIONS.squat.features(toIsotropic(filmed, w / h)).kneeAngle).toBeLessThan(bottomEnter)
  })

  it('judges side-on from the body, not from the frame shape', () => {
    // 20° short of side-on is within the facing thresholds, but a portrait frame stretches
    // shoulder width by 4/3 relative to torso length and the user was told to turn.
    const { w, h } = FRAMES[0]
    const filmed = film(projectToPose(turn(sampleClipWorld(DEMO_CLIPS.squat, 0), 20), 'side'), w, h)
    expect(estimateFacing(filmed)).not.toBe('side')
    expect(estimateFacing(toIsotropic(filmed, w / h))).toBe('side')
  })
})

/** Rotate world landmarks about the vertical axis, as if the user turned on the spot. */
function turn(world: Float32Array, deg: number): Float32Array {
  const c = Math.cos((deg * Math.PI) / 180)
  const s = Math.sin((deg * Math.PI) / 180)
  const out = new Float32Array(world)
  for (let o = 0; o < out.length; o += 3) {
    out[o] = world[o] * c + world[o + 2] * s
    out[o + 2] = -world[o] * s + world[o + 2] * c
  }
  return out
}
