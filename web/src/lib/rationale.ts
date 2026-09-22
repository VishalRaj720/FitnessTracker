import type { RationaleEntry } from '@/types/api'

const EXERCISE_NAMES: Record<string, string> = {
  squat: 'squats',
  pushup: 'push-ups',
  lunge: 'lunges',
  jumping_jack: 'jumping jacks',
  plank: 'plank',
  glute_bridge: 'glute bridges',
  wall_sit: 'wall sit',
  mountain_climber: 'mountain climbers',
  high_knees: 'high knees',
  crunch: 'crunches',
  superman_hold: 'superman hold',
  incline_pushup: 'incline push-ups',
}

function name(slug: unknown): string {
  return EXERCISE_NAMES[String(slug)] ?? String(slug).replace(/_/g, ' ')
}

/** Renders the recommender's structured rationale into short, human sentences. */
export function renderRationale(entries: RationaleEntry[]): string[] {
  const out: string[] = []
  for (const r of entries) {
    switch (r.code) {
      case 'baseline':
        out.push('Your first plan: a balanced baseline for your level.')
        break
      case 'composition': {
        const cats = (r.categories as string[] | undefined) ?? []
        out.push(`Today's mix: ${cats.join(' · ')}.`)
        break
      }
      case 'progress_volume':
        out.push('Volume up 10% — your last two sessions were complete with good form.')
        break
      case 'progress_reps':
        out.push(`+${r.delta} ${name(r.exercise)} because your form has been consistent.`)
        break
      case 'progress_seconds':
        out.push(`+${r.delta}s on ${name(r.exercise)}.`)
        break
      case 'reduce_volume':
        out.push(
          r.reason === 'low_form'
            ? 'Volume trimmed 10% — form dipped last time. Quality over quantity.'
            : 'Volume trimmed 15% — last session was hard or cut short.',
        )
        break
      case 'welcome_back':
        out.push(`Welcome back after ${r.days_missed} days — easing you in at 85%.`)
        break
      case 'focus_cue':
        out.push(`Keeping ${name(r.exercise)} in rotation with a focus cue (last form ${r.last_form}).`)
        break
      case 'recovery_day':
        out.push('Three days in a row — today is a lighter core & mobility day.')
        break
      case 'hold_volume':
        out.push('Holding volume steady today.')
        break
      default:
        break
    }
  }
  return out
}
