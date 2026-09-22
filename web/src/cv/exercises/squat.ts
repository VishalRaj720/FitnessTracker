import type { ExerciseDefinition } from '@/cv/engine/types'
import { LM } from '@/cv/pose/landmarks'
import { angleDeg, betterSide, dist, mid, sideJoints, verticalAngleDeg } from '@/cv/geometry/angles'

/**
 * Squat — side view.
 * Primary feature: knee angle (hip-knee-ankle). Standing ≈ 170°, parallel ≈ 90°.
 */
export const squat: ExerciseDefinition = {
  id: 'squat',
  name: 'Squat',
  mode: 'reps',
  orientation: 'side',
  requiredLandmarks: [LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE, LM.L_SHOULDER, LM.R_SHOULDER],
  features: (pose) => {
    const side = betterSide(pose)
    const j = sideJoints(pose, side)
    const kneeAngle = angleDeg(j.hip, j.knee, j.ankle)
    const hipAngle = angleDeg(j.shoulder, j.hip, j.knee)
    const torsoLean = verticalAngleDeg(j.hip, j.shoulder)
    // Front-view knee tracking proxy: knee spread vs ankle spread.
    const kneeSpread = dist(pose[LM.L_KNEE], pose[LM.R_KNEE])
    const ankleSpread = dist(pose[LM.L_ANKLE], pose[LM.R_ANKLE])
    const kneeAnkleRatio = ankleSpread > 1e-3 ? kneeSpread / ankleSpread : 1
    const hipY = mid(pose[LM.L_HIP], pose[LM.R_HIP]).y
    return { kneeAngle, hipAngle, torsoLean, kneeAnkleRatio, hipY }
  },
  fsm: {
    feature: 'kneeAngle',
    restIs: 'high',
    topEnter: 158,
    topExit: 148,
    bottomEnter: 105,
    bottomExit: 115,
    minRepMs: 700,
    partialThreshold: 135,
    confirmFrames: 2,
  },
  rules: [
    {
      id: 'depth',
      phase: 'partial',
      cue: { en: 'Go lower', hi: 'और नीचे जाएँ' },
      severity: 3,
      penalty: 25,
      check: () => true, // any partial = not deep enough
    },
    {
      id: 'depth_shallow',
      phase: 'rep_complete',
      cue: { en: 'A bit lower next time', hi: 'थोड़ा और नीचे' },
      severity: 1,
      penalty: 10,
      check: (_f, rep) => !!rep && rep.extreme > 97,
    },
    {
      id: 'torso_lean',
      phase: 'rep_complete',
      cue: { en: 'Chest up', hi: 'सीना ऊपर रखें' },
      severity: 2,
      penalty: 15,
      orientation: 'side',
      check: (_f, rep) => !!rep && (rep.atBottom.torsoLean ?? 0) > 50,
    },
    {
      id: 'tempo',
      phase: 'rep_complete',
      cue: { en: 'Slow down', hi: 'धीरे करें' },
      severity: 1,
      penalty: 10,
      check: (_f, rep) => !!rep && rep.durationMs < 900,
    },
    {
      id: 'knee_valgus',
      phase: 'rep_complete',
      cue: { en: 'Knees out', hi: 'घुटने बाहर रखें' },
      severity: 2,
      penalty: 15,
      orientation: 'front',
      check: (_f, rep) => !!rep && (rep.atBottom.kneeAnkleRatio ?? 1) < 0.75,
    },
  ],
  praise: 'Good depth',
}
