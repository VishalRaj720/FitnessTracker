import { create } from 'zustand'
import type { Exercise, PlanItem, SessionExerciseIn, SessionIn, SessionMode } from '@/types/api'

/** One thing to do in a session: an exercise with a target, derived from a plan item. */
export interface RunnerItem {
  key: string
  planItemId: string | null
  exercise: Exercise
  targetSets: number
  targetReps: number
  targetSeconds: number
  restSeconds: number
  focusCue: string | null
  /** Camera-trackable and camera mode selected. */
  useCamera: boolean
}

export interface ExerciseResult {
  key: string
  exerciseId: number
  planItemId: string | null
  position: number
  mode: 'cv' | 'manual'
  setsCompleted: number
  repsCompleted: number
  secondsHeld: number
  targetReps: number
  targetSeconds: number
  durationSeconds: number
  formScore: number | null
  meanVisibility: number | null
  formFlags: Record<string, number>
  repEvents: number[][]
}

export type SessionStatus = 'idle' | 'ready' | 'active' | 'rest' | 'finished'

export interface LiveState {
  reps: number
  partials: number
  heldMs: number
  phase: string
  inTolerance: boolean
  formScore: number
  cue: { text: string; tone: 'correction' | 'praise' | 'count' | 'info' | 'coach'; at: number } | null
  /** The coach's latest observation, surfaced between sets rather than shouted mid-rep. */
  coachNote: string | null
  visibility: number
  gated: boolean
  /** Consecutive reps with no rule violations. Drives the tutorial's checkpoint. */
  cleanStreak: number
  /** Inference rate (poses per second). Decoupled from, and usually well below, renderFps. */
  fps: number
  inferenceMs: number
  /** Overlay redraw rate. Should sit at the display refresh even when fps is low. */
  renderFps: number
  tier: 'high' | 'medium' | 'low'
}

interface SessionState {
  status: SessionStatus
  mode: 'cv' | 'manual'
  planId: string | null
  items: RunnerItem[]
  currentIndex: number
  currentSet: number
  startedAt: number | null
  itemStartedAt: number | null
  results: ExerciseResult[]
  live: LiveState
  restEndsAt: number | null
  clientSessionId: string | null
  lastSubmission: { payload: SessionIn; serverId: string | null; queued: boolean } | null

  // actions
  setup: (opts: { planId: string | null; items: PlanItem[]; mode: 'cv' | 'manual'; only?: string }) => void
  start: () => void
  markItemStarted: () => void
  updateLive: (patch: Partial<LiveState>) => void
  setCue: (cue: LiveState['cue']) => void
  setCoachNote: (note: string | null) => void
  completeSet: (partial: Partial<ExerciseResult> & { repsCompleted?: number; secondsHeld?: number; formScore?: number | null; meanVisibility?: number | null; formFlags?: Record<string, number>; repEvents?: number[][] }) => void
  skipItem: () => void
  endRest: () => void
  finish: () => SessionIn | null
  setLastSubmission: (s: SessionState['lastSubmission']) => void
  reset: () => void
}

const initialLive: LiveState = {
  reps: 0,
  partials: 0,
  heldMs: 0,
  phase: 'TOP',
  inTolerance: false,
  formScore: 100,
  cue: null,
  coachNote: null,
  visibility: 0,
  gated: false,
  cleanStreak: 0,
  fps: 0,
  inferenceMs: 0,
  renderFps: 0,
  tier: 'medium',
}

function toRunnerItems(items: PlanItem[], mode: 'cv' | 'manual', only?: string): RunnerItem[] {
  return items
    .filter((i) => !only || i.id === only)
    .map((i) => ({
      key: i.id,
      planItemId: i.id,
      exercise: i.exercise,
      targetSets: i.target_sets,
      targetReps: i.target_reps,
      targetSeconds: i.target_seconds,
      restSeconds: i.rest_seconds,
      focusCue: i.focus_cue,
      useCamera: mode === 'cv' && i.exercise.cv_supported,
    }))
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  status: 'idle',
  mode: 'cv',
  planId: null,
  items: [],
  currentIndex: 0,
  currentSet: 1,
  startedAt: null,
  itemStartedAt: null,
  results: [],
  live: initialLive,
  restEndsAt: null,
  clientSessionId: null,
  lastSubmission: null,

  setup: ({ planId, items, mode, only }) =>
    set({
      status: 'ready',
      mode,
      planId,
      items: toRunnerItems(items, mode, only),
      currentIndex: 0,
      currentSet: 1,
      startedAt: null,
      itemStartedAt: null,
      results: [],
      live: initialLive,
      restEndsAt: null,
      clientSessionId: crypto.randomUUID(),
      lastSubmission: null,
    }),

  start: () => set({ status: 'active', startedAt: Date.now(), itemStartedAt: Date.now(), live: initialLive }),

  markItemStarted: () => set({ itemStartedAt: Date.now(), live: initialLive }),

  updateLive: (patch) => set((s) => ({ live: { ...s.live, ...patch } })),

  setCue: (cue) => set((s) => ({ live: { ...s.live, cue } })),

  setCoachNote: (coachNote) => set((s) => ({ live: { ...s.live, coachNote } })),

  completeSet: (partial) => {
    const s = get()
    const item = s.items[s.currentIndex]
    if (!item) return
    const now = Date.now()
    const duration = Math.max(1, Math.round((now - (s.itemStartedAt ?? now)) / 1000))
    const existing = s.results.find((r) => r.key === item.key)
    const reps = partial.repsCompleted ?? 0
    const held = partial.secondsHeld ?? 0
    const merged: ExerciseResult = existing
      ? {
          ...existing,
          setsCompleted: existing.setsCompleted + 1,
          repsCompleted: existing.repsCompleted + reps,
          secondsHeld: existing.secondsHeld + held,
          durationSeconds: existing.durationSeconds + duration,
          formScore:
            partial.formScore == null
              ? existing.formScore
              : existing.formScore == null
                ? partial.formScore
                : Math.round(((existing.formScore + partial.formScore) / 2) * 10) / 10,
          meanVisibility:
            partial.meanVisibility == null
              ? existing.meanVisibility
              : existing.meanVisibility == null
                ? partial.meanVisibility
                : (existing.meanVisibility + partial.meanVisibility) / 2,
          formFlags: mergeFlags(existing.formFlags, partial.formFlags ?? {}),
          repEvents: [...existing.repEvents, ...(partial.repEvents ?? [])].slice(0, 500),
        }
      : {
          key: item.key,
          exerciseId: item.exercise.id,
          planItemId: item.planItemId,
          position: s.currentIndex + 1,
          mode: item.useCamera ? 'cv' : 'manual',
          setsCompleted: 1,
          repsCompleted: reps,
          secondsHeld: held,
          targetReps: item.targetReps * item.targetSets,
          targetSeconds: item.targetSeconds * item.targetSets,
          durationSeconds: duration,
          formScore: partial.formScore ?? null,
          meanVisibility: partial.meanVisibility ?? null,
          formFlags: partial.formFlags ?? {},
          repEvents: (partial.repEvents ?? []).slice(0, 500),
        }
    const results = existing ? s.results.map((r) => (r.key === item.key ? merged : r)) : [...s.results, merged]

    const moreSets = s.currentSet < item.targetSets
    const nextIndex = moreSets ? s.currentIndex : s.currentIndex + 1
    const nextSet = moreSets ? s.currentSet + 1 : 1
    const done = !moreSets && nextIndex >= s.items.length
    set({
      results,
      currentIndex: nextIndex,
      currentSet: nextSet,
      status: done ? 'finished' : 'rest',
      restEndsAt: done ? null : now + item.restSeconds * 1000,
      live: initialLive,
    })
  },

  skipItem: () => {
    const s = get()
    const nextIndex = s.currentIndex + 1
    const done = nextIndex >= s.items.length
    set({ currentIndex: nextIndex, currentSet: 1, status: done ? 'finished' : 'active', itemStartedAt: Date.now(), live: initialLive, restEndsAt: null })
  },

  endRest: () => set({ status: 'active', restEndsAt: null, itemStartedAt: Date.now(), live: initialLive }),

  finish: () => {
    const s = get()
    if (!s.startedAt || !s.clientSessionId || s.results.length === 0) return null
    const modes = new Set(s.results.map((r) => r.mode))
    const mode: SessionMode = modes.size === 1 ? (modes.has('cv') ? 'cv' : 'manual') : 'mixed'
    const exercises: SessionExerciseIn[] = s.results.map((r) => ({
      exercise_id: r.exerciseId,
      plan_item_id: r.planItemId,
      position: r.position,
      mode: r.mode,
      sets_completed: r.setsCompleted,
      reps_completed: r.repsCompleted,
      seconds_held: r.secondsHeld,
      target_reps: r.targetReps,
      target_seconds: r.targetSeconds,
      duration_seconds: r.durationSeconds,
      form_score: r.formScore,
      mean_visibility: r.meanVisibility,
      form_flags: r.formFlags,
      rep_events: r.repEvents,
    }))
    const endedAt = Math.max(Date.now(), s.startedAt + 1000)
    return {
      client_session_id: s.clientSessionId,
      plan_id: s.planId,
      mode,
      started_at: new Date(s.startedAt).toISOString(),
      ended_at: new Date(endedAt).toISOString(),
      device_info: { ua: navigator.userAgent.slice(0, 120), fps: s.live.fps },
      exercises,
    }
  },

  setLastSubmission: (lastSubmission) => set({ lastSubmission }),

  reset: () => set({ status: 'idle', items: [], results: [], currentIndex: 0, currentSet: 1, startedAt: null, itemStartedAt: null, live: initialLive, restEndsAt: null, planId: null, clientSessionId: null }),
}))

function mergeFlags(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v
  return out
}
