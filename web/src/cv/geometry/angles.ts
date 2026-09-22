import type { Landmark, Pose } from '@/cv/pose/landmarks'
import { LM } from '@/cv/pose/landmarks'

type Pt = { x: number; y: number }

/** Interior angle at `b` formed by a-b-c, in degrees (0..180). 2D only — z is too noisy. */
export function angleDeg(a: Pt, b: Pt, c: Pt): number {
  const abx = a.x - b.x
  const aby = a.y - b.y
  const cbx = c.x - b.x
  const cby = c.y - b.y
  const dot = abx * cbx + aby * cby
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby)
  if (mag === 0) return 180
  const cos = Math.min(1, Math.max(-1, dot / mag))
  return (Math.acos(cos) * 180) / Math.PI
}

/** Angle between the vector from->to and the vertical axis, in degrees (0 = perfectly vertical). */
export function verticalAngleDeg(from: Pt, to: Pt): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return 0
  const cos = Math.abs(dy) / len
  return (Math.acos(Math.min(1, cos)) * 180) / Math.PI
}

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** Signed distance of point p from the line through a->b. Positive = below the line (larger y). */
export function signedDistanceFromLine(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return 0
  // cross product gives signed area; orientation depends on direction a->b
  const cross = (p.x - a.x) * dy - (p.y - a.y) * dx
  return -cross / len
}

export function visibilityOf(pose: Pose, indices: readonly number[]): number {
  if (!indices.length) return 0
  let s = 0
  for (const i of indices) s += pose[i]?.visibility ?? 0
  return s / indices.length
}

/** Returns 'left' or 'right' — whichever side's hip/knee/ankle is more visible. */
export function betterSide(pose: Pose): 'left' | 'right' {
  const l = visibilityOf(pose, [LM.L_SHOULDER, LM.L_HIP, LM.L_KNEE, LM.L_ANKLE])
  const r = visibilityOf(pose, [LM.R_SHOULDER, LM.R_HIP, LM.R_KNEE, LM.R_ANKLE])
  return l >= r ? 'left' : 'right'
}

export function sideJoints(pose: Pose, side: 'left' | 'right') {
  return side === 'left'
    ? {
        shoulder: pose[LM.L_SHOULDER],
        elbow: pose[LM.L_ELBOW],
        wrist: pose[LM.L_WRIST],
        hip: pose[LM.L_HIP],
        knee: pose[LM.L_KNEE],
        ankle: pose[LM.L_ANKLE],
      }
    : {
        shoulder: pose[LM.R_SHOULDER],
        elbow: pose[LM.R_ELBOW],
        wrist: pose[LM.R_WRIST],
        hip: pose[LM.R_HIP],
        knee: pose[LM.R_KNEE],
        ankle: pose[LM.R_ANKLE],
      }
}

/** Torso length in normalized units — the scale reference for all pixel-based rules. */
export function torsoLength(pose: Pose): number {
  const s = mid(pose[LM.L_SHOULDER], pose[LM.R_SHOULDER])
  const h = mid(pose[LM.L_HIP], pose[LM.R_HIP])
  return dist(s, h)
}

export function shoulderWidth(pose: Pose): number {
  return dist(pose[LM.L_SHOULDER], pose[LM.R_SHOULDER])
}

export function isLandmark(l: Landmark | undefined): l is Landmark {
  return !!l && Number.isFinite(l.x) && Number.isFinite(l.y)
}
