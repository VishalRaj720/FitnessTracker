import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { clsx } from 'clsx'
import { Alert, Badge, Card, Chip, EmptyState, Icon, PageHeader, PanelHeader, Skeleton, Stat } from '@/components/ui'
import { AXIS_TICK, CHART_COLORS, CURSOR_FILL, GRID_STROKE } from '@/components/charts/chartTheme'
import { TelemetryTooltip } from '@/components/charts/TelemetryTooltip'
import { useProgress } from '@/features/home/api'
import { useRecentSessions } from '@/features/workout/api'
import { errorMessage } from '@/lib/apiClient'
import { fmtDate, fmtDateTime, fmtInt, fmtMinutes, weekShort } from '@/lib/format'

export function ProgressPage() {
  const progress = useProgress()
  const sessions = useRecentSessions(10)
  const [trendSlug, setTrendSlug] = useState<string | null>(null)

  const header = (
    <PageHeader
      size="lg"
      badge="Telemetry // last 8 weeks"
      title="Progress"
      subtitle="Verified minutes and form score — the two numbers that matter. Everything here was measured by the camera, not typed in."
    />
  )

  if (progress.isPending) {
    return (
      <div className="space-y-8">
        {header}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }
  if (progress.isError) {
    return (
      <div className="space-y-8">
        {header}
        <Alert title="Couldn't load your progress">{errorMessage(progress.error)}</Alert>
      </div>
    )
  }

  const p = progress.data
  const trends = p.form_trend.filter((t) => t.points.length > 0)
  const active = trends.find((t) => t.exercise_slug === trendSlug) ?? trends[0]
  const weekly = p.weekly.map((w, i) => ({ ...w, label: weekShort(w.week), current: i === p.weekly.length - 1 }))
  const pts = active?.points ?? []
  const latest = pts[pts.length - 1]?.form_score
  const best = pts.length ? Math.max(...pts.map((x) => x.form_score)) : null
  const delta = pts.length > 1 ? pts[pts.length - 1].form_score - pts[0].form_score : null

  return (
    <div className="space-y-8">
      {header}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Streak" value={p.streak.current} unit="days" icon="flame" tone={p.streak.current > 0 ? 'flame' : undefined} hint={`Best: ${p.streak.longest} days`} />
        <Stat label="This week" value={`${p.this_week.days_done}/${p.this_week.target_days}`} unit="days" icon="calendar" hint={`${p.this_week.sessions} session${p.this_week.sessions === 1 ? '' : 's'}`} hintTone="pulse" />
        <Stat label="Verified" value={fmtInt(p.totals.verified_minutes)} unit="min" icon="shield-check" tone="brand" hint="All-time, camera-counted" />
        <Stat label="Sessions" value={p.totals.sessions} icon="activity" hint={p.streak.last_workout_date ? `Last: ${fmtDate(p.streak.last_workout_date)}` : 'No sessions yet'} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <Card radius="xl" pad="md" className="lg:col-span-7" brackets>
          <PanelHeader kicker="Fig 0.1 // Verified minutes" kickerDot="brand" title="Weekly verified minutes" right={<span className="font-mono text-[11px] text-slate-500">WHO guideline 150 / wk</span>} />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                {/* Always leave room for the 150-min guideline so the gap to it is visible. */}
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={32} domain={[0, (max: number) => Math.max(160, Math.ceil(max * 1.15))]} />
                <Tooltip cursor={{ fill: CURSOR_FILL }} content={<TelemetryTooltip units={{ verified_minutes: 'min' }} />} />
                <ReferenceLine y={150} stroke={CHART_COLORS.flame} strokeDasharray="4 4" label={{ value: 'WHO 150', position: 'insideTopRight', fill: CHART_COLORS.flame, fontSize: 10 }} />
                <Bar dataKey="verified_minutes" name="Verified" radius={[4, 4, 0, 0]} maxBarSize={38}>
                  {weekly.map((w) => (
                    <Cell key={w.week} fill={w.current ? CHART_COLORS.pulse : CHART_COLORS.brand} fillOpacity={w.current ? 1 : 0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 font-mono text-[11px] text-slate-500">Current week in cyan. The dashed line is the WHO's 150 minutes of moderate activity a week.</p>
        </Card>

        <Card radius="xl" pad="md" className="lg:col-span-5" brackets>
          <PanelHeader
            kicker="Fig 0.2 // Form trace"
            kickerDot="pulse"
            title="Form score · 30 days"
            right={
              active && (
                <Badge tone={delta != null && delta < -2 ? 'flame' : 'pulse'} mono>
                  {delta == null ? 'New' : delta > 2 ? 'Rising' : delta < -2 ? 'Dipping' : 'Stable'}
                </Badge>
              )
            }
          />
          {trends.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-6 text-center">
              <Icon name="scan" size={22} className="text-slate-600" />
              <p className="text-sm text-slate-400">Do a camera-tracked workout to see your form trend.</p>
            </div>
          ) : (
            <>
              <div className="no-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1">
                {trends.map((t) => (
                  <Chip key={t.exercise_slug} size="sm" accent="pulse" active={active?.exercise_slug === t.exercise_slug} onClick={() => setTrendSlug(t.exercise_slug)} className="shrink-0">
                    {t.exercise_name}
                  </Chip>
                ))}
              </div>
              <div className="h-44 rounded-lg border border-white/5 bg-ink-950/60 bg-dot-fine">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pts.map((pt) => ({ ...pt, label: fmtDate(pt.date) }))} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis domain={[40, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
                    <Tooltip content={<TelemetryTooltip />} />
                    <ReferenceLine y={85} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="form_score" name="Form" stroke={CHART_COLORS.pulse} strokeWidth={2.2} dot={{ r: 2.5, fill: CHART_COLORS.pulse, strokeWidth: 0 }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <MiniMetric label="Latest" value={latest == null ? '—' : String(Math.round(latest))} />
                <MiniMetric label="Best" value={best == null ? '—' : String(Math.round(best))} tone="text-volt" />
                <MiniMetric label="Delta" value={delta == null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`} tone={delta != null && delta < 0 ? 'text-flame' : 'text-pulse'} />
              </div>
            </>
          )}
        </Card>
      </div>

      <Card radius="xl" pad="md">
        <PanelHeader kicker="Session log // recent 10" kickerDot="volt" title="Recent sessions" />
        {sessions.isPending && (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
        {sessions.isError && <Alert>{errorMessage(sessions.error)}</Alert>}
        {sessions.data && sessions.data.items.length === 0 && (
          <EmptyState icon="activity" title="No sessions yet" body="Your first workout shows up here with its reps, duration and form score." flat />
        )}
        {sessions.data && sessions.data.items.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="hidden grid-cols-[1.6fr_1fr_1fr_0.8fr_0.9fr_24px] gap-3 border-b border-line bg-ink-850 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:grid">
              <span>Started</span>
              <span>Reps</span>
              <span>Duration</span>
              <span>Form</span>
              <span>Status</span>
              <span />
            </div>
            <ul className="divide-y divide-line">
              {sessions.data.items.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/workout/summary/${s.id}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition hover:bg-white/[0.02] sm:grid-cols-[1.6fr_1fr_1fr_0.8fr_0.9fr_24px]"
                  >
                    <div>
                      <div className="text-sm font-medium text-white">{fmtDateTime(s.started_at)}</div>
                      <div className="font-mono text-[11px] text-slate-500 sm:hidden">
                        {s.total_reps} reps · {fmtMinutes(s.duration_seconds)}
                        {s.avg_form_score != null && ` · form ${Math.round(s.avg_form_score)}`}
                      </div>
                    </div>
                    <span className="hidden font-mono text-sm text-slate-300 sm:block">{s.total_reps}</span>
                    <span className="hidden font-mono text-sm text-slate-300 sm:block">{fmtMinutes(s.duration_seconds)}</span>
                    <span className={clsx('hidden font-mono text-sm sm:block', s.avg_form_score == null ? 'text-slate-600' : s.avg_form_score >= 85 ? 'text-brand-400' : 'text-slate-200')}>
                      {s.avg_form_score == null ? '—' : Math.round(s.avg_form_score)}
                    </span>
                    <span>
                      {s.verified ? (
                        <Badge tone="brand" mono dot>
                          Verified
                        </Badge>
                      ) : (
                        <Badge mono>Manual</Badge>
                      )}
                    </span>
                    <Icon name="chevron-right" size={15} className="hidden text-slate-500 sm:block" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  )
}

function MiniMetric({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-line bg-ink-850 px-3 py-2">
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={clsx('font-mono text-base font-bold', tone)}>{value}</div>
    </div>
  )
}
