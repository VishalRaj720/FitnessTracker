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
  coaching: {
    glossary: {
      elbowAngle: 'shoulder-elbow-wrist angle in degrees. 180 is a locked-out arm at the top; 90 means the chest has come down to about elbow height.',
      bodyLine: 'shoulder-hip-ankle angle in degrees. 180 is a perfectly straight body. Below 180 with the hips low is sagging; above is piking.',
    },
    reference: {
      angles: {
        elbowAngle: { top: [155, 180], bottom: [70, 100] },
        bodyLine: { min: 160, max: 190 },
      },
      tempo: { descentMs: [700, 1600], ascentMs: [500, 1400], bottomMs: [0, 600] },
    },
    notes: [
      'The body line is the thing that decays first. A bodyLine that starts near 180 and falls as the set goes on is the trunk giving out before the arms do — cue squeezing the glutes and bracing, not pressing harder.',
      'If bodyLine dips only at the bottom of each rep and recovers at the top, the hips are being used to sneak extra depth the arms have not earned.',
      'A partial rep with a fine body line is an arm-strength limit; a full rep with a collapsing body line is a core limit. They need opposite advice, so read elbowAngle and bodyLine together rather than separately.',
      'Very fast ascentMs with a near-zero bottomMs is bouncing off the floor, which unloads the chest at the hardest point.',
      'Elbows flaring wide is not directly visible from a side view, so do not claim it — stick to what the series shows.',
    ].join(' '),
  },
  tutorial: {
    steps: [
      {
        id: 'setup',
        title: { en: 'Place the phone on the floor', hi: 'फ़ोन ज़मीन पर रखें' },
        body: {
          en: 'Put the phone on the floor about two metres away, side-on, so it can see your whole body from head to heel.',
          hi: 'फ़ोन ज़मीन पर, लगभग दो मीटर दूर, बगल से रखें ताकि सिर से एड़ी तक दिखे।',
        },
      },
      {
        id: 'plank',
        title: { en: 'Start from a straight line', hi: 'सीधी रेखा से शुरू करें' },
        body: {
          en: 'Hands under your shoulders. Squeeze your glutes so your shoulders, hips and ankles form one straight line.',
          hi: 'हाथ कंधों के नीचे। कूल्हे कसें ताकि कंधे, कूल्हे और टखने एक सीध में हों।',
        },
      },
      {
        id: 'lower',
        title: { en: 'Lower your chest', hi: 'सीना नीचे लाएँ' },
        body: {
          en: 'Bend your elbows until they reach about 90 degrees. Keep them tucked back, not flared out sideways.',
          hi: 'कोहनियाँ लगभग 90 डिग्री तक मोड़ें। उन्हें पीछे रखें, बाहर की ओर न फैलाएँ।',
        },
      },
    ],
    keyPoints: [
      { en: 'One straight line, head to heel', hi: 'सिर से एड़ी तक एक सीध' },
      { en: 'Elbows to about 90 degrees', hi: 'कोहनियाँ लगभग 90 डिग्री' },
      { en: 'Hips neither sagging nor piked', hi: 'कूल्हे न झुकें, न ऊपर उठें' },
    ],
    commonMistakes: {
      depth: { en: 'Only dipping a few centimetres — the rep will not count.', hi: 'सिर्फ़ थोड़ा सा नीचे जाना — रेप नहीं गिनेगा।' },
      hip_sag: { en: 'Letting the hips drop toward the floor as you tire.', hi: 'थकने पर कूल्हों का फ़र्श की ओर गिरना।' },
      tempo: { en: 'Rushing — bouncing off the floor instead of pressing.', hi: 'जल्दबाज़ी — दबाने के बजाय उछलना।' },
    },
    shadowCue: { en: 'Match the ghost — chest to the floor', hi: 'आकृति के साथ — सीना फ़र्श की ओर' },
  },
}
