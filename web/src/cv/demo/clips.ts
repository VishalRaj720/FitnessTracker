import { lerpFrame, rigToWorld, type RigFrame, type Segment } from '@/cv/demo/rig'
import type { DemoView } from '@/cv/demo/project'

export interface DemoClip {
  view: DemoView
  /** One full repetition, in ms. */
  loopMs: number
  /** Keyframes at normalized times 0..1. Must start at 0 and end at 1. */
  keys: { t: number; frame: RigFrame }[]
  /** Normalized time at which the movement is deepest — the pose the ghost freezes on. */
  holdAt: number
}

/** Both limbs the same. */
function sym(p: {
  torsoLean?: number
  thigh: Segment
  shank: Segment
  upperArm: Segment
  forearm: Segment
  bodyPitch?: number
  airborne?: number
}): RigFrame {
  return {
    torsoLean: p.torsoLean ?? 0,
    thighL: p.thigh,
    thighR: p.thigh,
    shankL: p.shank,
    shankR: p.shank,
    upperArmL: p.upperArm,
    upperArmR: p.upperArm,
    forearmL: p.forearm,
    forearmR: p.forearm,
    bodyPitch: p.bodyPitch,
    airborne: p.airborne,
  }
}

/*
 * Every angle below is chosen so that the pose the analyzer measures lands inside the band
 * that exercise's own rules demand. `demoClips.test.ts` asserts this by running the real
 * ExerciseDefinition.features() over the generated frames — so if a threshold is ever
 * retuned, the demo that teaches it fails loudly instead of quietly teaching the old depth.
 *
 * Knee/elbow angle identity used throughout: joint angle = 180 - |distal.flex - proximal.flex|.
 */

// Squat — knee 176 standing, 92 at the bottom (under the 97 that trips 'a bit lower'),
// torso lean 38 (well under the 50 that trips 'chest up').
const squatTop = sym({
  torsoLean: 5,
  thigh: { flex: 2 },
  shank: { flex: -2 },
  upperArm: { flex: 5 },
  forearm: { flex: 5 },
})
const squatBottom = sym({
  torsoLean: 38,
  thigh: { flex: 68 },
  shank: { flex: -20 },
  upperArm: { flex: 85 },
  forearm: { flex: 85 },
})

// Push-up — elbow 178 at the top, 90 at the bottom; body pitched prone and dead straight,
// so shoulder-hip-ankle reads 180 and never trips 'keep your body straight'.
const pushupTop = sym({
  thigh: { flex: 0 },
  shank: { flex: 0 },
  upperArm: { flex: -90 },
  forearm: { flex: -88 },
  bodyPitch: 90,
})
const pushupBottom = sym({
  thigh: { flex: 0 },
  shank: { flex: 0 },
  upperArm: { flex: -45 },
  forearm: { flex: -135 },
  bodyPitch: 90,
})

// Lunge — a real split stance, torso upright at 8 (the rule trips past 30).
//
// The angles are solved backwards from where the feet actually belong: front foot ~0.33 m
// ahead with a near-vertical shin (front knee 95, which is what gets counted), back foot
// ~0.55 m behind with the knee low and the heel raised. Choosing plausible-looking joint
// angles instead put both ankles under the hips, which drew a diamond rather than a lunge.
const lungeTop = sym({
  torsoLean: 4,
  thigh: { flex: 2 },
  shank: { flex: -2 },
  upperArm: { flex: 5 },
  forearm: { flex: 5 },
})
const lungeBottom: RigFrame = {
  torsoLean: 8,
  thighL: { flex: 75 },
  shankL: { flex: -10 },
  thighR: { flex: -21 },
  shankR: { flex: -75 },
  upperArmL: { flex: 15 },
  upperArmR: { flex: -15 },
  forearmL: { flex: 55 },
  forearmR: { flex: -55 },
}

// Jumping jack — feet spread 0.58 closed / ~2.4 open (the rep needs 1.75), wrists a full
// torso length above the shoulders so 'arms all the way up' is satisfied.
const jackClosed = sym({
  thigh: { flex: 0, abduct: 0 },
  shank: { flex: 0, abduct: 0 },
  upperArm: { flex: 0, abduct: 8 },
  forearm: { flex: 0, abduct: 8 },
})
const jackOpen = sym({
  thigh: { flex: 0, abduct: 25 },
  shank: { flex: 0, abduct: 25 },
  upperArm: { flex: 0, abduct: 165 },
  forearm: { flex: 0, abduct: 165 },
  airborne: 0.04,
})

// Plank — the push-up top held; shoulder-hip-ankle at 180 sits mid-band of [158, 185].
const plankHold = pushupTop

export const DEMO_CLIPS: Record<string, DemoClip> = {
  squat: {
    view: 'side',
    loopMs: 3000,
    holdAt: 0.45,
    keys: [
      { t: 0, frame: squatTop },
      { t: 0.45, frame: squatBottom },
      { t: 0.6, frame: squatBottom },
      { t: 1, frame: squatTop },
    ],
  },
  pushup: {
    view: 'side',
    loopMs: 2600,
    holdAt: 0.45,
    keys: [
      { t: 0, frame: pushupTop },
      { t: 0.45, frame: pushupBottom },
      { t: 0.58, frame: pushupBottom },
      { t: 1, frame: pushupTop },
    ],
  },
  lunge: {
    view: 'side',
    loopMs: 3200,
    holdAt: 0.45,
    keys: [
      { t: 0, frame: lungeTop },
      { t: 0.45, frame: lungeBottom },
      { t: 0.6, frame: lungeBottom },
      { t: 1, frame: lungeTop },
    ],
  },
  jumping_jack: {
    view: 'front',
    loopMs: 1400,
    holdAt: 0.5,
    keys: [
      { t: 0, frame: jackClosed },
      { t: 0.5, frame: jackOpen },
      { t: 1, frame: jackClosed },
    ],
  },
  plank: {
    view: 'side',
    loopMs: 4000,
    holdAt: 0.5,
    keys: [
      { t: 0, frame: plankHold },
      { t: 1, frame: plankHold },
    ],
  },
}

export function getClip(slug: string): DemoClip | null {
  return DEMO_CLIPS[slug] ?? null
}

/** Sample a clip at normalized time u (0..1), blending between its keyframes. */
export function sampleClip(clip: DemoClip, u: number): RigFrame {
  const t = ((u % 1) + 1) % 1
  const keys = clip.keys
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t
      const k = span < 1e-6 ? 0 : (t - a.t) / span
      // Ease in/out so the demo moves like a person rather than a metronome.
      return lerpFrame(a.frame, b.frame, k * k * (3 - 2 * k))
    }
  }
  return keys[keys.length - 1].frame
}

/** World landmarks for a clip at normalized time u. */
export function sampleClipWorld(clip: DemoClip, u: number): Float32Array {
  return rigToWorld(sampleClip(clip, u))
}
