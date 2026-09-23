import { LM, POSE_LANDMARK_COUNT } from '@/cv/pose/landmarks'

/**
 * A tiny forward-kinematics humanoid, used to generate the demo figure for each exercise.
 *
 * Why synthesise rather than record a person: every angle here can be derived from the
 * thresholds the analyzer actually enforces, so the demo provably shows the depth and
 * alignment the rules require — and that is asserted in tests. A recorded clip can only
 * ever be as correct as whoever performed it.
 *
 * Body space is anatomical, not camera-relative:
 *   x = lateral (+ = the subject's left)
 *   y = vertical, DOWN positive (matching MediaPipe's world landmarks)
 *   z = sagittal (+ = forward, the way the subject faces)
 *
 * Segment angles are degrees from "straight down along the body's long axis":
 *   flex   rotates in the sagittal plane (y-z), + = forward
 *   abduct rotates in the frontal plane (x-y), + = away from the midline
 */

export interface Segment {
  flex: number
  abduct?: number
}

export interface RigFrame {
  /** Torso tilt from vertical, degrees, + = leaning forward. */
  torsoLean: number
  thighL: Segment
  thighR: Segment
  shankL: Segment
  shankR: Segment
  upperArmL: Segment
  upperArmR: Segment
  forearmL: Segment
  forearmR: Segment
  /**
   * Rotation of the whole body about the lateral axis, degrees.
   * 0 = standing, 90 = prone (push-up, plank). Limb angles stay body-relative.
   */
  bodyPitch?: number
  /** Lifts the whole figure off the floor, in metres (jumping jack mid-air). */
  airborne?: number
}

/** Adult-ish proportions in metres. Only the ratios matter. */
const B = {
  shoulderHalfWidth: 0.19,
  hipHalfWidth: 0.11,
  torso: 0.5,
  neck: 0.12,
  head: 0.11,
  thigh: 0.42,
  shank: 0.42,
  foot: 0.17,
  heel: 0.07,
  upperArm: 0.3,
  forearm: 0.27,
} as const

type Vec3 = { x: number; y: number; z: number }

const rad = (d: number) => (d * Math.PI) / 180

/** Direction of a segment hanging from a joint, before the body pitch is applied. */
function dir(seg: Segment, sideSign: number): Vec3 {
  const f = rad(seg.flex)
  const a = rad(seg.abduct ?? 0) * sideSign
  return { x: Math.sin(a), y: Math.cos(a) * Math.cos(f), z: Math.cos(a) * Math.sin(f) }
}

function step(from: Vec3, d: Vec3, len: number): Vec3 {
  return { x: from.x + d.x * len, y: from.y + d.y * len, z: from.z + d.z * len }
}

/** Rotate about the lateral (x) axis, so the whole body can be tipped prone. */
function pitch(p: Vec3, deg: number): Vec3 {
  if (!deg) return p
  const a = rad(deg)
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c }
}

/**
 * Build the 33 world landmarks for one frame.
 *
 * The figure is grounded after construction: whichever contact point is lowest is placed on
 * the floor, so a squat sinks rather than having its feet drift, which is what makes the
 * ghost line up with a real person standing in front of the camera.
 */
export function rigToWorld(frame: RigFrame): Float32Array {
  const hip = { x: 0, y: 0, z: 0 }
  const hipL = { x: B.hipHalfWidth, y: 0, z: 0 }
  const hipR = { x: -B.hipHalfWidth, y: 0, z: 0 }

  // Torso runs UP from the hips, so negate the lean's vertical component.
  const t = rad(frame.torsoLean)
  const torsoDir: Vec3 = { x: 0, y: -Math.cos(t), z: Math.sin(t) }
  const neckBase = step(hip, torsoDir, B.torso)
  const shoulderL = { x: neckBase.x + B.shoulderHalfWidth, y: neckBase.y, z: neckBase.z }
  const shoulderR = { x: neckBase.x - B.shoulderHalfWidth, y: neckBase.y, z: neckBase.z }
  const head = step(neckBase, torsoDir, B.neck)
  const nose = { x: head.x, y: head.y, z: head.z + B.head }

  const kneeL = step(hipL, dir(frame.thighL, 1), B.thigh)
  const kneeR = step(hipR, dir(frame.thighR, -1), B.thigh)
  const ankleL = step(kneeL, dir(frame.shankL, 1), B.shank)
  const ankleR = step(kneeR, dir(frame.shankR, -1), B.shank)

  const elbowL = step(shoulderL, dir(frame.upperArmL, 1), B.upperArm)
  const elbowR = step(shoulderR, dir(frame.upperArmR, -1), B.upperArm)
  const wristL = step(elbowL, dir(frame.forearmL, 1), B.forearm)
  const wristR = step(elbowR, dir(frame.forearmR, -1), B.forearm)

  // Feet point the way the body faces; heels trail behind the ankle.
  const footL = { x: ankleL.x, y: ankleL.y + 0.02, z: ankleL.z + B.foot }
  const footR = { x: ankleR.x, y: ankleR.y + 0.02, z: ankleR.z + B.foot }
  const heelL = { x: ankleL.x, y: ankleL.y + 0.02, z: ankleL.z - B.heel }
  const heelR = { x: ankleR.x, y: ankleR.y + 0.02, z: ankleR.z - B.heel }

  const pts: Record<number, Vec3> = {
    [LM.NOSE]: nose,
    [LM.L_EYE]: { x: nose.x + 0.03, y: nose.y - 0.02, z: nose.z - 0.02 },
    [LM.R_EYE]: { x: nose.x - 0.03, y: nose.y - 0.02, z: nose.z - 0.02 },
    [LM.L_EAR]: { x: head.x + 0.07, y: head.y, z: head.z },
    [LM.R_EAR]: { x: head.x - 0.07, y: head.y, z: head.z },
    [LM.L_SHOULDER]: shoulderL,
    [LM.R_SHOULDER]: shoulderR,
    [LM.L_ELBOW]: elbowL,
    [LM.R_ELBOW]: elbowR,
    [LM.L_WRIST]: wristL,
    [LM.R_WRIST]: wristR,
    [LM.L_HIP]: hipL,
    [LM.R_HIP]: hipR,
    [LM.L_KNEE]: kneeL,
    [LM.R_KNEE]: kneeR,
    [LM.L_ANKLE]: ankleL,
    [LM.R_ANKLE]: ankleR,
    [LM.L_HEEL]: heelL,
    [LM.R_HEEL]: heelR,
    [LM.L_FOOT]: footL,
    [LM.R_FOOT]: footR,
  }

  const out = new Float32Array(POSE_LANDMARK_COUNT * 3)
  const pitched: Vec3[] = new Array(POSE_LANDMARK_COUNT)
  let lowest = -Infinity
  for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
    // Landmarks the rig does not model (fingers, mouth) collapse onto the nearest joint;
    // nothing draws or measures them.
    const src = pts[i] ?? pts[nearestModelled(i)]
    const p = pitch(src, frame.bodyPitch ?? 0)
    pitched[i] = p
    if (p.y > lowest) lowest = p.y
  }

  // y is down-positive, so lifting the figure means shifting it further negative.
  const groundShift = lowest + (frame.airborne ?? 0)
  for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
    const p = pitched[i]
    const o = i * 3
    out[o] = p.x
    out[o + 1] = p.y - groundShift
    out[o + 2] = p.z
  }
  return out
}

/** Map an unmodelled MediaPipe index onto the joint it hangs off. */
function nearestModelled(i: number): number {
  if (i <= 10) return LM.NOSE
  if (i >= 17 && i <= 22) return i % 2 === 1 ? LM.L_WRIST : LM.R_WRIST
  return LM.NOSE
}

/** Blend two frames. Used to play a keyframed clip smoothly. */
export function lerpFrame(a: RigFrame, b: RigFrame, u: number): RigFrame {
  const seg = (x: Segment, y: Segment): Segment => ({
    flex: x.flex + (y.flex - x.flex) * u,
    abduct: (x.abduct ?? 0) + ((y.abduct ?? 0) - (x.abduct ?? 0)) * u,
  })
  const n = (x = 0, y = 0) => x + (y - x) * u
  return {
    torsoLean: n(a.torsoLean, b.torsoLean),
    thighL: seg(a.thighL, b.thighL),
    thighR: seg(a.thighR, b.thighR),
    shankL: seg(a.shankL, b.shankL),
    shankR: seg(a.shankR, b.shankR),
    upperArmL: seg(a.upperArmL, b.upperArmL),
    upperArmR: seg(a.upperArmR, b.upperArmR),
    forearmL: seg(a.forearmL, b.forearmL),
    forearmR: seg(a.forearmR, b.forearmR),
    bodyPitch: n(a.bodyPitch, b.bodyPitch),
    airborne: n(a.airborne, b.airborne),
  }
}
