import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { Badge, Button, Card, Icon, PanelHeader, Stat, StatusPill } from '@/components/ui'
import { Backdrop } from '@/components/layout/Backdrop'
import { FlowHeader } from '@/components/layout/FlowHeader'
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
  const durationSeconds =
    remote?.duration_seconds ?? (localPayload ? Math.round((new Date(localPayload.ended_at).getTime() - new Date(localPayload.started_at).getTime()) / 1000) : 0)
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

  const status = queued ? { tone: 'flame' as const, text: 'Saved on this phone — syncs when online' } : remote?.verified ? { tone: 'brand' as const, text: 'Verified by camera' } : { tone: 'pulse' as const, text: 'Saved' }

  return (
    <div className="relative flex min-h-full flex-col">
      <Backdrop variant="dots" />
      <FlowHeader
        tag="session complete"
        width="max-w-4xl"
        right={
          <button type="button" aria-label="Close summary" onClick={() => nav('/home', { replace: true })} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.05] hover:text-white">
            <Icon name="x" size={20} />
          </button>
        }
      />
      <main className="relative z-10 mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8 sm:px-6 sm:py-10">
        <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <StatusPill tone={status.tone}>{status.text}</StatusPill>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Workout done</h1>
            <p className="text-sm text-slate-400">Tomorrow's plan adapts from these numbers and the effort you rate below.</p>
          </div>
          {streak && (
            <div className="flex items-center gap-3 rounded-xl border border-flame/30 bg-flame/[0.07] px-4 py-3">
              <Icon name="flame" size={22} className="text-flame" />
              <div>
                <div className="font-mono text-2xl font-extrabold leading-none text-white">{streak.current}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-amber-200/80">day streak{streak.changed ? ' · +1' : ''}</div>
              </div>
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Reps" value={totalReps} icon="activity" />
          <Stat label="Form" value={avgForm == null ? '—' : Math.round(avgForm)} icon="target" tone={avgForm != null && avgForm >= 85 ? 'brand' : undefined} hint={avgForm == null ? 'Manual mode' : 'Average score'} />
          <Stat label="Verified" value={fmtMinutes(verifiedSeconds)} icon="shield-check" tone="brand" hint={queued ? 'Pending sync' : 'Counts on leaderboards'} hintTone={queued ? 'flame' : 'slate'} />
          <Stat label="Duration" value={fmtMinutes(durationSeconds)} icon="clock" />
        </div>

        <DebriefCard sessionId={sessionId} />

        <Card radius="xl" pad="md">
          <PanelHeader kicker={`Exercise results // ${rows.length}`} kickerDot="volt" title="Set by set" />
          <ul className="divide-y divide-line">
            {rows.map((r, i) => {
              const topFlag = Object.entries(r.flags ?? {}).sort((a, b) => b[1] - a[1])[0]
              return (
                <li key={r.key} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 font-mono text-xs text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{r.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-400">
                        {r.targetReps > 0 ? `${r.reps}/${r.targetReps} reps` : `${r.held}/${r.targetSeconds}s held`}
                        {topFlag && topFlag[1] > 0 && (
                          <Badge tone="flame" mono size="sm">
                            {FLAG_LABEL[topFlag[0]] ?? topFlag[0]} ×{topFlag[1]}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {r.form != null && <span className={clsx('font-mono text-lg font-bold', r.form >= 85 ? 'text-brand-400' : 'text-white')}>{Math.round(r.form)}</span>}
                    {r.verified ? (
                      <Badge tone="brand" mono dot>
                        Verified
                      </Badge>
                    ) : (
                      <Badge mono>Manual</Badge>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>

        {sessionId && sessionId !== 'local' && (
          <Card radius="xl" pad="md">
            <PanelHeader kicker="Effort // RPE" kickerDot="iris" title="How hard was that?" divider={false} />
            <div role="radiogroup" aria-label="Rate of perceived exertion" className="grid grid-cols-5 gap-2">
              {RPE.map((o) => {
                const on = (rpe ?? remote?.rpe) === o.v
                return (
                  <button
                    key={o.v}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setRpeLocal(o.v)
                      setRpe.mutate(o.v)
                    }}
                    className={clsx(
                      'rounded-lg border py-3 text-xs font-medium transition',
                      on ? 'border-iris-500 bg-iris-500/15 text-white shadow-[0_0_16px_-2px_rgba(90,107,255,0.45)]' : 'border-line bg-ink-800 text-slate-300 hover:border-line-strong',
                    )}
                  >
                    <div className="font-mono text-lg font-bold">{o.v}</div>
                    {o.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-slate-500">{setRpe.isSuccess ? 'Saved — tomorrow’s plan will use it.' : 'Tomorrow’s plan adapts from this and your form score.'}</p>
          </Card>
        )}

        <div className="flex flex-col-reverse gap-3 pb-6 sm:flex-row">
          <Button variant="secondary" size="lg" icon="chart" onClick={() => nav('/progress', { replace: true })}>
            Progress
          </Button>
          <Button variant="primary" size="lg" block iconRight="arrow-right" onClick={() => nav('/home', { replace: true })}>
            Done
          </Button>
        </div>
      </main>
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
