import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, PageTitle, Stat } from '@/components/ui'
import { DebriefCard } from '@/features/companion/DebriefCard'
import { useSession, useSetRpe } from '@/features/workout/api'
import { useSessionStore } from '@/features/workout/store/sessionStore'
import { fmtMinutes } from '@/lib/format'
import type { SessionCreateOut, SessionOut } from '@/types/api'

const RPE = [
  { v: 1, label: 'Easy' },
  { v: 2, label: 'Light' },
  { v: 3, label: 'Moderate' },
  { v: 4, label: 'Hard' },
  { v: 5, label: 'Max' },
]

const FLAG_LABEL: Record<string, string> = {
  depth: 'Go lower',
  depth_shallow: 'A bit lower',
  torso_lean: 'Chest up',
  tempo: 'Slow down',
  knee_valgus: 'Knees out',
  arms_up: 'Arms up',
  feet_wide: 'Jump wider',
  hip_sag: 'Hips up',
  hip_pike: 'Hips down',
}

export function SessionSummaryPage() {
  const { sessionId } = useParams()
  const nav = useNavigate()
  const loc = useLocation()
  const state = (loc.state ?? {}) as { result?: SessionCreateOut | null; queued?: boolean }
  const last = useSessionStore((s) => s.lastSubmission)
  const reset = useSessionStore((s) => s.reset)
  const query = useSession(sessionId)
  const setRpe = useSetRpe(sessionId)
  const [rpe, setRpeLocal] = useState<number | null>(null)

  useEffect(() => () => reset(), [reset])

  const remote: SessionOut | undefined = state.result ?? query.data
  const queued = state.queued ?? last?.queued ?? false
  const streak = state.result?.streak

  // Offline: render from the local payload
  const localPayload = last?.payload
  const totalReps = remote?.total_reps ?? localPayload?.exercises.reduce((s, e) => s + e.reps_completed, 0) ?? 0
  const verifiedSeconds = remote?.verified_seconds ?? 0
  const durationSeconds = remote?.duration_seconds ?? (localPayload ? Math.round((new Date(localPayload.ended_at).getTime() - new Date(localPayload.started_at).getTime()) / 1000) : 0)
  const avgForm = remote?.avg_form_score ?? avgLocalForm(localPayload?.exercises ?? [])

  const rows =
    remote?.exercises.map((e) => ({
      key: e.id,
      name: e.exercise.name,
      reps: e.reps_completed,
      held: e.seconds_held,
      targetReps: e.target_reps,
      targetSeconds: e.target_seconds,
      form: e.form_score,
      verified: e.verified,
      flags: e.form_flags,
    })) ??
    localPayload?.exercises.map((e, i) => ({
      key: String(i),
      name: `Exercise ${e.position}`,
      reps: e.reps_completed,
      held: e.seconds_held,
      targetReps: e.target_reps,
      targetSeconds: e.target_seconds,
      form: e.form_score,
      verified: e.mode === 'cv',
      flags: e.form_flags,
    })) ??
    []

  return (
    <div className="mx-auto flex h-full max-w-md flex-col overflow-y-auto px-4 pb-6 pt-[calc(var(--safe-top)+16px)]">
      <PageTitle
        title="Workout done"
        subtitle={queued ? 'Saved on this phone — will sync when online' : remote?.verified ? 'Verified by camera' : 'Saved'}
        right={streak && <div className="text-right text-2xl font-black">🔥 {streak.current}</div>}
      />

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Stat label="Reps" value={totalReps} />
        <Stat label="Form" value={avgForm == null ? '—' : Math.round(avgForm)} hint={avgForm == null ? 'manual mode' : 'avg score'} />
        <Stat label="Verified" value={fmtMinutes(verifiedSeconds)} hint={queued ? 'pending sync' : 'counts on leaderboard'} />
        <Stat label="Duration" value={fmtMinutes(durationSeconds)} />
      </div>

      <DebriefCard sessionId={sessionId} />

      <Card className="mb-3 space-y-2">
        {rows.map((r) => {
          const topFlag = Object.entries(r.flags ?? {}).sort((a, b) => b[1] - a[1])[0]
          return (
            <div key={r.key} className="flex items-center justify-between border-b border-slate-800 py-2 last:border-0">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-slate-400">
                  {r.targetReps > 0 ? `${r.reps}/${r.targetReps} reps` : `${r.held}/${r.targetSeconds}s`}
                  {topFlag && topFlag[1] > 0 && ` · ${FLAG_LABEL[topFlag[0]] ?? topFlag[0]} ×${topFlag[1]}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.form != null && <div className="text-lg font-bold">{Math.round(r.form)}</div>}
                {r.verified ? <Badge tone="brand">verified</Badge> : <Badge>manual</Badge>}
              </div>
            </div>
          )
        })}
      </Card>

      {sessionId && sessionId !== 'local' && (
        <Card className="mb-3">
          <div className="mb-2 text-sm font-semibold">How hard was that?</div>
          <div className="grid grid-cols-5 gap-1.5">
            {RPE.map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => {
                  setRpeLocal(o.v)
                  setRpe.mutate(o.v)
                }}
                className={`rounded-lg border py-2 text-xs font-medium ${(rpe ?? remote?.rpe) === o.v ? 'border-brand-400 bg-brand-500/15 text-brand-300' : 'border-slate-700 bg-slate-900 text-slate-300'}`}
              >
                <div className="text-base font-bold">{o.v}</div>
                {o.label}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-slate-500">Tomorrow's plan adapts from this and your form score.</div>
        </Card>
      )}

      <div className="mt-auto flex gap-2">
        <Button className="flex-1" size="lg" onClick={() => nav('/home', { replace: true })}>
          Done
        </Button>
        <Button variant="secondary" onClick={() => nav('/progress', { replace: true })}>
          Progress
        </Button>
      </div>
    </div>
  )
}

function avgLocalForm(ex: { form_score: number | null; reps_completed: number; seconds_held: number }[]): number | null {
  let w = 0
  let s = 0
  for (const e of ex) {
    if (e.form_score == null) continue
    const weight = e.reps_completed || e.seconds_held || 1
    s += e.form_score * weight
    w += weight
  }
  return w ? s / w : null
}
