/** MediaPipe BlazePose landmark indices (33 points). */
export const LM = {
  NOSE: 0,
  L_EYE: 2,
  R_EYE: 5,
  L_EAR: 7,
  R_EAR: 8,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_ELBOW: 13,
  R_ELBOW: 14,
  L_WRIST: 15,
  R_WRIST: 16,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
  L_HEEL: 29,
  R_HEEL: 30,
  L_FOOT: 31,
  R_FOOT: 32,
} as const

export type LandmarkIndex = (typeof LM)[keyof typeof LM]

export interface Landmark {
  x: number // normalized 0..1 (image width)
  y: number // normalized 0..1 (image height), y grows downward
  z: number
  visibility: number // 0..1
}

/** A full-body pose: exactly 33 landmarks in MediaPipe order. */
export type Pose = Landmark[]

export const POSE_LANDMARK_COUNT = 33

export const FULL_BODY = [
  LM.L_SHOULDER,
  LM.R_SHOULDER,
  LM.L_HIP,
  LM.R_HIP,
  LM.L_KNEE,
  LM.R_KNEE,
  LM.L_ANKLE,
  LM.R_ANKLE,
] as const

/**
 * Skeleton edges for the overlay, as a flat [a0,b0, a1,b1, …] list so the render loop can
 * iterate without allocating. Deliberately a subset of MediaPipe's POSE_CONNECTIONS: the
 * face mesh and the hand fans are dropped (clutter at phone size), the head is drawn as a
 * circle instead. Keeping this here means the render path needs no MediaPipe import.
 */
export const BODY_EDGES = new Uint8Array([
  // torso
  LM.L_SHOULDER, LM.R_SHOULDER,
  LM.L_SHOULDER, LM.L_HIP,
  LM.R_SHOULDER, LM.R_HIP,
  LM.L_HIP, LM.R_HIP,
  // arms
  LM.L_SHOULDER, LM.L_ELBOW,
  LM.L_ELBOW, LM.L_WRIST,
  LM.R_SHOULDER, LM.R_ELBOW,
  LM.R_ELBOW, LM.R_WRIST,
  // legs
  LM.L_HIP, LM.L_KNEE,
  LM.L_KNEE, LM.L_ANKLE,
  LM.R_HIP, LM.R_KNEE,
  LM.R_KNEE, LM.R_ANKLE,
  // feet
  LM.L_ANKLE, LM.L_HEEL,
  LM.L_HEEL, LM.L_FOOT,
  LM.L_ANKLE, LM.L_FOOT,
  LM.R_ANKLE, LM.R_HEEL,
  LM.R_HEEL, LM.R_FOOT,
  LM.R_ANKLE, LM.R_FOOT,
])

/** Joints worth drawing a dot on at the `full` detail level. */
export const BODY_JOINTS = new Uint8Array([
  LM.L_SHOULDER, LM.R_SHOULDER, LM.L_ELBOW, LM.R_ELBOW, LM.L_WRIST, LM.R_WRIST,
  LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE,
])

/** Allocate a pose whose landmark objects can be written in place by the render loop. */
export function makePoseBuffer(): Pose {
  const out: Pose = new Array(POSE_LANDMARK_COUNT)
  for (let i = 0; i < POSE_LANDMARK_COUNT; i++) out[i] = { x: 0, y: 0, z: 0, visibility: 0 }
  return out
}

/** Number of floats per landmark on the wire: x, y, z, visibility. */
export const LANDMARK_STRIDE = 4

/** Unpack the worker's flat transferable into a fresh Pose. */
export function poseFromFloats(buf: Float32Array): Pose {
  const out: Pose = new Array(POSE_LANDMARK_COUNT)
  for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
    const o = i * LANDMARK_STRIDE
    out[i] = { x: buf[o], y: buf[o + 1], z: buf[o + 2], visibility: buf[o + 3] }
  }
  return out
}
