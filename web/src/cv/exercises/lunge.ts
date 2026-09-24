import type { ExerciseDefinition } from '@/cv/engine/types'
import { LM } from '@/cv/pose/landmarks'
import { angleDeg, mid, torsoLength, verticalAngleDeg } from '@/cv/geometry/angles'
import { alternatingGap, changeOver, descentWindow, maxIn, minIn, trendAcross } from '@/cv/engine/traceMath'

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
    const torso = Math.max(1e-3, torsoLength(pose))
    // How long the split is: the front-to-back gap between the feet, in torso lengths, so it
    // means the same thing at any camera distance. Near 0 is a standing position with the
    // feet level; a lunge that can actually reach 90 degrees needs roughly 1.5.
    const stance = Math.abs(pose[LM.L_ANKLE].x - pose[LM.R_ANKLE].x) / torso
    // How far the front knee has travelled past its own toes — the fault that short steps
    // cause. The front leg is whichever knee is more bent, and "forward" is taken from the
    // back foot to the front one, so nothing depends on which way the user faces. Measuring
    // forward from the hips instead fails exactly when it matters: on a very short step the
    // front foot can land behind the hips while the knee is far out over the toes, and the
    // sign flips at the moment the fault is worst.
    const frontLeft = lKnee <= rKnee
    const fKnee = frontLeft ? pose[LM.L_KNEE] : pose[LM.R_KNEE]
    const fAnkle = frontLeft ? pose[LM.L_ANKLE] : pose[LM.R_ANKLE]
    const bAnkle = frontLeft ? pose[LM.R_ANKLE] : pose[LM.L_ANKLE]
    const fToe = frontLeft ? pose[LM.L_FOOT] : pose[LM.R_FOOT]
    const fwd = fAnkle.x >= bAnkle.x ? 1 : -1
    const kneeOverToe = (fToe?.visibility ?? 0) < 0.5 ? 0 : (fwd * (fKnee.x - fToe.x)) / torso
    return { minKnee, torsoLean, stance, kneeOverToe }
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
    {
      id: 'short_stance',
      phase: 'rep_complete',
      cue: { en: 'Take a longer step', hi: 'कदम लंबा रखें' },
      severity: 2,
      penalty: 12,
      // The root cause of most bad lunges, and the one to cue first: with the feet too close
      // together the front knee physically cannot reach 90 without shooting past the toes,
      // so "go lower" only makes the knee worse.
      check: (_f, rep) => !!rep && (rep.atBottom.stance ?? 2) < 0.8,
    },
    {
      id: 'knee_past_toes',
      phase: 'rep_complete',
      cue: { en: 'Knee over your ankle, not past your toes', hi: 'घुटना टखने के ऊपर, पंजों से आगे नहीं' },
      severity: 2,
      penalty: 12,
      orientation: 'side',
      check: (_f, rep) => !!rep && (rep.atBottom.kneeOverToe ?? 0) > 0.05,
    },
    // ---- Rules that read the shape of the rep, not just its extremes -------------------
    {
      id: 'stance_collapse',
      phase: 'rep_complete',
      cue: { en: 'Straight down, not forward', hi: 'सीधे नीचे, आगे नहीं' },
      severity: 2,
      penalty: 10,
      // Descending forward instead of straight down: the split shortens on the way in as the
      // body travels over the front foot.
      check: (_f, rep) => {
        const k = rep?.kinematics
        if (!k) return false
        const [u0, u1] = descentWindow(k)
        return changeOver(k.series.stance, u0, u1) < -0.25
      },
    },
    {
      id: 'side_asymmetry',
      phase: 'rep_complete',
      cue: { en: 'Match your other side', hi: 'दूसरी तरफ़ भी बराबर करें' },
      severity: 1,
      penalty: 8,
      // Lunges alternate legs, so consecutive reps *are* the two sides. That makes the odd
      // and even reps the only left/right comparison a single camera can make, and lunges
      // expose side differences more than anything else here.
      check: (_f, _rep, history) => alternatingGap(history, (k) => minIn(k.series.minKnee)) > 12,
    },
    {
      id: 'depth_fade',
      phase: 'rep_complete',
      cue: { en: 'Same depth as your first reps', hi: 'पहले जितना नीचे जाएँ' },
      severity: 2,
      penalty: 10,
      check: (_f, _rep, history) => trendAcross(history, (k) => minIn(k.series.minKnee)) > 5,
    },
    {
      id: 'lean_creep',
      phase: 'rep_complete',
      cue: { en: 'Stay tall as you tire', hi: 'थकने पर भी सीधे रहें' },
      severity: 2,
      penalty: 10,
      check: (_f, _rep, history) => trendAcross(history, (k) => maxIn(k.series.torsoLean)) > 3,
    },
    {
      id: 'dropping',
      phase: 'rep_complete',
      cue: { en: 'Lower it under control', hi: 'नियंत्रण से नीचे जाएँ' },
      severity: 2,
      penalty: 10,
      check: (_f, rep) => {
        const k = rep?.kinematics
        return !!k && k.descentMs > 0 && k.ascentMs > 0 && k.descentMs < 400 && k.descentMs * 1.5 < k.ascentMs
      },
    },
  ],
  praise: 'Strong lunge',
  coaching: {
    glossary: {
      minKnee: 'the more bent of the two knee angles, in degrees. This is the front leg at the bottom of a lunge; 90 is a full lunge, 180 is standing.',
      torsoLean: 'degrees the torso is tilted away from vertical. 0 is perfectly upright.',
      stance: 'front-to-back gap between the feet, in torso lengths. Near 0 means the feet are level — barely a lunge at all; a step long enough to reach 90 degrees is about 1.5.',
      kneeOverToe: 'how far the front knee sits past its own toes, in torso lengths. Negative means the knee is still behind the toes, which is what you want. Only meaningful at the bottom of the rep.',
    },
    reference: {
      angles: {
        minKnee: { top: [155, 180], bottom: [80, 110] },
        torsoLean: { max: 25 },
        stance: { min: 1.2 },
        kneeOverToe: { max: 0 },
      },
      tempo: { descentMs: [900, 2000], ascentMs: [700, 1600], bottomMs: [0, 700] },
    },
    notes: [
      'A small stance is the root cause of most shallow lunges: with the feet too close together the front knee cannot reach 90 without the knee travelling far past the toes, so the user stops short. Cue a longer step before cueing more depth — and read stance and kneeOverToe together, because they are the same fault seen twice.',
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
      short_stance: { en: 'Too short a step, which forces the knee past the toes.', hi: 'छोटा कदम, जिससे घुटना पंजों से आगे निकल जाता है।' },
      knee_past_toes: { en: 'Front knee shooting past the toes and taking the load onto the joint.', hi: 'आगे का घुटना पंजों से आगे जाना और जोड़ पर भार आना।' },
      side_asymmetry: { en: 'One leg going consistently deeper than the other.', hi: 'एक पैर दूसरे से हमेशा ज़्यादा नीचे जाना।' },
    },
    shadowCue: { en: 'Match the ghost — straight down', hi: 'आकृति के साथ — सीधे नीचे' },
  },
}
