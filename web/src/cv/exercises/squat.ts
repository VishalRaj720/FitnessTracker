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
  coaching: {
    glossary: {
      kneeAngle: 'hip-knee-ankle angle in degrees. 180 is a straight leg standing; 90 means the thighs have reached parallel with the floor.',
      hipAngle: 'shoulder-hip-knee angle in degrees. Smaller means a deeper hip hinge — the torso has folded toward the thighs.',
      torsoLean: 'degrees the torso is tilted away from vertical. 0 is perfectly upright.',
      kneeAnkleRatio: 'gap between the knees divided by the gap between the ankles. Below 1 means the knees are falling inward. Only meaningful from a front view.',
      hipY: 'height of the hips in the frame, measured downward from the top. Larger means lower.',
    },
    reference: {
      angles: {
        kneeAngle: { top: [160, 180], bottom: [70, 100] },
        torsoLean: { max: 45 },
        kneeAnkleRatio: { min: 0.85 },
      },
      tempo: { descentMs: [800, 1800], ascentMs: [600, 1500], bottomMs: [0, 700] },
    },
    notes: [
      'A good squat starts at the hips: they travel back before the knees travel forward, so hipAngle begins closing slightly before kneeAngle does.',
      'The classic failure on the way up is the hips rising faster than the chest. In the series this shows as torsoLean still increasing, or holding high, while kneeAngle is already opening — the lift has turned into a good-morning. The fix is to drive the chest up and think about pushing the floor away, not about standing up.',
      'Depth and lean trade off: people who cannot reach parallel usually tip forward to fake it, so a shallow kneeAngle together with a large torsoLean is one problem, not two. Ankle mobility or a narrow stance is the usual cause.',
      'Across a set, a torsoLean that climbs rep by rep while depth holds is fatigue in the trunk, not the legs — cue bracing rather than depth.',
      'A very short bottomMs with a fast ascentMs means the rep was bounced out of the hole rather than controlled.',
      'Knees drifting inward (kneeAnkleRatio falling) usually appears first on the hardest reps at the end of a set.',
    ].join(' '),
  },
  tutorial: {
    steps: [
      {
        id: 'stance',
        title: { en: 'Set your stance', hi: 'अपना स्टांस बनाएँ' },
        body: {
          en: 'Stand side-on to the camera, feet about shoulder-width apart, toes pointing slightly out.',
          hi: 'कैमरे की ओर बगल से खड़े हों, पैर कंधों जितने चौड़े, पंजे हल्के बाहर।',
        },
      },
      {
        id: 'descend',
        title: { en: 'Sit back, not just down', hi: 'पीछे बैठें, सिर्फ़ नीचे नहीं' },
        body: {
          en: 'Push your hips back first, as if reaching for a chair behind you. Your knees bend as a result, not first.',
          hi: 'पहले कूल्हे पीछे ले जाएँ, जैसे पीछे रखी कुर्सी पर बैठ रहे हों। घुटने उसके बाद मुड़ते हैं।',
        },
      },
      {
        id: 'depth',
        title: { en: 'Reach parallel', hi: 'समानांतर तक जाएँ' },
        body: {
          en: 'Go down until your thighs are at least parallel to the floor. The camera only counts a rep once you get there.',
          hi: 'जब तक जांघें फ़र्श के समानांतर न हों, नीचे जाएँ। कैमरा तभी रेप गिनता है।',
        },
      },
      {
        id: 'drive',
        title: { en: 'Drive up', hi: 'ऊपर उठें' },
        body: {
          en: 'Push through your heels and stand tall. Keep your chest lifted the whole way up.',
          hi: 'एड़ियों से दबाव देकर सीधे खड़े हों। पूरे समय सीना ऊपर रखें।',
        },
      },
    ],
    keyPoints: [
      { en: 'Thighs at least parallel at the bottom', hi: 'नीचे जांघें कम से कम समानांतर' },
      { en: 'Chest up, back flat', hi: 'सीना ऊपर, पीठ सीधी' },
      { en: 'Knees track over your toes', hi: 'घुटने पंजों की सीध में' },
    ],
    commonMistakes: {
      depth: { en: 'Stopping high — a quarter squat will not be counted.', hi: 'ऊपर ही रुक जाना — आधा-अधूरा स्क्वाट नहीं गिना जाएगा।' },
      torso_lean: { en: 'Folding forward at the chest instead of hinging at the hips.', hi: 'कूल्हों से झुकने के बजाय सीने से आगे झुकना।' },
      knee_valgus: { en: 'Letting the knees collapse inward as you stand up.', hi: 'उठते समय घुटनों का अंदर की ओर मुड़ना।' },
      tempo: { en: 'Dropping and bouncing instead of controlling the descent.', hi: 'नियंत्रण के बिना गिरना और उछलना।' },
    },
    shadowCue: { en: 'Match the ghost — sit back and down', hi: 'आकृति के साथ चलें — पीछे और नीचे बैठें' },
  },
}
