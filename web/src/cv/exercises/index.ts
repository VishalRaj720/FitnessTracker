import type { ExerciseDefinition } from '@/cv/engine/types'
import { squat } from '@/cv/exercises/squat'
import { jumpingJack } from '@/cv/exercises/jumpingJack'
import { lunge } from '@/cv/exercises/lunge'
import { pushup } from '@/cv/exercises/pushup'
import { plank } from '@/cv/exercises/plank'

/** Registry keyed by backend exercise slug. Adding an exercise = add a file + one line here. */
export const EXERCISE_DEFINITIONS: Record<string, ExerciseDefinition> = {
  squat,
  jumping_jack: jumpingJack,
  lunge,
  pushup,
  plank,
}

export function getDefinition(slug: string): ExerciseDefinition | null {
  return EXERCISE_DEFINITIONS[slug] ?? null
}
