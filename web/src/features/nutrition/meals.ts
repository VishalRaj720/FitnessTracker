import type { Food, Meal } from '@/types/api'

export const MEALS: Meal[] = ['breakfast', 'lunch', 'snack', 'dinner']

/** The meal most people are eating at this hour. */
export function mealForNow(d: Date = new Date()): Meal {
  const m = d.getHours() * 60 + d.getMinutes()
  if (m < 10 * 60 + 30) return 'breakfast'
  if (m < 15 * 60) return 'lunch'
  if (m < 18 * 60 + 30) return 'snack'
  return 'dinner'
}

/** What the food picker was opened for. `id` changes on every open so the sheet remounts fresh. */
export interface PickerRequest {
  id: number
  meal: Meal
  food?: Food
}
