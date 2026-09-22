import type { ExerciseDefinition } from '@/cv/engine/types'
import { LM } from '@/cv/pose/landmarks'
import { dist, shoulderWidth, torsoLength } from '@/cv/geometry/angles'

/**
 * Jumping jack — front view.
 * Primary feature: ankle spread / shoulder width. Closed ≈ 0.6–1.0, open ≈ 1.8–2.6.
 * Rest position is the LOW value (feet together), so restIs = 'low'.
 */
export const jumpingJack: ExerciseDefinition = {
  id: 'jumping_jack',
  name: 'Jumping Jack',
  mode: 'reps',
  orientation: 'front',
  requiredLandmarks: [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_WRIST, LM.R_WRIST, LM.L_ANKLE, LM.R_ANKLE],
  features: (pose) => {
    const sw = Math.max(1e-3, shoulderWidth(pose))
    const feetSpread = dist(pose[LM.L_ANKLE], pose[LM.R_ANKLE]) / sw
    const torso = Math.max(1e-3, torsoLength(pose))
    const shoulderY = (pose[LM.L_SHOULDER].y + pose[LM.R_SHOULDER].y) / 2
    const wristY = Math.min(pose[LM.L_WRIST].y, pose[LM.R_WRIST].y)
    // Positive when wrists are above the shoulders, in torso units.
    const armRaise = (shoulderY - wristY) / torso
    return { feetSpread, armRaise }
  },
  fsm: {
    feature: 'feetSpread',
    restIs: 'low',
    topEnter: 1.15,
    topExit: 1.35,
    bottomEnter: 1.75,
    bottomExit: 1.55,
    minRepMs: 350,
    partialThreshold: 1.5,
    confirmFrames: 1,
  },
  rules: [
    {
      id: 'feet_wide',
      phase: 'partial',
      cue: { en: 'Jump wider', hi: 'पैर और चौड़े' },
      severity: 2,
      penalty: 20,
      check: () => true,
    },
    {
      id: 'arms_up',
      phase: 'rep_complete',
      cue: { en: 'Arms all the way up', hi: 'हाथ पूरे ऊपर' },
      severity: 2,
      penalty: 20,
      check: (_f, rep) => !!rep && (rep.atBottom.armRaise ?? 0) < 0.35,
    },
  ],
  praise: 'Nice rhythm',
}
