import type { ExerciseDefinition } from '@/cv/engine/types'
import { LM } from '@/cv/pose/landmarks'
import { angleDeg, betterSide, sideJoints, signedDistanceFromLine, torsoLength } from '@/cv/geometry/angles'
import { minIn, trendAcross } from '@/cv/engine/traceMath'

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
    // Which way the body line is broken, using the same signed measure the plank uses:
    // bodyLine alone cannot tell a sag from a pike, and the two need opposite cues.
    // Positive => the hips have dropped below the shoulder->ankle line.
    let hipOffset = signedDistanceFromLine(j.hip, j.shoulder, j.ankle) / Math.max(1e-3, torsoLength(pose))
    if (j.shoulder.x > j.ankle.x) hipOffset = -hipOffset
    return { elbowAngle, bodyLine, hipOffset }
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
      check: (_f, rep) => !!rep && (rep.atBottom.bodyLine ?? 180) < 155 && (rep.atBottom.hipOffset ?? 0) > 0,
    },
    {
      id: 'hip_pike',
      phase: 'rep_complete',
      cue: { en: 'Lower your hips into line', hi: 'कूल्हे नीचे कर सीध में लाएँ' },
      severity: 2,
      penalty: 15,
      // The other half of the same band: hips above the line, which shortens the lever and
      // makes the push-up easier. Squeezing harder is the wrong fix, so it needs its own cue.
      check: (_f, rep) => !!rep && (rep.atBottom.bodyLine ?? 180) < 155 && (rep.atBottom.hipOffset ?? 0) <= 0,
    },
    {
      id: 'tempo',
      phase: 'rep_complete',
      cue: { en: 'Slow down', hi: 'धीरे करें' },
      severity: 1,
      penalty: 10,
      check: (_f, rep) => !!rep && rep.durationMs < 800,
    },
    // ---- Rules that read the shape of the rep, not just its extremes -------------------
    {
      id: 'sag_progressive',
      phase: 'rep_complete',
      cue: { en: 'Squeeze your glutes — hips are sinking', hi: 'कूल्हे कसें — कमर गिर रही है' },
      severity: 2,
      penalty: 10,
      // The body line is what decays first in a push-up set. A bottom bodyLine falling rep
      // after rep is the trunk giving out before the arms do: cue bracing, not pressing.
      check: (_f, _rep, history) => trendAcross(history, (k) => minIn(k.series.bodyLine)) < -3,
    },
    {
      id: 'range_fade',
      phase: 'rep_complete',
      cue: { en: 'Chest all the way down', hi: 'सीना पूरा नीचे लाएँ' },
      severity: 2,
      penalty: 10,
      check: (_f, _rep, history) => trendAcross(history, (k) => minIn(k.series.elbowAngle)) > 5,
    },
    {
      id: 'sag_to_reach',
      phase: 'rep_complete',
      cue: { en: 'Hold the line — do not dip your hips to reach', hi: 'सीध बनाए रखें — कूल्हे झुकाकर नीचे न जाएँ' },
      severity: 2,
      penalty: 12,
      // Hips off the line at the bottom but back in line at the top: the hips are being used
      // to buy depth the arms have not earned. Distinct from a body line that sags all rep.
      check: (_f, rep) => !!rep && (rep.atBottom.hipOffset ?? 0) > 0.12 && (rep.atTop.hipOffset ?? 0) < 0.06,
    },
    {
      id: 'dropping',
      phase: 'rep_complete',
      cue: { en: 'Lower your chest under control', hi: 'सीना नियंत्रण से नीचे लाएँ' },
      severity: 2,
      penalty: 10,
      check: (_f, rep) => {
        const k = rep?.kinematics
        return !!k && k.descentMs > 0 && k.ascentMs > 0 && k.descentMs < 350 && k.descentMs * 1.5 < k.ascentMs
      },
    },
  ],
  praise: 'Solid push-up',
  coaching: {
    glossary: {
      elbowAngle: 'shoulder-elbow-wrist angle in degrees. 180 is a locked-out arm at the top; 90 means the chest has come down to about elbow height.',
      bodyLine: 'shoulder-hip-ankle angle in degrees. 180 is a perfectly straight body. Below 180 with the hips low is sagging; above is piking.',
      hipOffset: 'how far the hips sit off the straight line between shoulders and ankles, in torso lengths. Positive means the hips have dropped below the line; negative means they are lifted above it.',
    },
    reference: {
      angles: {
        elbowAngle: { top: [155, 180], bottom: [70, 100] },
        bodyLine: { min: 160, max: 190 },
        hipOffset: { min: -0.06, max: 0.06 },
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
      hip_pike: { en: 'Hips riding up into a V, which makes the push-up easier.', hi: 'कूल्हे ऊपर उठाकर पुश-अप आसान बनाना।' },
      sag_to_reach: { en: 'Dipping the hips to reach the floor instead of bending the arms.', hi: 'बाँहें मोड़ने के बजाय कूल्हे झुकाकर नीचे पहुँचना।' },
      range_fade: { en: 'Reps getting shorter as the arms tire.', hi: 'बाँहें थकने पर रेप छोटे होना।' },
    },
    shadowCue: { en: 'Match the ghost — chest to the floor', hi: 'आकृति के साथ — सीना फ़र्श की ओर' },
  },
}
