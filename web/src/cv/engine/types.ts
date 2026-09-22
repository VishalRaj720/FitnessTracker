import type { Pose } from '@/cv/pose/landmarks'

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
  /** Return true when the rule is violated. */
  check: (f: Features, rep: RepStats | null) => boolean
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
}

export type AnalyzerEvent =
  | { type: 'phase'; phase: Phase }
  | { type: 'rep'; count: number; score: number; violations: Violation[]; stats: RepStats }
  | { type: 'partial'; violations: Violation[] }
  | { type: 'hold_tick'; heldMs: number; inTolerance: boolean; violations: Violation[] }
  | { type: 'gated'; reason: 'visibility' }
  | { type: 'ungated' }
