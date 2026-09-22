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
