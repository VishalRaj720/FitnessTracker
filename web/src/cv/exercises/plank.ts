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
    // Soft knees do not move the shoulder-hip-ankle angle much, so bodyLine cannot see them.
    const kneeAngle = angleDeg(j.hip, j.knee, j.ankle)
    return { bodyLine, hipOffset: off, kneeAngle }
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
    // Graded severity. These overlap the two rules above on purpose: when the position is
    // badly lost, both fire and the arbiter speaks the higher-severity one, so the cue gets
    // more urgent without a second threshold system. Hold penalties are 0, so nothing
    // double-counts — the score for a hold is time in tolerance, not a penalty sum.
    {
      id: 'hip_sag_severe',
      phase: 'any',
      cue: { en: 'Reset — come back up to the line', hi: 'रुकें — सीध में वापस आएँ' },
      severity: 3,
      penalty: 0,
      check: (f) => f.bodyLine < 142 && (f.hipOffset ?? 0) > 0,
    },
    {
      id: 'hip_pike_severe',
      phase: 'any',
      cue: { en: 'Drop your hips right down into line', hi: 'कूल्हे पूरी तरह सीध में लाएँ' },
      severity: 3,
      penalty: 0,
      check: (f) => f.bodyLine < 142 && (f.hipOffset ?? 0) <= 0,
    },
    {
      id: 'knee_bend',
      phase: 'any',
      cue: { en: 'Straighten your legs', hi: 'पैर सीधे करें' },
      severity: 2,
      penalty: 0,
      check: (f) => (f.kneeAngle ?? 180) < 158,
    },
  ],
  praise: 'Hold it',
  coaching: {
    glossary: {
      bodyLine: 'shoulder-hip-ankle angle in degrees. 180 is a perfectly straight body; the timer only runs between 158 and 185.',
      hipOffset: 'how far the hips sit off the straight line between shoulders and ankles, in torso lengths. Positive means the hips have dropped below the line; negative means they are lifted above it.',
      kneeAngle: 'hip-knee-ankle angle in degrees. 180 is a straight leg; anything much below means the knees have softened and the hold is being made easier.',
    },
    reference: {
      angles: {
        bodyLine: { min: 158, max: 185 },
        hipOffset: { min: -0.05, max: 0.05 },
        kneeAngle: { min: 165 },
      },
      tempo: {},
    },
    notes: [
      'This is a hold, so there are no reps — judge it as a drift over time. A bodyLine that is steady says the position is under control; one that slides in one direction says it is being lost.',
      'The sign of hipOffset separates the two failures, and they need opposite cues: positive is sagging, which needs the glutes squeezed and the ribs pulled down; negative is piking the hips up, which is usually someone making the hold easier, and needs the hips lowered.',
      'Sag that appears gradually is fatigue and is worth calling early, before the timer stops. Sag that appears immediately means the starting position was wrong.',
      'Do not cue breathing or bracing as a fix for piking — piking is a choice, not a failure.',
    ].join(' '),
  },
  tutorial: {
    steps: [
      {
        id: 'setup',
        title: { en: 'Phone on the floor, side-on', hi: 'फ़ोन ज़मीन पर, बगल से' },
        body: {
          en: 'Place the phone on the floor about two metres away so it sees your body side-on from head to heel.',
          hi: 'फ़ोन ज़मीन पर लगभग दो मीटर दूर रखें ताकि सिर से एड़ी तक बगल से दिखे।',
        },
      },
      {
        id: 'line',
        title: { en: 'Make one straight line', hi: 'एक सीधी रेखा बनाएँ' },
        body: {
          en: 'Elbows or hands under your shoulders. Squeeze your glutes and brace your stomach so your body forms a single line.',
          hi: 'कोहनी या हाथ कंधों के नीचे। कूल्हे और पेट कसें ताकि शरीर एक सीध में रहे।',
        },
      },
      {
        id: 'hold',
        title: { en: 'Hold, and keep breathing', hi: 'रोकें, और साँस लेते रहें' },
        body: {
          en: 'The timer only runs while your body line stays straight. It pauses if your hips drop or ride up.',
          hi: 'टाइमर तभी चलता है जब शरीर सीधा रहे। कूल्हे गिरने या उठने पर रुक जाता है।',
        },
      },
    ],
    keyPoints: [
      { en: 'Shoulders, hips and ankles in line', hi: 'कंधे, कूल्हे और टखने एक सीध में' },
      { en: 'Glutes and stomach braced', hi: 'कूल्हे और पेट कसे हुए' },
      { en: 'Breathe — do not hold your breath', hi: 'साँस लेते रहें — रोकें नहीं' },
    ],
    commonMistakes: {
      hip_sag: { en: 'Hips sinking toward the floor, which stops the timer.', hi: 'कूल्हे नीचे गिरना, जिससे टाइमर रुक जाता है।' },
      hip_pike: { en: 'Hips riding up into an upside-down V to make it easier.', hi: 'आसान करने के लिए कूल्हे ऊपर उठाना।' },
      knee_bend: { en: 'Letting the knees bend, which takes the work off the middle.', hi: 'घुटने मोड़ लेना, जिससे पेट पर ज़ोर कम हो जाता है।' },
    },
    shadowCue: { en: 'Hold the line', hi: 'सीध बनाए रखें' },
  },
}
