import type { ExerciseDefinition } from '@/cv/engine/types'
import { LM } from '@/cv/pose/landmarks'
import { angleDeg, mid, verticalAngleDeg } from '@/cv/geometry/angles'

/**
 * Alternating lunge — side view.
 * Primary feature: the smaller of the two knee angles (front knee reaches ~90° at the bottom).
 */
export const lunge: ExerciseDefinition = {
  id: 'lunge',
  name: 'Alternating Lunge',
  mode: 'reps',
  orientation: 'side',
  requiredLandmarks: [LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE, LM.L_SHOULDER, LM.R_SHOULDER],
  features: (pose) => {
    const lKnee = angleDeg(pose[LM.L_HIP], pose[LM.L_KNEE], pose[LM.L_ANKLE])
    const rKnee = angleDeg(pose[LM.R_HIP], pose[LM.R_KNEE], pose[LM.R_ANKLE])
    const minKnee = Math.min(lKnee, rKnee)
    const s = mid(pose[LM.L_SHOULDER], pose[LM.R_SHOULDER])
    const h = mid(pose[LM.L_HIP], pose[LM.R_HIP])
    const torsoLean = verticalAngleDeg(h, s)
    // Which leg is forward (for alternation feedback later): compare ankle x offsets from hip.
    const lForward = Math.abs(pose[LM.L_ANKLE].x - h.x)
    const rForward = Math.abs(pose[LM.R_ANKLE].x - h.x)
    const stance = Math.abs(lForward - rForward)
    return { minKnee, torsoLean, stance }
  },
  fsm: {
    feature: 'minKnee',
    restIs: 'high',
    topEnter: 160,
    topExit: 150,
    bottomEnter: 112,
    bottomExit: 122,
    minRepMs: 800,
    partialThreshold: 140,
    confirmFrames: 2,
  },
  rules: [
    {
      id: 'depth',
      phase: 'partial',
      cue: { en: 'Lower your back knee', hi: 'पिछला घुटना नीचे' },
      severity: 3,
      penalty: 25,
      check: () => true,
    },
    {
      id: 'torso_lean',
      phase: 'rep_complete',
      cue: { en: 'Stay upright', hi: 'सीधे रहें' },
      severity: 2,
      penalty: 15,
      check: (_f, rep) => !!rep && (rep.atBottom.torsoLean ?? 0) > 30,
    },
    {
      id: 'tempo',
      phase: 'rep_complete',
      cue: { en: 'Control the movement', hi: 'धीरे और नियंत्रित' },
      severity: 1,
      penalty: 10,
      check: (_f, rep) => !!rep && rep.durationMs < 1000,
    },
  ],
  praise: 'Strong lunge',
}
