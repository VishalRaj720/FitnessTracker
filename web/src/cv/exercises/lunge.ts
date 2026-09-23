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
  coaching: {
    glossary: {
      minKnee: 'the more bent of the two knee angles, in degrees. This is the front leg at the bottom of a lunge; 90 is a full lunge, 180 is standing.',
      torsoLean: 'degrees the torso is tilted away from vertical. 0 is perfectly upright.',
      stance: 'how unevenly the two feet are placed front-to-back, relative to the hips. Near 0 means the feet are almost level — barely a lunge at all.',
    },
    reference: {
      angles: {
        minKnee: { top: [155, 180], bottom: [80, 110] },
        torsoLean: { max: 25 },
        stance: { min: 0.12 },
      },
      tempo: { descentMs: [900, 2000], ascentMs: [700, 1600], bottomMs: [0, 700] },
    },
    notes: [
      'A small stance is the root cause of most shallow lunges: with the feet too close together the front knee cannot reach 90 without the knee travelling far past the toes, so the user stops short. Cue a longer step before cueing more depth.',
      'Lunges expose left/right differences more than any other movement here. Comparing minKnee and stance across consecutive reps — which alternate legs — is the way to spot one side being consistently shallower or less stable.',
      'Leaning over the front thigh (torsoLean climbing at the bottom) shifts the work off the glutes and usually means the step was too short or the trunk is tired.',
      'Descending forward instead of straight down shows up as stance shrinking through the descent.',
    ].join(' '),
  },
  tutorial: {
    steps: [
      {
        id: 'step',
        title: { en: 'Step forward', hi: 'आगे कदम रखें' },
        body: {
          en: 'Stand side-on. Take a long step forward — long enough that both knees can reach 90 degrees.',
          hi: 'बगल से खड़े हों। लंबा कदम आगे रखें ताकि दोनों घुटने 90 डिग्री तक पहुँच सकें।',
        },
      },
      {
        id: 'drop',
        title: { en: 'Drop the back knee', hi: 'पिछला घुटना नीचे लाएँ' },
        body: {
          en: 'Lower straight down, not forward. The back knee travels toward the floor and stops just short of it.',
          hi: 'सीधे नीचे जाएँ, आगे नहीं। पिछला घुटना फ़र्श के पास तक जाए।',
        },
      },
      {
        id: 'alternate',
        title: { en: 'Alternate legs', hi: 'पैर बदलते रहें' },
        body: {
          en: 'Push back to standing and switch legs. Each lunge on either leg counts as one rep.',
          hi: 'वापस खड़े हों और पैर बदलें। हर लंज एक रेप गिना जाता है।',
        },
      },
    ],
    keyPoints: [
      { en: 'Both knees to about 90 degrees', hi: 'दोनों घुटने लगभग 90 डिग्री' },
      { en: 'Torso stays upright', hi: 'धड़ सीधा रहे' },
      { en: 'Lower straight down, not forward', hi: 'सीधे नीचे, आगे नहीं' },
    ],
    commonMistakes: {
      depth: { en: 'Too short a step, so the back knee never drops far enough.', hi: 'कदम छोटा होना, जिससे पिछला घुटना नीचे नहीं आता।' },
      torso_lean: { en: 'Leaning over the front thigh instead of staying tall.', hi: 'सीधे रहने के बजाय आगे की जांघ पर झुकना।' },
      tempo: { en: 'Falling into the bottom instead of controlling it.', hi: 'नियंत्रण के बिना नीचे गिरना।' },
    },
    shadowCue: { en: 'Match the ghost — straight down', hi: 'आकृति के साथ — सीधे नीचे' },
  },
}
