import type { ExerciseDefinition } from '@/cv/engine/types'
import { LM } from '@/cv/pose/landmarks'
import { angleDeg, betterSide, sideJoints } from '@/cv/geometry/angles'

/**
 * Push-up — side view, phone on the floor.
 * Primary feature: elbow angle (shoulder-elbow-wrist). Top ≈ 165°, bottom ≈ 80–95°.
 * bodyLine = shoulder-hip-ankle angle; ~180° is a straight plank line.
 */
export const pushup: ExerciseDefinition = {
  id: 'pushup',
  name: 'Push-up',
  mode: 'reps',
  orientation: 'side',
  requiredLandmarks: [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_ELBOW, LM.R_ELBOW, LM.L_WRIST, LM.R_WRIST, LM.L_HIP, LM.R_HIP],
  features: (pose) => {
    const side = betterSide(pose)
    const j = sideJoints(pose, side)
    const elbowAngle = angleDeg(j.shoulder, j.elbow, j.wrist)
    const bodyLine = angleDeg(j.shoulder, j.hip, j.ankle)
    return { elbowAngle, bodyLine }
  },
  fsm: {
    feature: 'elbowAngle',
    restIs: 'high',
    topEnter: 150,
    topExit: 140,
    bottomEnter: 100,
    bottomExit: 112,
    minRepMs: 600,
    partialThreshold: 130,
    confirmFrames: 2,
  },
  rules: [
    {
      id: 'depth',
      phase: 'partial',
      cue: { en: 'Go lower', hi: 'और नीचे' },
      severity: 3,
      penalty: 25,
      check: () => true,
    },
    {
      id: 'hip_sag',
      phase: 'rep_complete',
      cue: { en: 'Keep your body straight', hi: 'शरीर सीधा रखें' },
      severity: 2,
      penalty: 20,
      check: (_f, rep) => !!rep && (rep.atBottom.bodyLine ?? 180) < 155,
    },
    {
      id: 'tempo',
      phase: 'rep_complete',
      cue: { en: 'Slow down', hi: 'धीरे करें' },
      severity: 1,
      penalty: 10,
      check: (_f, rep) => !!rep && rep.durationMs < 800,
    },
  ],
  praise: 'Solid push-up',
}
