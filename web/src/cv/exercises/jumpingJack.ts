import type { ExerciseDefinition, RepStats } from '@/cv/engine/types'
import { LM } from '@/cv/pose/landmarks'
import { dist, shoulderWidth, torsoLength } from '@/cv/geometry/angles'
import { maxIn, peakAt, trendAcross } from '@/cv/engine/traceMath'

/**
 * How high the hands actually got during a repetition, in torso lengths.
 *
 * Falls back to the snapshot taken at full foot spread when there is no series to read,
 * which is the only case where the two can disagree without the rep being wrong.
 */
function armPeak(rep: RepStats): number {
  const series = rep.kinematics?.series.armRaise
  const peak = maxIn(series)
  return Number.isFinite(peak) ? peak : (rep.atBottom.armRaise ?? 0)
}

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
      // Judged on the highest the hands got at any point in the rep, not on where they
      // were when the feet landed. The feet reach full spread while the arms are still
      // travelling, so the bottom snapshot reads a correct jumping jack as arms-too-low.
      check: (_f, rep) => !!rep && armPeak(rep) < 0.35,
    },
    {
      id: 'feet_narrow',
      phase: 'rep_complete',
      cue: { en: 'A little wider', hi: 'थोड़ा और चौड़ा' },
      severity: 1,
      penalty: 8,
      // Counted, but only just. `feet_wide` covers jumps that never reached the threshold
      // at all; this one catches the set quietly shrinking to the minimum that still counts.
      check: (_f, rep) => !!rep && rep.extreme < 1.9,
    },
    {
      id: 'arms_stall',
      phase: 'rep_complete',
      cue: { en: 'Hands together above your head', hi: 'हाथ सिर के ऊपर मिलाएँ' },
      severity: 1,
      penalty: 8,
      // Arms that clear the shoulders but stop short of overhead. Below 0.35 is `arms_up`,
      // a different and blunter cue, so the two never fire together.
      check: (_f, rep) => {
        if (!rep) return false
        const peak = armPeak(rep)
        return peak >= 0.35 && peak < 0.6
      },
    },
    // ---- Rules that read the shape of the rep, not just its extremes -------------------
    {
      id: 'arms_lagging',
      phase: 'rep_complete',
      cue: { en: 'Arms and legs together', hi: 'हाथ और पैर साथ चलाएँ' },
      severity: 2,
      penalty: 10,
      // Arms and legs are supposed to arrive together. When the feet peak noticeably before
      // the hands do, the arms are being dragged along after the jump, which is the usual
      // reason this stops feeling like cardio. Only the timing of the two peaks shows it.
      check: (_f, rep) => {
        const k = rep?.kinematics
        if (!k) return false
        return peakAt(k.series.armRaise) - peakAt(k.series.feetSpread) > 0.12
      },
    },
    {
      id: 'amplitude_fade',
      phase: 'rep_complete',
      cue: { en: 'Open all the way — full jumps', hi: 'पूरा खुलें — पूरी कूद' },
      severity: 2,
      penalty: 10,
      // The characteristic decay here is amplitude, not speed: the rhythm holds while the
      // jumps quietly shrink. Cue opening fully rather than going faster.
      check: (_f, _rep, history) => trendAcross(history, (k) => maxIn(k.series.feetSpread)) < -0.12,
    },
    {
      id: 'arms_fade',
      phase: 'rep_complete',
      cue: { en: 'Keep the arms going all the way up', hi: 'हाथ पूरे ऊपर तक ले जाते रहें' },
      severity: 2,
      penalty: 10,
      check: (_f, _rep, history) => trendAcross(history, (k) => maxIn(k.series.armRaise)) < -0.08,
    },
  ],
  praise: 'Nice rhythm',
  coaching: {
    glossary: {
      feetSpread: 'distance between the ankles divided by shoulder width. About 0.6 with the feet together; a full jumping jack opens past 1.8.',
      armRaise: 'how far the higher wrist is above the shoulders, in torso lengths. Negative means the arms are still below the shoulders; about 1 means hands meeting overhead.',
    },
    reference: {
      angles: {
        feetSpread: { top: [0.4, 1.1], bottom: [1.8, 2.8] },
        armRaise: { min: 0.35 },
      },
      tempo: { descentMs: [300, 900], ascentMs: [300, 900] },
    },
    notes: [
      'Arms and legs are supposed to arrive together. A feetSpread that peaks noticeably before armRaise does means the arms are lagging the jump, which is the usual reason this stops feeling like cardio.',
      'The most common decay is amplitude, not speed: as the set goes on feetSpread and armRaise both shrink while the rhythm stays the same. Cue opening fully rather than going faster.',
      'A peak armRaise that never gets above about 0.35 means the arms are stopping at shoulder height.',
      'This is the one movement where a faster tempo is not automatically worse — judge it on amplitude first.',
    ].join(' '),
  },
  tutorial: {
    steps: [
      {
        id: 'face',
        title: { en: 'Face the camera', hi: 'कैमरे की ओर मुँह करें' },
        body: {
          en: 'Stand facing the camera with your whole body in frame, feet together and arms by your sides.',
          hi: 'कैमरे की ओर मुँह करके खड़े हों, पूरा शरीर फ़्रेम में, पैर जुड़े और हाथ बग़ल में।',
        },
      },
      {
        id: 'open',
        title: { en: 'Jump wide, arms overhead', hi: 'चौड़ा कूदें, हाथ ऊपर' },
        body: {
          en: 'Jump your feet out well past shoulder width and sweep your arms all the way above your head in the same beat.',
          hi: 'पैर कंधों से काफ़ी चौड़े कूदें और उसी लय में हाथ सिर के ऊपर ले जाएँ।',
        },
      },
      {
        id: 'rhythm',
        title: { en: 'Keep the rhythm', hi: 'लय बनाए रखें' },
        body: {
          en: 'Jump back to feet together, arms down. A steady, repeatable beat matters more than speed.',
          hi: 'वापस पैर जोड़ें, हाथ नीचे। तेज़ी से ज़्यादा ज़रूरी है एक समान लय।',
        },
      },
    ],
    keyPoints: [
      { en: 'Feet well past shoulder width', hi: 'पैर कंधों से काफ़ी चौड़े' },
      { en: 'Hands meet above your head', hi: 'हाथ सिर के ऊपर मिलें' },
      { en: 'Land softly on the balls of your feet', hi: 'पंजों पर हल्के से उतरें' },
    ],
    commonMistakes: {
      feet_wide: { en: 'Narrow, shuffling jumps that never open far enough to count.', hi: 'संकरी कूद जो गिनने लायक चौड़ी नहीं होती।' },
      arms_up: { en: 'Arms stopping at shoulder height instead of going overhead.', hi: 'हाथ कंधे तक रुक जाना, ऊपर न जाना।' },
      arms_lagging: { en: 'Arms trailing behind the jump instead of arriving with it.', hi: 'हाथ कूद के साथ न आकर पीछे रह जाना।' },
      amplitude_fade: { en: 'Jumps shrinking as the set goes on, even though the rhythm holds.', hi: 'लय बनी रहने पर भी कूद छोटी होती जाना।' },
    },
    shadowCue: { en: 'Match the ghost — all the way open', hi: 'आकृति के साथ — पूरा खुलें' },
  },
}
