import type { Pose } from '@/cv/pose/landmarks'

/**
 * Lerp between two poses into a preallocated buffer.
 *
 * Deliberately clamps instead of extrapolating: past `next` we hold the last known pose.
 * Extrapolating would let the skeleton drift away from the body whenever inference
 * stalls, which reads as a glitch rather than as smoothness.
 */
export function lerpPose(
  prev: Pose | null,
  next: Pose,
  prevTs: number,
  nextTs: number,
  t: number,
  buf: Pose,
): Pose {
  if (!prev || nextTs <= prevTs || t >= nextTs) return next
  if (t <= prevTs) return prev
  const u = (t - prevTs) / (nextTs - prevTs)
  for (let i = 0; i < buf.length; i++) {
    const a = prev[i]
    const b = next[i]
    const o = buf[i]
    o.x = a.x + (b.x - a.x) * u
    o.y = a.y + (b.y - a.y) * u
    o.z = a.z + (b.z - a.z) * u
    // Visibility gates drawing, so take the pessimistic end rather than blending it.
    o.visibility = Math.min(a.visibility, b.visibility)
  }
  return buf
}
