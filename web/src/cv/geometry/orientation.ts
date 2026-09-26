import type { Pose } from '@/cv/pose/landmarks'
import { FULL_BODY, toIsotropic } from '@/cv/pose/landmarks'
import { shoulderWidth, torsoLength, visibilityOf } from '@/cv/geometry/angles'

export type Facing = 'front' | 'side' | 'unknown'

/**
 * Estimate whether the user faces the camera or stands side-on.
 * Front view: shoulders are wide relative to torso length (~0.45–0.7).
 * Side view: shoulders overlap (~0.05–0.25).
 */
export function estimateFacing(pose: Pose): Facing {
  const t = torsoLength(pose)
  if (t < 1e-3) return 'unknown'
  const ratio = shoulderWidth(pose) / t
  if (ratio >= 0.38) return 'front'
  if (ratio <= 0.28) return 'side'
  return 'unknown'
}

export interface FramingCheck {
  visible: boolean // required joints visible enough
  inFrame: boolean // whole body inside the frame with margin
  facingOk: boolean
  facing: Facing
  visibility: number
  hint: string | null
}

/**
 * `pose` is MediaPipe's raw normalized output, which the in-frame margins are defined on.
 * `aspect` (frame width / height) is needed for the facing estimate, which compares a
 * horizontal length with a vertical one and is meaningless without it.
 */
export function checkFraming(pose: Pose | null, required: readonly number[], wanted: 'front' | 'side' | 'any', aspect = 1): FramingCheck {
  if (!pose) {
    return { visible: false, inFrame: false, facingOk: false, facing: 'unknown', visibility: 0, hint: 'Step into the frame' }
  }
  const visibility = visibilityOf(pose, required)
  const visible = visibility >= 0.55
  let inFrame = true
  for (const i of FULL_BODY) {
    const l = pose[i]
    if (!l || l.x < 0.03 || l.x > 0.97 || l.y < 0.03 || l.y > 0.97) {
      inFrame = false
      break
    }
  }
  const facing = estimateFacing(toIsotropic(pose, aspect))
  const facingOk = wanted === 'any' || facing === wanted
  let hint: string | null = null
  if (!visible) hint = 'Move to better light or step back'
  else if (!inFrame) hint = 'Step back — whole body in frame'
  else if (!facingOk) hint = wanted === 'side' ? 'Turn to stand side-on to the camera' : 'Turn to face the camera'
  return { visible, inFrame, facingOk, facing, visibility, hint }
}
