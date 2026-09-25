import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { Alert, Badge, Button, EmptyState, Icon, KeyValue, PageHeader, Sheet, Skeleton, Toggle } from '@/components/ui'
import { errorMessage } from '@/lib/apiClient'
import { useExercises } from '@/features/exercises/api'
import { CATEGORY_LABEL, ORIENTATION_LABEL } from '@/lib/format'
import { getCompletedTutorials } from '@/features/tutorial/completion'
import { DemoFigure } from '@/features/tutorial/DemoFigure'
import { getClip } from '@/cv/demo/clips'
import { getDefinition } from '@/cv/exercises'
import type { Exercise, PlanItem } from '@/types/api'

const CATEGORY_TONE: Record<string, string> = {
  legs: 'bg-pulse',
  push: 'bg-flame',
  core: 'bg-volt',
  cardio: 'bg-rose-400',
  mobility: 'bg-iris-500',
}

export function ExercisesPage() {
  const nav = useNavigate()
  const q = useExercises()
  const [cat, setCat] = useState<string | null>(null)
  const [cameraOnly, setCameraOnly] = useState(false)
  const [open, setOpen] = useState<Exercise | null>(null)
  const [learned, setLearned] = useState<string[]>([])

  useEffect(() => {
    void getCompletedTutorials().then(setLearned)
  }, [])

  const all = q.data ?? []
  const list = all.filter((e) => (!cat || e.category === cat) && (!cameraOnly || e.cv_supported))
  const cats = Array.from(new Set(all.map((e) => e.category)))
  const cvCount = all.filter((e) => e.cv_supported).length

  const startSingle = (ex: Exercise) => {
    const item: PlanItem = {
      id: `adhoc-${ex.slug}-${Date.now()}`,
      position: 1,
      exercise: ex,
      target_sets: 1,
      target_reps: ex.default_reps,
      target_seconds: ex.default_seconds,
      rest_seconds: 30,
      focus_cue: null,
    }
    nav('/workout/preview', { state: { items: [item], title: ex.name } })
  }

  return (
    <div className="space-y-8">
      <PageHeader
        size="lg"
        badge={`Movement library // ${all.length || '—'} exercises`}
        title="Exercises"
        subtitle="Start a single exercise any time. Camera-tracked moves are counted and form-scored on your phone, and their minutes count as verified."
        right={
          <div className="flex gap-2 font-mono text-xs">
            <span className="rounded-lg border border-volt/30 bg-volt/10 px-3 py-2 text-volt">{cvCount} camera</span>
            <span className="rounded-lg border border-line bg-ink-900 px-3 py-2 text-slate-300">{all.length - cvCount} timer</span>
          </div>
        }
      />

      <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Category" className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
          {[null, ...cats].map((c) => (
            <button
              key={c ?? 'all'}
              type="button"
              role="tab"
              aria-selected={cat === c}
              onClick={() => setCat(c)}
              className={clsx(
                'flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition',
                cat === c ? 'border-pulse/40 bg-pulse/10 text-pulse' : 'border-transparent text-slate-400 hover:border-line hover:text-white',
              )}
            >
              {c && <span className={clsx('h-1.5 w-1.5 rounded-full', CATEGORY_TONE[c] ?? 'bg-slate-500')} />}
              {c ? (CATEGORY_LABEL[c] ?? c) : 'All'}
            </button>
          ))}
        </div>
        <label className="flex shrink-0 items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-slate-400">
          Camera-tracked only
          <Toggle checked={cameraOnly} onChange={setCameraOnly} label="Show camera-tracked exercises only" />
        </label>
      </div>

      {q.isPending && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      )}
      {q.isError && <Alert title="Couldn't load exercises">{errorMessage(q.error)}</Alert>}
      {q.data && list.length === 0 && <EmptyState icon="dumbbell" title="Nothing matches" body="Try another category or switch off the camera filter." />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((ex, i) => {
          const hasTutorial = !!getDefinition(ex.slug)?.tutorial
          const done = learned.includes(ex.slug)
          return (
            <button
              key={ex.id}
              type="button"
              onClick={() => setOpen(ex)}
              className="group flex flex-col rounded-xl border border-line bg-ink-900/85 p-5 text-left shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-line-strong"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-[10px] text-slate-500">EX-{String(i + 1).padStart(2, '0')}</span>
                {ex.cv_supported ? (
                  <Badge tone="volt" mono icon="scan">
                    Camera
                  </Badge>
                ) : (
                  <Badge mono icon="clock">
                    Timer
                  </Badge>
                )}
              </div>
              <h3 className="text-lg font-bold tracking-tight text-white transition-colors group-hover:text-pulse">{ex.name}</h3>
              <p className="mt-1 line-clamp-1 font-mono text-[11px] capitalize text-slate-400">{ex.muscle_groups.join(' · ')}</p>
              <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                <div>
                  <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">Difficulty</div>
                  <div className="flex gap-1" aria-label={`Difficulty ${ex.difficulty} of 3`}>
                    {[1, 2, 3].map((d) => (
                      <span key={d} className={clsx('h-1.5 w-5 rounded-full', d <= ex.difficulty ? 'bg-pulse' : 'bg-ink-700')} />
                    ))}
                  </div>
                </div>
                <div className="text-right font-mono text-[10px] uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-1.5 text-slate-400">
                    <span className={clsx('h-1.5 w-1.5 rounded-full', CATEGORY_TONE[ex.category] ?? 'bg-slate-500')} />
                    {CATEGORY_LABEL[ex.category] ?? ex.category}
                  </div>
                  {hasTutorial && <div className={clsx('mt-1', done ? 'text-brand-400' : 'text-pulse')}>{done ? 'Tutorial done ✓' : 'Tutorial ready'}</div>}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <ExerciseSheet exercise={open} learned={open ? learned.includes(open.slug) : false} onClose={() => setOpen(null)} onStart={startSingle} onTutorial={(slug) => nav(`/exercises/${slug}/tutorial`)} />
    </div>
  )
}

function ExerciseSheet({
  exercise,
  learned,
  onClose,
  onStart,
  onTutorial,
}: {
  exercise: Exercise | null
  learned: boolean
  onClose: () => void
  onStart: (ex: Exercise) => void
  onTutorial: (slug: string) => void
}) {
  const ex = exercise
  const clip = ex ? getClip(ex.slug) : null
  const hasTutorial = ex ? !!getDefinition(ex.slug)?.tutorial : false
  return (
    <Sheet
      open={!!ex}
      onClose={onClose}
      kicker={ex ? `${CATEGORY_LABEL[ex.category] ?? ex.category} // ${ex.mode === 'reps' ? 'rep-counted' : 'timed hold'}` : ''}
      title={ex?.name ?? ''}
      footer={
        ex && (
          <div className="space-y-2">
            {hasTutorial && (
              <Button variant="secondary" block icon="sparkles" onClick={() => onTutorial(ex.slug)}>
                {learned ? 'Review the tutorial' : 'Learn this first'}
              </Button>
            )}
            <Button variant="primary" block icon="play" onClick={() => onStart(ex)}>
              Start 1 set · {ex.mode === 'reps' ? `${ex.default_reps} reps` : `${ex.default_seconds}s`}
            </Button>
          </div>
        )
      }
    >
      {ex && (
        <div className="space-y-5">
          {clip ? (
            <div className="relative h-64 overflow-hidden rounded-xl border border-line bg-ink-950">
              <div className="absolute inset-0 bg-dot-signal opacity-40" />
              <div className="absolute inset-0">
                <DemoFigure clip={clip} wire />
              </div>
              <span className="pointer-events-none absolute left-2 top-2 font-mono text-[9px] text-slate-600">┏ [DEMO]</span>
              <span className="pointer-events-none absolute right-2 top-2 font-mono text-[9px] text-pulse">{(ORIENTATION_LABEL[clip.view] ?? clip.view).toUpperCase()} ┓</span>
              <span className="pointer-events-none absolute bottom-2 left-2 font-mono text-[9px] text-slate-500">┗ drag to rotate</span>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-line text-xs text-slate-500">
              <Icon name="clock" className="mr-2" /> Timer-based — no camera demo for this one
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {ex.cv_supported ? (
              <Badge tone="volt" mono icon="scan">
                Camera · {ORIENTATION_LABEL[ex.orientation] ?? ex.orientation}
              </Badge>
            ) : (
              <Badge mono icon="clock">
                Timer
              </Badge>
            )}
            {ex.muscle_groups.map((m) => (
              <Badge key={m} className="capitalize">
                {m}
              </Badge>
            ))}
          </div>
          <p className="text-sm leading-relaxed text-slate-300">{ex.instructions}</p>
          <div className="rounded-xl border border-line bg-ink-850/70 px-4 py-2">
            <KeyValue k="Default target" v={ex.mode === 'reps' ? `${ex.default_reps} reps` : `${ex.default_seconds} s hold`} />
            <KeyValue k="Difficulty" v={`${ex.difficulty} / 3`} />
            <KeyValue k="Counts as verified" v={ex.cv_supported ? 'Yes — camera mode' : 'No — timer only'} tone={ex.cv_supported ? 'brand' : undefined} />
          </div>
        </div>
      )}
    </Sheet>
  )
}
