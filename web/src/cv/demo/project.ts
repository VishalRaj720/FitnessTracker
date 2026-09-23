import { LM, POSE_LANDMARK_COUNT, type Pose } from '@/cv/pose/landmarks'
import { mid, torsoLength } from '@/cv/geometry/angles'

export type DemoView = 'side' | 'front'

/**
 * Flatten world landmarks to the 2D plane a camera would see.
 *
 * Output stays in metres rather than 0..1 image space. Everything the analyzer measures is
 * either an angle or a ratio, so it is invariant to scale and offset — which lets the same
 * projection feed both the form tests and the on-camera ghost, the latter being rescaled to
 * the user's own body by `alignToUser`.
 */
export function projectToPose(world: Float32Array, view: DemoView): Pose {
  const out: Pose = new Array(POSE_LANDMARK_COUNT)
  for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
    const o = i * 3
    const x = world[o]
    const y = world[o + 1]
    const z = world[o + 2]
    // Side view looks down the lateral axis, so the sagittal axis becomes screen-horizontal.
    out[i] = { x: view === 'side' ? z : x, y, z: view === 'side' ? x : z, visibility: 1 }
  }
  return out
}

/**
 * Scale and translate a demo pose so it sits on top of the user: torso lengths matched,
 * hip centres coincident. Without this the ghost only lines up at one camera distance.
 */
export function alignToUser(ghost: Pose, user: Pose): Pose {
  const gt = torsoLength(ghost)
  const ut = torsoLength(user)
  if (gt < 1e-6 || ut < 1e-6) return ghost
  const k = ut / gt
  const gh = mid(ghost[LM.L_HIP], ghost[LM.R_HIP])
  const uh = mid(user[LM.L_HIP], user[LM.R_HIP])
  const out: Pose = new Array(POSE_LANDMARK_COUNT)
  for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
    const g = ghost[i]
    out[i] = {
      x: uh.x + (g.x - gh.x) * k,
      y: uh.y + (g.y - gh.y) * k,
      z: g.z * k,
      visibility: g.visibility,
    }
  }
  return out
}

/** Mirror across the vertical axis through the hips, for a user standing the other way round. */
export function mirrorPose(pose: Pose): Pose {
  const h = mid(pose[LM.L_HIP], pose[LM.R_HIP])
  return pose.map((p) => ({ x: 2 * h.x - p.x, y: p.y, z: -p.z, visibility: p.visibility }))
}
