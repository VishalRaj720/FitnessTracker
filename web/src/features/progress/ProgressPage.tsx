import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Alert, Badge, Card, Chip, PageTitle, Spinner, Stat } from '@/components/ui'
import { useProgress } from '@/features/home/api'
import { useRecentSessions } from '@/features/workout/api'
import { errorMessage } from '@/lib/apiClient'
import { fmtDate, fmtDateTime, fmtMinutes, weekShort } from '@/lib/format'

export function ProgressPage() {
  const progress = useProgress()
  const sessions = useRecentSessions(10)
  const [trendSlug, setTrendSlug] = useState<string | null>(null)

  if (progress.isPending) return <Spinner />
  if (progress.isError) return <Alert>{errorMessage(progress.error)}</Alert>
  const p = progress.data

  const trends = p.form_trend.filter((t) => t.points.length > 0)
  const active = trends.find((t) => t.exercise_slug === trendSlug) ?? trends[0]

  return (
    <div className="space-y-4">
      <PageTitle title="Progress" subtitle="Verified minutes and form — the two numbers that matter." />

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Streak" value={`🔥 ${p.streak.current}`} hint={`best ${p.streak.longest}`} />
        <Stat label="This week" value={`${p.this_week.days_done}/${p.this_week.target_days}`} hint="days" />
        <Stat label="Total" value={p.totals.sessions} hint="sessions" />
      </div>

      <Card>
        <div className="mb-2 flex items-baseline justify-between">
          <div className="font-semibold">Verified minutes</div>
          <div className="text-xs text-slate-400">last 8 weeks</div>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={p.weekly.map((w) => ({ ...w, label: weekShort(w.week) }))} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: '#cbd5e1' }} cursor={{ fill: '#1e293b' }} />
              <Bar dataKey="verified_minutes" name="min" fill="#34d399" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-baseline justify-between">
          <div className="font-semibold">Form score</div>
          <div className="text-xs text-slate-400">last 30 days</div>
        </div>
        {trends.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">Do a camera-tracked workout to see your form trend.</div>
        ) : (
          <>
            <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto">
              {trends.map((t) => (
                <Chip key={t.exercise_slug} active={active?.exercise_slug === t.exercise_slug} onClick={() => setTrendSlug(t.exercise_slug)}>
                  {t.exercise_name}
                </Chip>
              ))}
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={active?.points.map((pt) => ({ ...pt, label: fmtDate(pt.date) })) ?? []} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[40, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: '#cbd5e1' }} />
                  <Line type="monotone" dataKey="form_score" name="form" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3, fill: '#38bdf8' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Card>

      <Card>
        <div className="mb-2 font-semibold">Recent sessions</div>
        {sessions.isPending && <Spinner />}
        {sessions.data && sessions.data.items.length === 0 && <div className="py-4 text-center text-sm text-slate-500">No sessions yet.</div>}
        <ul className="divide-y divide-slate-800">
          {sessions.data?.items.map((s) => (
            <li key={s.id}>
              <Link to={`/workout/summary/${s.id}`} className="flex items-center justify-between py-2.5">
                <div>
                  <div className="text-sm font-medium">{fmtDateTime(s.started_at)}</div>
                  <div className="text-xs text-slate-400">
                    {s.total_reps} reps · {fmtMinutes(s.duration_seconds)}
                    {s.avg_form_score != null && ` · form ${Math.round(s.avg_form_score)}`}
                  </div>
                </div>
                {s.verified ? <Badge tone="brand">verified</Badge> : <Badge>manual</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
