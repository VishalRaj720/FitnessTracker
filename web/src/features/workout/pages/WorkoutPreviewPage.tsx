import { useEffect, useId, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { Logo } from '@/components/brand/Logo'
import { Button, Icon, type IconName } from '@/components/ui'
import { targetLabel } from '@/lib/format'
import { useSessionStore } from '@/features/workout/store/sessionStore'
import { getCompletedTutorials } from '@/features/tutorial/completion'
import { useCompanionStatus } from '@/features/companion/api'
import { getDefinition } from '@/cv/exercises'
import type { Plan, PlanItem } from '@/types/api'

export interface PreviewLocationState {
  plan?: Plan
  items?: PlanItem[]
  only?: string
  title?: string
}

// Same per-rep and transition timings the server's recommender uses for its estimate.
const SECONDS_PER_REP = 3.5
const TRANSITION_SECONDS = 25

function estimateMinutes(items: PlanItem[]): number {
  let s = 0
  for (const it of items) {
    const work = it.target_reps > 0 ? it.target_reps * SECONDS_PER_REP : it.target_seconds
    s += it.target_sets * work + Math.max(0, it.target_sets - 1) * it.rest_seconds + TRANSITION_SECONDS
  }
  return Math.max(1, Math.round(s / 60))
}

export function WorkoutPreviewPage() {
  const nav = useNavigate()
  const loc = useLocation()
  const state = (loc.state ?? {}) as PreviewLocationState
  const setup = useSessionStore((s) => s.setup)
  const companion = useCompanionStatus()
  const [mode, setMode] = useState<'cv' | 'manual'>('cv')
  const [learned, setLearned] = useState<string[] | null>(null)

  const items = state.items ?? state.plan?.items ?? []
  const planId = state.plan?.id ?? null

  useEffect(() => {
    if (!items.length) nav('/home', { replace: true })
  }, [items.length, nav])

  useEffect(() => {
    void getCompletedTutorials().then(setLearned)
  }, [])

  // Offer the tutorial for anything in today's workout the user has not been shown yet.
  const unlearned = learned === null ? [] : items.filter((i) => getDefinition(i.exercise.slug)?.tutorial && !learned.includes(i.exercise.slug))

  const cvCount = items.filter((i) => i.exercise.cv_supported).length
  const orientations = Array.from(new Set(items.filter((i) => i.exercise.cv_supported).map((i) => i.exercise.orientation)))
  const minutes = state.plan?.estimated_minutes ?? estimateMinutes(items)
  const viewGuide =
    orientations.includes('side') && orientations.includes('front')
      ? 'Some exercises need a side view, some a front view — the app tells you before each set.'
      : orientations.includes('side')
        ? 'Stand side-on to the camera for every exercise in this session.'
        : 'Face the camera for every exercise in this session.'

  const start = () => {
    setup({ planId, items, mode, only: state.only })
    nav('/workout/live', { replace: true })
  }

  return (
    <div className="flex min-h-full flex-col bg-ink-900">
      <header className="sticky top-0 z-50 w-full border-b border-line bg-ink-900/80 backdrop-blur-md" style={{ paddingTop: 'var(--safe-top)' }}>
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Logo tag="beta" />
          <button
            type="button"
            aria-label="Close workout preview"
            onClick={() => nav(-1)}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-ink-750 hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-500"
          >
            <Icon name="x" size={20} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <section className="mb-8">
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-brand-500/20 bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" /> Ready to train
          </span>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{state.title ?? "Today's workout"}</h1>
          <p className="flex items-center gap-2 text-sm font-medium text-slate-400">
            <span>
              {items.length} exercise{items.length === 1 ? '' : 's'}
            </span>
            <span className="inline-block h-1 w-1 rounded-full bg-slate-600" />
            <span className="text-slate-300">{cvCount} camera-tracked</span>
          </p>
        </section>

        {unlearned.length > 0 && mode === 'cv' && (
          <section className="mb-8 flex flex-col gap-4 rounded-xl border border-volt/25 bg-volt/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-volt/30 bg-volt/10 text-volt">
                <Icon name="sparkles" />
              </span>
              <div>
                <div className="text-sm font-semibold text-white">First time with {unlearned[0].exercise.name}?</div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400">A two-minute camera tutorial shows the movement and checks your form before it counts for anything.</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" iconRight="arrow-right" onClick={() => nav(`/exercises/${unlearned[0].exercise.slug}/tutorial`)} className="shrink-0">
              Learn {unlearned[0].exercise.name}
            </Button>
          </section>
        )}

        <section className="mb-10" aria-labelledby="sequence-title">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 id="sequence-title" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Exercise sequence
            </h2>
            <span className="text-xs text-slate-500">Est. {minutes} mins</span>
          </div>
          <ol className="space-y-2.5">
            {items.map((it, i) => (
              <li
                key={it.id}
                className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-800 p-4 transition-colors duration-150 hover:border-line-strong hover:bg-ink-750"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-ink-750 text-sm font-semibold text-slate-300 transition-colors group-hover:text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-white transition-colors group-hover:text-brand-400">{it.exercise.name}</h3>
                    <p className="mt-0.5 truncate text-xs font-medium text-slate-400">
                      {targetLabel(it)}
                      {it.focus_cue ? ` · ${it.focus_cue}` : ''}
                    </p>
                  </div>
                </div>
                {it.exercise.cv_supported ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-brand-500/25 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-400">
                    <Icon name="video" size={14} /> Camera
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line-strong bg-ink-700 px-3 py-1 text-xs font-medium text-slate-300">
                    <Icon name="clock" size={14} className="text-slate-400" /> Timer
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-8 rounded-2xl border border-line bg-ink-800 p-5 sm:p-6" aria-labelledby="coach-mode-title">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 id="coach-mode-title" className="text-base font-semibold text-white">
                How do you want to be coached?
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">Select your preferred guidance mode for this session.</p>
            </div>
            <span className="shrink-0 rounded border border-brand-500/20 bg-brand-500/10 px-2 py-0.5 font-mono text-xs text-brand-400">
              {companion.data?.enabled ? 'AI coach on' : 'CV on-device'}
            </span>
          </div>

          <div role="radiogroup" aria-labelledby="coach-mode-title" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <ModeCard active={mode === 'cv'} onClick={() => setMode('cv')} icon="video" title="Camera coach" body="Counts reps, corrects form. Verified minutes." />
            <ModeCard active={mode === 'manual'} onClick={() => setMode('manual')} icon="pointer" title="Manual" body="Tap to count. Not verified — won't reach the leaderboard." />
          </div>

          <div className="border-t border-line pt-4">
            <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Session guidelines</h3>
            <ul className="space-y-2 text-xs text-slate-400">
              {mode === 'cv' ? (
                <>
                  <Guideline>
                    Prop your phone <strong className="font-medium text-slate-300">~2 m away</strong>, with your whole body in frame.
                  </Guideline>
                  <Guideline>{viewGuide}</Guideline>
                  <Guideline>Video never leaves your phone. On-device processing keeps your data private; only reps and scores are saved.</Guideline>
                </>
              ) : (
                <>
                  <Guideline>Tap once per rep, or start and stop the timer for holds.</Guideline>
                  <Guideline>Manual sessions still count towards your streak, but not towards squad or campus leaderboards.</Guideline>
                </>
              )}
            </ul>
          </div>
        </section>
      </main>

      <footer className="sticky bottom-0 z-50 w-full border-t border-line bg-ink-900/95 py-4 backdrop-blur-md" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <Button variant="secondary" size="md" onClick={() => nav(-1)} className="w-28 sm:w-32">
            Back
          </Button>
          <Button variant="primary" size="md" iconRight="arrow-right" onClick={start} className="flex-1">
            Start workout
          </Button>
        </div>
      </footer>
    </div>
  )
}

function Guideline({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500/60" />
      <span>{children}</span>
    </li>
  )
}

function ModeCard({ active, onClick, icon, title, body }: { active: boolean; onClick: () => void; icon: IconName; title: string; body: string }) {
  const id = useId()
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-b`}
      onClick={onClick}
      className={clsx(
        'relative flex flex-col justify-between rounded-xl p-4 text-left transition-all duration-200',
        active ? 'border-2 border-brand-500/80 bg-brand-500/[0.06] shadow-[0_0_15px_rgba(16,185,129,0.07)]' : 'border border-line bg-ink-750 hover:border-line-strong',
      )}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <span className={clsx('flex h-8 w-8 items-center justify-center rounded-lg', active ? 'bg-brand-500/20 text-brand-400' : 'bg-ink-700 text-slate-400')}>
            <Icon name={icon} />
          </span>
          <h3 id={`${id}-t`} className={clsx('text-sm font-semibold', active ? 'text-white' : 'text-slate-200')}>
            {title}
          </h3>
        </div>
        <span className={clsx('h-2.5 w-2.5 rounded-full', active ? 'bg-brand-400 ring-4 ring-brand-400/20' : 'border border-slate-600')} />
      </div>
      <p id={`${id}-b`} className={clsx('text-xs leading-relaxed', active ? 'text-slate-300' : 'text-slate-400')}>
        {body}
      </p>
    </button>
  )
}
