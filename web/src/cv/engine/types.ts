import type { Pose } from '@/cv/pose/landmarks'
import type { RepKinematics } from '@/cv/engine/FeatureTrace'

export type Features = Record<string, number>

export type Phase = 'TOP' | 'GOING_DOWN' | 'BOTTOM' | 'GOING_UP'

export interface RepStats {
  /** Extreme value of the primary feature reached during the rep (the "bottom"). */
  extreme: number
  durationMs: number
  startTs: number
  endTs: number
  /** Snapshot of all features at the moment the FSM entered BOTTOM. */
  atBottom: Features
  /** Snapshot of all features at rep completion (back at TOP). */
  atTop: Features
  /**
   * The shape of the rep: every feature sampled across it, plus the phase durations.
   *
   * Present for completed reps, absent for partials (there was no rep to describe). Rules
   * read it through the helpers in `traceMath` so they can judge *how* the rep was done —
   * dropped or lowered, bounced or paused, hips before chest — not just where it ended up.
   */
  kinematics?: RepKinematics
}

export interface Violation {
  ruleId: string
  cue: string
  severity: 1 | 2 | 3
  penalty: number
}

export interface FormRule {
  id: string
  /** When to evaluate: at rep completion (with RepStats), on a partial rep, or every frame (holds). */
  phase: 'rep_complete' | 'partial' | 'any'
  cue: { en: string; hi: string }
  severity: 1 | 2 | 3
  penalty: number
  /** Only valid from this camera view; skipped otherwise. */
  orientation?: 'side' | 'front'
  /**
   * Return true when the rule is violated.
   *
   * `history` holds the recent completed reps, oldest first, with the rep being judged
   * last. Trend rules (fatigue, asymmetry, fading depth) need it; everything else ignores
   * it. Empty for holds and for the first reps of a set.
   */
  check: (f: Features, rep: RepStats | null, history?: RepKinematics[]) => boolean
}

export interface RepFsmConfig {
  /** Name of the primary feature in `features`. */
  feature: string
  /** Is the resting (TOP) position the high or low value of the feature? */
  restIs: 'high' | 'low'
  /** Enter TOP when feature passes this (from the moving side). */
  topEnter: number
  /** Leave TOP (start GOING_DOWN) when feature passes this. */
  topExit: number
  /** Enter BOTTOM when feature passes this. */
  bottomEnter: number
  /** Leave BOTTOM (start GOING_UP) when feature passes this. */
  bottomExit: number
  /** Reject reps faster than this (jitter double counts). */
  minRepMs: number
  /** A "partial" is logged when the user left TOP but turned back before this value. */
  partialThreshold?: number
  /** Consecutive frames a threshold must hold before a phase change is accepted. */
  confirmFrames?: number
}

export interface HoldConfig {
  feature: string
  min: number
  max: number
  /** Frames the pose may be out of tolerance before the timer pauses. */
  graceFrames?: number
}

export interface I18n {
  en: string
  hi: string
}

/**
 * Teaching content for the guided tutorial. Lives beside the rules on purpose: the
 * mistakes it warns about are keyed by `FormRule.id`, so the tutorial can only describe
 * errors the analyzer can actually detect, and adding an exercise stays a one-file job.
 */
export interface TutorialSpec {
  /** Ordered coaching points shown while the demo loops. */
  steps: { id: string; title: I18n; body: I18n }[]
  /** The two or three things that matter most, shown as a checklist. */
  keyPoints: I18n[]
  /** What tends to go wrong, keyed by the rule that catches it. */
  commonMistakes: Record<string, I18n>
  /** Spoken while the user shadows the demo. */
  shadowCue: I18n
}

/**
 * Domain knowledge handed to the coach model alongside a rep's joint-angle series.
 *
 * This deliberately supplies *understanding*, not conclusions. The rules already compute
 * verdicts; if the model were only given those it could paraphrase them and nothing more.
 * Given the glossary, the envelope of a good rep and the coaching notes, it can reason about
 * the numbers directly — which is what lets it catch tempo drift, asymmetry, fatigue and
 * compensation patterns that no FormRule encodes.
 */
export interface CoachingSpec {
  /** What each feature means, in words. Keys must match the keys `features()` returns. */
  glossary: Record<string, string>
  reference: {
    /** The band a good rep passes through. Not a rule — a yardstick for the model. */
    angles: Record<string, { top?: [number, number]; bottom?: [number, number]; max?: number; min?: number }>
    tempo: { descentMs?: [number, number]; ascentMs?: [number, number]; bottomMs?: [number, number] }
  }
  /** How this movement fails, and what actually fixes it. */
  notes: string
}

export interface ExerciseDefinition {
  id: string
  name: string
  mode: 'reps' | 'hold'
  orientation: 'side' | 'front' | 'any'
  requiredLandmarks: readonly number[]
  features: (pose: Pose) => Features
  fsm?: RepFsmConfig
  hold?: HoldConfig
  rules: FormRule[]
  /** Positive cue spoken after N clean reps in a row. */
  praise?: string
  tutorial?: TutorialSpec
  coaching?: CoachingSpec
}

export type AnalyzerEvent =
  | { type: 'phase'; phase: Phase }
  | { type: 'rep'; count: number; score: number; violations: Violation[]; stats: RepStats; kinematics: RepKinematics }
  | { type: 'partial'; violations: Violation[] }
  | { type: 'hold_tick'; heldMs: number; inTolerance: boolean; violations: Violation[] }
  | { type: 'gated'; reason: 'visibility' }
  | { type: 'ungated' }
