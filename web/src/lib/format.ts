export function fmtMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`
}

export function fmtClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function weekShort(label: string): string {
  // "2026-W39" -> "W39"
  return label.split('-')[1] ?? label
}

export function targetLabel(item: { target_sets: number; target_reps: number; target_seconds: number }): string {
  if (item.target_reps > 0) return `${item.target_sets} × ${item.target_reps} reps`
  return `${item.target_sets} × ${item.target_seconds}s`
}

export const GOAL_LABEL: Record<string, string> = {
  general: 'General fitness',
  fat_loss: 'Fat loss',
  strength: 'Strength',
  consistency: 'Just stay consistent',
}

export const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

export const CATEGORY_LABEL: Record<string, string> = {
  legs: 'Legs',
  push: 'Push',
  core: 'Core',
  cardio: 'Cardio',
  mobility: 'Mobility',
}

export const ORIENTATION_LABEL: Record<string, string> = {
  side: 'Side view',
  front: 'Front view',
  any: 'Any angle',
}

/** 1234.5 -> "1,235" (Indian digit grouping, like the rest of the app). */
export function fmtInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return Math.round(n).toLocaleString('en-IN')
}

/** One decimal only when it carries information: 7 -> "7", 7.25 -> "7.3". */
export function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '—'
  const f = 10 ** digits
  const r = Math.round(n * f) / f
  return Number.isInteger(r) ? r.toLocaleString('en-IN') : r.toLocaleString('en-IN', { maximumFractionDigits: digits })
}

const FRACTIONS: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' }

/** Servings as people say them: 1.5 -> "1½", 0.5 -> "½", 2 -> "2". */
export function fmtServings(s: number): string {
  const whole = Math.floor(s)
  const frac = Math.round((s - whole) * 4) / 4
  const sym = FRACTIONS[frac]
  if (!sym) return fmtNum(s, 2)
  return whole === 0 ? sym : `${whole}${sym}`
}

/** "2026-09-26" moved by n days, without timezone drift. */
export function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return t.toISOString().slice(0, 10)
}

/** "2026-09-26" -> "Sat, 26 Sep" (the calendar day itself, never shifted by timezone). */
export function fmtIsoDay(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { ...opts, timeZone: 'UTC' })
}

export const DIET_LABEL: Record<string, string> = {
  vegan: 'Vegan',
  veg: 'Vegetarian',
  egg: 'Eggetarian',
  non_veg: 'Non-vegetarian',
}

export const ACTIVITY_LABEL: Record<string, { label: string; hint: string }> = {
  sedentary: { label: 'Sedentary', hint: 'Mostly sitting — lectures, desk, little walking' },
  light: { label: 'Lightly active', hint: 'Walk around campus, light exercise 1–3 days a week' },
  moderate: { label: 'Moderately active', hint: 'On your feet a lot, exercise 3–5 days a week' },
  active: { label: 'Very active', hint: 'Hard training or sport 6–7 days a week' },
  very_active: { label: 'Athlete', hint: 'Twice-a-day training or a physical job' },
}

export const MEAL_LABEL: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snacks',
  dinner: 'Dinner',
}
