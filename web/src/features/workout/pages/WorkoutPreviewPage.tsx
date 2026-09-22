import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Badge, Button, Card, PageTitle } from '@/components/ui'
import { targetLabel } from '@/lib/format'
import { useSessionStore } from '@/features/workout/store/sessionStore'
import type { Plan, PlanItem } from '@/types/api'

export interface PreviewLocationState {
  plan?: Plan
  items?: PlanItem[]
  only?: string
  title?: string
}

export function WorkoutPreviewPage() {
  const nav = useNavigate()
  const loc = useLocation()
  const state = (loc.state ?? {}) as PreviewLocationState
  const setup = useSessionStore((s) => s.setup)
  const [mode, setMode] = useState<'cv' | 'manual'>('cv')

  const items = state.items ?? state.plan?.items ?? []
  const planId = state.plan?.id ?? null

  useEffect(() => {
    if (!items.length) nav('/home', { replace: true })
  }, [items.length, nav])

  const cvCount = items.filter((i) => i.exercise.cv_supported).length
  const orientations = Array.from(new Set(items.filter((i) => i.exercise.cv_supported).map((i) => i.exercise.orientation)))

  const start = () => {
    setup({ planId, items, mode, only: state.only })
    nav('/workout/live', { replace: true })
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col px-4 pb-6 pt-[calc(var(--safe-top)+16px)]">
      <PageTitle title={state.title ?? "Today's workout"} subtitle={`${items.length} exercise${items.length === 1 ? '' : 's'} · ${cvCount} camera-tracked`} />

      <Card className="mb-3 space-y-2">
        {items.map((it, i) => (
          <div key={it.id} className="flex items-center justify-between gap-3 border-b border-slate-800 py-2 last:border-0">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">{i + 1}</div>
              <div>
                <div className="font-medium">{it.exercise.name}</div>
                <div className="text-xs text-slate-400">
                  {targetLabel(it)}
                  {it.focus_cue ? ` · ${it.focus_cue}` : ''}
                </div>
              </div>
            </div>
            {it.exercise.cv_supported ? <Badge tone="brand">Camera</Badge> : <Badge>Timer</Badge>}
          </div>
        ))}
      </Card>

      <Card className="mb-3">
        <div className="mb-2 text-sm font-semibold">How do you want to be coached?</div>
        <div className="grid grid-cols-2 gap-2">
          <ModeCard
            active={mode === 'cv'}
            onClick={() => setMode('cv')}
            title="Camera coach"
            body="Counts reps, corrects form. Verified minutes."
          />
          <ModeCard active={mode === 'manual'} onClick={() => setMode('manual')} title="Manual" body="Tap to count. Not verified." />
        </div>
        {mode === 'cv' && (
          <ul className="mt-3 space-y-1 text-xs text-slate-400">
            <li>• Prop your phone ~2 m away, whole body in frame.</li>
            <li>• {orientations.includes('side') && orientations.includes('front') ? 'Some exercises need a side view, some a front view — the app will tell you.' : orientations.includes('side') ? 'Stand side-on to the camera.' : 'Face the camera.'}</li>
            <li>• Video never leaves your phone. Only reps and scores are saved.</li>
          </ul>
        )}
      </Card>

      <div className="mt-auto flex gap-2">
        <Button variant="secondary" onClick={() => nav(-1)}>
          Back
        </Button>
        <Button className="flex-1" size="lg" onClick={start}>
          Start workout
        </Button>
      </div>
    </div>
  )
}

function ModeCard({ active, onClick, title, body }: { active: boolean; onClick: () => void; title: string; body: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${active ? 'border-brand-400 bg-brand-500/10' : 'border-slate-700 bg-slate-900'}`}
    >
      <div className="font-semibold">{title}</div>
      <div className="mt-0.5 text-xs text-slate-400">{body}</div>
    </button>
  )
}
