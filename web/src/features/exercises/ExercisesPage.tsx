import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Badge, Button, Card, Chip, PageTitle, Spinner } from '@/components/ui'
import { api, errorMessage } from '@/lib/apiClient'
import { CATEGORY_LABEL } from '@/lib/format'
import type { Exercise, PlanItem } from '@/types/api'

export function useExercises() {
  return useQuery({ queryKey: ['exercises'], queryFn: () => api<Exercise[]>('/exercises'), staleTime: 10 * 60_000 })
}

export function ExercisesPage() {
  const nav = useNavigate()
  const q = useExercises()
  const [cat, setCat] = useState<string | null>(null)
  const [open, setOpen] = useState<Exercise | null>(null)

  const list = (q.data ?? []).filter((e) => !cat || e.category === cat)
  const cats = Array.from(new Set((q.data ?? []).map((e) => e.category)))

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
    <div className="space-y-4">
      <PageTitle title="Exercises" subtitle="Start a single exercise any time. Camera-tracked ones count as verified." />
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        <Chip active={cat === null} onClick={() => setCat(null)}>
          All
        </Chip>
        {cats.map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
            {CATEGORY_LABEL[c] ?? c}
          </Chip>
        ))}
      </div>
      {q.isPending && <Spinner />}
      {q.isError && <Alert>{errorMessage(q.error)}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        {list.map((ex) => (
          <button key={ex.id} type="button" onClick={() => setOpen(ex)} className="text-left">
            <Card className="h-full p-3.5 transition hover:border-slate-600">
              <div className="mb-2 flex items-center justify-between">
                {ex.cv_supported ? <Badge tone="brand">Camera</Badge> : <Badge>Timer</Badge>}
                <span className="text-xs text-slate-500">{'●'.repeat(ex.difficulty)}</span>
              </div>
              <div className="font-semibold">{ex.name}</div>
              <div className="text-xs text-slate-400">{ex.muscle_groups.join(', ')}</div>
            </Card>
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60" onClick={() => setOpen(null)}>
          <div className="w-full max-w-md rounded-t-3xl border-t border-slate-800 bg-slate-900 p-5 pb-[calc(var(--safe-bottom)+20px)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-xl font-bold">{open.name}</h2>
              {open.cv_supported ? <Badge tone="brand">Camera · {open.orientation} view</Badge> : <Badge>Timer</Badge>}
            </div>
            <div className="mb-3 text-xs text-slate-400">
              {CATEGORY_LABEL[open.category]} · {open.muscle_groups.join(', ')}
            </div>
            <p className="mb-4 text-sm text-slate-300">{open.instructions}</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setOpen(null)}>
                Close
              </Button>
              <Button className="flex-1" onClick={() => startSingle(open)}>
                Start 1 set · {open.mode === 'reps' ? `${open.default_reps} reps` : `${open.default_seconds}s`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
