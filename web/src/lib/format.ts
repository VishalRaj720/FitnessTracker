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
