/** Wire DTOs — mirror backend/app/schemas. Keep in sync by hand (or regenerate from /openapi.json). */

export type Goal = 'general' | 'fat_loss' | 'strength' | 'consistency'
export type Level = 'beginner' | 'intermediate' | 'advanced'
export type SessionMode = 'cv' | 'manual' | 'mixed'
export type ExerciseMode = 'cv' | 'manual'
export type Orientation = 'side' | 'front' | 'any'

export interface ApiError {
  error: { code: string; message: string; details?: unknown }
}

export interface InstituteBrief {
  id: number
  name: string
  slug: string
  city: string | null
  state: string | null
}

export interface Exercise {
  id: number
  slug: string
  name: string
  category: 'legs' | 'push' | 'core' | 'cardio' | 'mobility'
  difficulty: number
  mode: 'reps' | 'hold'
  cv_supported: boolean
  orientation: Orientation
  default_reps: number
  default_seconds: number
  instructions: string
  muscle_groups: string[]
  cv_config_version: number
}

export interface Profile {
  goal: Goal
  level: Level
  minutes_per_session: number
  days_per_week: number
  preferences: Record<string, unknown>
  onboarding_completed_at: string | null
}

export interface Stats {
  current_streak: number
  longest_streak: number
  last_workout_date: string | null
  total_sessions: number
  total_verified_minutes: number
}

export interface User {
  id: string
  email: string
  name: string
  role: string
  institute: InstituteBrief | null
  department: string | null
  hostel: string | null
  profile: Profile | null
  stats: Stats
  onboarding_completed: boolean
}

export interface TokenOut {
  access_token: string
  token_type: string
  user: User
}

export interface ProfileIn {
  goal: Goal
  level: Level
  minutes_per_session: number
  days_per_week: number
  institute_id: number | null
  department: string | null
  hostel: string | null
  preferences: Record<string, unknown>
}

export interface PlanItem {
  id: string
  position: number
  exercise: Exercise
  target_sets: number
  target_reps: number
  target_seconds: number
  rest_seconds: number
  focus_cue: string | null
}

export interface RationaleEntry {
  code: string
  [key: string]: unknown
}

export interface Plan {
  id: string
  plan_date: string
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  generated_by: string
  estimated_minutes: number
  items: PlanItem[]
  rationale: RationaleEntry[]
}

export interface SessionExerciseIn {
  exercise_id: number
  plan_item_id: string | null
  position: number
  mode: ExerciseMode
  sets_completed: number
  reps_completed: number
  seconds_held: number
  target_reps: number
  target_seconds: number
  duration_seconds: number
  form_score: number | null
  mean_visibility: number | null
  form_flags: Record<string, number>
  rep_events: number[][]
}

export interface SessionIn {
  client_session_id: string
  plan_id: string | null
  mode: SessionMode
  started_at: string
  ended_at: string
  device_info: Record<string, unknown>
  exercises: SessionExerciseIn[]
}

export interface SessionExerciseOut {
  id: string
  exercise: Exercise
  position: number
  mode: ExerciseMode
  sets_completed: number
  reps_completed: number
  seconds_held: number
  target_reps: number
  target_seconds: number
  duration_seconds: number
  form_score: number | null
  verified: boolean
  form_flags: Record<string, number>
}

export interface SessionOut {
  id: string
  plan_id: string | null
  started_at: string
  ended_at: string
  duration_seconds: number
  mode: SessionMode
  total_reps: number
  avg_form_score: number | null
  verified_seconds: number
  verified: boolean
  rpe: number | null
  exercises: SessionExerciseOut[]
}

export interface SessionCreateOut extends SessionOut {
  streak: { current: number; longest: number; changed: boolean }
  plan_status: string | null
  duplicate: boolean
}

export interface SessionList {
  items: SessionOut[]
  next_cursor: string | null
}

export interface ProgressSummary {
  streak: { current: number; longest: number; last_workout_date: string | null }
  this_week: { sessions: number; verified_minutes: number; days_done: number; target_days: number }
  weekly: { week: string; verified_minutes: number; sessions: number }[]
  form_trend: { exercise_slug: string; exercise_name: string; points: { date: string; form_score: number }[] }[]
  totals: { sessions: number; verified_minutes: number }
}

export interface Squad {
  id: string
  name: string
  invite_code: string
  member_count: number
  institute: InstituteBrief | null
}

export interface LeaderboardRow {
  rank: number
  user_id: string
  name: string
  verified_minutes: number
  sessions: number
  avg_form: number | null
  is_me: boolean
}

export interface Leaderboard {
  squad: Squad
  week: string
  rows: LeaderboardRow[]
}

export interface InstituteStats {
  institute: InstituteBrief
  week: string
  this_week: {
    active_students: number
    verified_sessions: number
    verified_minutes: number
    avg_form_score: number | null
  }
  trend: { week: string; active_students: number; verified_minutes: number }[]
  by_department: { department: string; active_students: number; verified_minutes: number }[]
  top_squads: { name: string; members: number; verified_minutes: number }[]
  total_students: number
  k_anonymity_threshold: number
}
