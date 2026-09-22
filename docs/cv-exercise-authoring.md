# Adding a camera-tracked exercise

Everything lives in `web/src/cv/`. The engine is generic; an exercise is a **declarative definition**. Adding one never touches the engine.

## 1. Seed the catalog

Add the exercise to `backend/seeds/exercises.json` with `cv_supported: true` and the required `orientation` (`side` / `front`). Restart the API (auto-seeds) or run `uv run python -m seeds.seed`.

## 2. Write the definition

Create `web/src/cv/exercises/<slug>.ts` implementing `ExerciseDefinition` (`engine/types.ts`):

```ts
export const situp: ExerciseDefinition = {
  id: 'situp',                 // must equal the backend slug
  name: 'Sit-up',
  mode: 'reps',                // or 'hold'
  orientation: 'side',
  requiredLandmarks: [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE],
  features: (pose) => {        // pure function: Pose -> named numbers
    const j = sideJoints(pose, betterSide(pose))
    return { hipAngle: angleDeg(j.shoulder, j.hip, j.knee) }
  },
  fsm: {                       // 4-phase counter with hysteresis
    feature: 'hipAngle',
    restIs: 'high',            // lying flat = large hip angle = rest
    topEnter: 150, topExit: 140,   // leaving/entering the rest position
    bottomEnter: 70, bottomExit: 85, // the "bottom" of the rep
    minRepMs: 700,
    partialThreshold: 120,     // went past this but not to bottom -> "partial" cue
    confirmFrames: 2,
  },
  rules: [
    { id: 'depth', phase: 'partial', cue: { en: 'Come all the way up', hi: 'पूरा ऊपर आएँ' }, severity: 3, penalty: 25, check: () => true },
    { id: 'tempo', phase: 'rep_complete', cue: { en: 'Slow down', hi: 'धीरे करें' }, severity: 1, penalty: 10,
      check: (_f, rep) => !!rep && rep.durationMs < 800 },
  ],
  praise: 'Strong core',
}
```

Register it in `web/src/cv/exercises/index.ts`.

**Holds** use `hold: { feature, min, max, graceFrames }` instead of `fsm`; rules with `phase: 'any'` fire while out of tolerance.

## 3. Threshold hygiene

- Keep ≥ 10° (or ≥ 0.2 ratio) between enter/exit thresholds — that gap is what kills double counts.
- `minRepMs` should be ~60% of the fastest legitimate rep.
- Express pixel-based rules in torso-length units (`torsoLength(pose)`) so they work at any distance.
- Tag rules that only make sense from one view with `orientation`; they are skipped otherwise.

## 4. Calibrate on real people

Open `/dev/record` in Chrome, pick the exercise, hit **Record**, do N reps, **Stop**, **Download JSON** (enter the true count). Drop the file into `web/tests/fixtures/`. `npm test` now asserts exact rep count and determinism for that recording.

Protocol for the hackathon: 10 people × 3 lighting conditions × 2 devices per exercise; target ≥ 95% rep accuracy and ≤ 1 false cue per 10 reps. Tune thresholds in the definition, re-run `npm test`, commit fixtures with the change.

## 5. Copy for the cue

Cues are ≤ 4 words, imperative, and spoken; test them by ear with `speechSynthesis`. Severity 3 = not counted, 2 = safety/form, 1 = polish.
