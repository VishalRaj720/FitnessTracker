import type { ExerciseDefinition } from '@/cv/engine/types'
import { LM } from '@/cv/pose/landmarks'
import { angleDeg, betterSide, dist, mid, sideJoints, torsoLength, verticalAngleDeg } from '@/cv/geometry/angles'
import { ascentWindow, changeOver, maxIn, minIn, trendAcross } from '@/cv/engine/traceMath'

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
    // Heel lift: y grows downward, so a heel that has left the floor sits *above* the toe.
    // Both points are low-confidence on a phone at floor level, so a foot the model cannot
    // see reports 0 rather than a fault — the rule reading this must not fire on a guess.
    const heel = side === 'left' ? pose[LM.L_HEEL] : pose[LM.R_HEEL]
    const toe = side === 'left' ? pose[LM.L_FOOT] : pose[LM.R_FOOT]
    const footSeen = Math.min(heel?.visibility ?? 0, toe?.visibility ?? 0)
    const heelLift = footSeen < 0.5 ? 0 : (toe.y - heel.y) / Math.max(1e-3, torsoLength(pose))
    return { kneeAngle, hipAngle, torsoLean, kneeAnkleRatio, hipY, heelLift }
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
    // ---- Rules that read the shape of the rep, not just its extremes -------------------
    //
    // Everything below needs `rep.kinematics` (this rep's curve) or `history` (the reps
    // before it). These are the faults a coach calls out mid-set that a pair of snapshots
    // cannot see: how the rep was performed rather than where it ended up.
    {
      id: 'hips_before_chest',
      phase: 'rep_complete',
      cue: { en: 'Chest first, then hips', hi: 'पहले सीना, फिर कूल्हे' },
      severity: 3,
      penalty: 15,
      orientation: 'side',
      // The good-morning: out of the hole the knees straighten while the torso stays folded
      // over, turning the squat into a stiff-legged back lift. Judged over the first half of
      // the ascent, where the two joints are supposed to move together.
      check: (_f, rep) => {
        const k = rep?.kinematics
        if (!k) return false
        const [u0, u1] = ascentWindow(k)
        const half = u0 + (u1 - u0) * 0.55
        const kneeOpened = changeOver(k.series.kneeAngle, u0, half)
        const leanRecovered = -changeOver(k.series.torsoLean, u0, half)
        return kneeOpened > 20 && leanRecovered < 4
      },
    },
    {
      id: 'lean_creep',
      phase: 'rep_complete',
      cue: { en: 'Brace your core — chest is dropping', hi: 'पेट कसें — सीना गिर रहा है' },
      severity: 2,
      penalty: 10,
      orientation: 'side',
      // Lean climbing while depth holds is the trunk tiring, not the legs. Cue bracing, not
      // depth — telling someone to go lower here just buys more lean.
      check: (_f, _rep, history) => {
        const lean = trendAcross(history, (k) => maxIn(k.series.torsoLean))
        const depth = trendAcross(history, (k) => minIn(k.series.kneeAngle))
        return lean > 3 && Math.abs(depth) < 6
      },
    },
    {
      id: 'depth_fade',
      phase: 'rep_complete',
      cue: { en: 'Same depth as your first reps', hi: 'पहले जितना नीचे जाएँ' },
      severity: 2,
      penalty: 10,
      check: (_f, _rep, history) => trendAcross(history, (k) => minIn(k.series.kneeAngle)) > 5,
    },
    //
    // Bouncing out of the hole is deliberately NOT a rule here, though it is a real fault
    // and the notes below ask the model about it. It cannot be measured from what the
    // analyzer keeps: `bottomMs` is time spent below a fixed angle, so a deep rep reports a
    // long bottom whether or not the user paused, and eight samples per rep is too coarse to
    // resolve the dwell directly. A rule for it would be a guess dressed as a measurement.
    {
      id: 'dropping',
      phase: 'rep_complete',
      cue: { en: 'Lower it under control', hi: 'नियंत्रण से नीचे जाएँ' },
      severity: 2,
      penalty: 10,
      // Falling in rather than lowering: the descent takes half the time the ascent does.
      check: (_f, rep) => {
        const k = rep?.kinematics
        return !!k && k.descentMs > 0 && k.ascentMs > 0 && k.descentMs < 400 && k.descentMs * 1.5 < k.ascentMs
      },
    },
    {
      id: 'heel_lift',
      phase: 'rep_complete',
      cue: { en: 'Keep your heels down', hi: 'एड़ियाँ ज़मीन पर रखें' },
      severity: 2,
      penalty: 15,
      orientation: 'side',
      check: (_f, rep) => !!rep && (rep.atBottom.heelLift ?? 0) > 0.08,
    },
    {
      id: 'shallow_with_lean',
      phase: 'rep_complete',
      cue: { en: 'Widen your stance and sit back', hi: 'पैर चौड़े करें और पीछे बैठें' },
      severity: 2,
      penalty: 8,
      orientation: 'side',
      // Shallow *and* leaning is one problem, not two: the depth is missing because the
      // ankles or the stance will not allow it, so "go lower" is the wrong cue.
      check: (_f, rep) => !!rep && rep.extreme > 100 && (rep.atBottom.torsoLean ?? 0) > 40,
    },
    {
      id: 'knee_cave_late',
      phase: 'rep_complete',
      cue: { en: 'Push your knees out as you stand', hi: 'उठते समय घुटने बाहर रखें' },
      severity: 2,
      penalty: 12,
      orientation: 'front',
      // Knees that were fine at the bottom and collapse on the way up, the hardest part of
      // the rep. Knees already in at the bottom are `knee_valgus`, so the two never overlap.
      check: (_f, rep) => {
        const k = rep?.kinematics
        if (!k || !rep || (rep.atBottom.kneeAnkleRatio ?? 1) < 0.75) return false
        const [u0, u1] = ascentWindow(k)
        return minIn(k.series.kneeAnkleRatio, u0, u1) < 0.82
      },
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
      heelLift: 'how far the heel has come off the floor, in torso lengths, measured against the toe. 0 is a flat foot; positive means the weight has shifted onto the toes.',
    },
    reference: {
      angles: {
        kneeAngle: { top: [160, 180], bottom: [70, 100] },
        torsoLean: { max: 45 },
        kneeAnkleRatio: { min: 0.85 },
        heelLift: { max: 0.05 },
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
      hips_before_chest: {
        en: 'Standing up hips-first, leaving the chest folded over — the squat becomes a back lift.',
        hi: 'पहले कूल्हे उठाना और सीना झुका रहना — स्क्वाट पीठ का व्यायाम बन जाता है।',
      },
      heel_lift: { en: 'Heels coming off the floor, usually tight ankles.', hi: 'एड़ियाँ ज़मीन से उठना, आमतौर पर टखनों की जकड़न।' },
      depth_fade: { en: 'Reps getting shallower as the set goes on.', hi: 'सेट के अंत तक रेप कम गहरे होना।' },
    },
    shadowCue: { en: 'Match the ghost — sit back and down', hi: 'आकृति के साथ चलें — पीछे और नीचे बैठें' },
  },
}
