import type { ExerciseDefinition } from '@/cv/engine/types'
import { LM } from '@/cv/pose/landmarks'
import { angleDeg, betterSide, sideJoints, signedDistanceFromLine, torsoLength } from '@/cv/geometry/angles'

/**
 * Plank — hold, side view, phone on the floor.
 * bodyLine = shoulder-hip-ankle angle. The timer runs while it stays within tolerance.
 * hipOffset distinguishes sagging (hips below the line) from piking (hips above).
 */
export const plank: ExerciseDefinition = {
  id: 'plank',
  name: 'Plank',
  mode: 'hold',
  orientation: 'side',
  requiredLandmarks: [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_HIP, LM.R_HIP, LM.L_ANKLE, LM.R_ANKLE],
  features: (pose) => {
    const side = betterSide(pose)
    const j = sideJoints(pose, side)
    const bodyLine = angleDeg(j.shoulder, j.hip, j.ankle)
    const torso = Math.max(1e-3, torsoLength(pose))
    // Positive => hip below shoulder->ankle line (sag) when shoulder is left of ankle; sign
    // depends on direction, so normalise by the x-order of shoulder and ankle.
    let off = signedDistanceFromLine(j.hip, j.shoulder, j.ankle) / torso
    if (j.shoulder.x > j.ankle.x) off = -off
    return { bodyLine, hipOffset: off }
  },
  hold: { feature: 'bodyLine', min: 158, max: 185, graceFrames: 4 },
  rules: [
    {
      id: 'hip_sag',
      phase: 'any',
      cue: { en: 'Hips up — squeeze your glutes', hi: 'कूल्हे ऊपर उठाएँ' },
      severity: 2,
      penalty: 0,
      check: (f) => f.bodyLine < 158 && (f.hipOffset ?? 0) > 0,
    },
    {
      id: 'hip_pike',
      phase: 'any',
      cue: { en: 'Lower your hips', hi: 'कूल्हे नीचे करें' },
      severity: 2,
      penalty: 0,
      check: (f) => f.bodyLine < 158 && (f.hipOffset ?? 0) <= 0,
    },
  ],
  praise: 'Hold it',
}
