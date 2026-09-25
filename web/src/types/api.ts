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

// ---------------------------------------------------------------------------------------------
// Diet & nutrition — mirrors backend/app/schemas/nutrition.py field for field.

export type Sex = 'male' | 'female' | 'other'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type DietType = 'vegan' | 'veg' | 'egg' | 'non_veg'
export type Meal = 'breakfast' | 'lunch' | 'snack' | 'dinner'

export interface NutritionProfileIn {
  sex: Sex
  age: number
  height_cm: number
  weight_kg: number
  activity_level: ActivityLevel
  diet_type: DietType
}

export interface NutritionProfile extends NutritionProfileIn {
  bmi: number
  updated_at: string
}

export interface FoodNutrients {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  iron_mg: number
  calcium_mg: number
  vitamin_c_mg: number
}

export interface DailyNutrients extends FoodNutrients {
  water_ml: number
}

export interface NutritionTargets extends DailyNutrients {
  bmr: number
  tdee: number
  adjustment_pct: number
  protein_pct: number
  carbs_pct: number
  fat_pct: number
  meal_calories: Record<Meal, number>
}

export interface NutritionCategory {
  goal: Goal
  goal_label: string
  level: Level
  level_label: string
  diet_type: DietType
  diet_label: string
  activity_level: ActivityLevel
  label: string
}

export interface Food {
  id: number
  slug: string
  name: string
  category: string
  diet: DietType
  serving: string
  nutrients: FoodNutrients
  tags: string[]
}

export interface FoodPick {
  food: Food
  reason: string
}

export interface FoodGroup {
  key: 'protein' | 'carbs' | 'fats' | 'produce'
  title: string
  items: FoodPick[]
}

export interface LimitItem {
  food: Food
  reason: string
}

export interface MealItem {
  food: Food
  servings: number
}

export interface MealSuggestion {
  key: string
  meal: Meal
  title: string
  items: MealItem[]
  nutrients: FoodNutrients
  budget_calories: number
}

export interface NutritionGuidance {
  code: string
  title: string
  body: string
  tone: 'info' | 'tip' | 'warn'
}

export interface NutritionPlan {
  category: NutritionCategory
  profile: NutritionProfile
  targets: NutritionTargets
  strategy: { title: string; summary: string; principles: string[] }
  food_groups: FoodGroup[]
  limit: LimitItem[]
  meals: MealSuggestion[]
  guidance: NutritionGuidance[]
}

export interface CustomFoodIn {
  name: string
  calories: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
}

export interface FoodLogIn {
  meal: Meal
  food_id?: number | null
  custom?: CustomFoodIn | null
  servings?: number
  date?: string | null
}

export interface FoodLogEntry {
  id: string
  date: string
  meal: Meal
  food_id: number | null
  name: string
  serving: string | null
  servings: number
  nutrients: FoodNutrients
  created_at: string
}

export interface DailyNutrition {
  date: string
  has_profile: boolean
  targets: NutritionTargets | null
  consumed: DailyNutrients
  remaining: DailyNutrients | null
  entries: FoodLogEntry[]
}

export interface NutritionHistoryDay extends DailyNutrients {
  date: string
  entries: number
}

export interface NutritionHistory {
  days: NutritionHistoryDay[]
  targets: NutritionTargets | null
}

export interface WaterOut {
  date: string
  water_ml: number
}
