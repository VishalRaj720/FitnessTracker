import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { clsx } from 'clsx'
import { Alert, ButtonLink, Card, EmptyState, Icon, PageHeader, PanelHeader, Skeleton, Stat } from '@/components/ui'
import { AXIS_TICK, CHART_COLORS, CURSOR_FILL, GRID_STROKE } from '@/components/charts/chartTheme'
import { TelemetryTooltip } from '@/components/charts/TelemetryTooltip'
import { Backdrop } from '@/components/layout/Backdrop'
import { FlowFooter, FlowHeader } from '@/components/layout/FlowHeader'
import { useAuthStore } from '@/features/auth/authStore'
import { api, errorMessage } from '@/lib/apiClient'
import { fmtInt, weekShort } from '@/lib/format'
import type { InstituteStats } from '@/types/api'

export function CampusDashboardPage() {
  const { slug } = useParams()
  const token = useAuthStore((s) => s.token)
  const q = useQuery({
    queryKey: ['institute', slug, 'stats'],
    queryFn: () => api<InstituteStats>(`/institutes/${slug}/stats?weeks=8`, { auth: false }),
    enabled: !!slug,
    staleTime: 60_000,
  })
  const d = q.data

  return (
    <div className="relative flex min-h-full flex-col">
      <Backdrop variant="dots" />
      <FlowHeader
        tag="campus // fit india"
        logoTo={token ? '/home' : '/'}
        width="max-w-[1440px]"
        right={
          token ? (
            <ButtonLink to="/home" variant="secondary" size="sm" icon="arrow-left">
              Back to app
            </ButtonLink>
          ) : (
            <ButtonLink to="/register" variant="signal" size="sm" iconRight="arrow-right">
              Join FitSathi
            </ButtonLink>
          )
        }
      />
      <main className="relative z-10 mx-auto w-full max-w-[1440px] flex-1 space-y-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <PageHeader
          size="lg"
          badge={d ? `Campus telemetry // week ${weekShort(d.week)}` : 'Campus telemetry'}
          badgeTone="volt"
          title={d?.institute.name ?? slug}
          subtitle={
            d
              ? `${[d.institute.city, d.institute.state].filter(Boolean).join(', ')} · ${d.total_students} student${d.total_students === 1 ? '' : 's'} on FitSathi · camera-verified participation only`
              : 'Fit India participation report'
          }
        />

        {q.isPending && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        )}
        {q.isError && <Alert title="Couldn't load this campus">{errorMessage(q.error)}</Alert>}

        {d && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Active students" value={d.this_week.active_students} icon="users" tone="pulse" hint="This week" />
              <Stat label="Verified sessions" value={d.this_week.verified_sessions} icon="scan" hint="Camera-counted" />
              <Stat label="Verified minutes" value={fmtInt(d.this_week.verified_minutes)} unit="min" icon="shield-check" tone="brand" hint="This week" />
              <Stat label="Avg form score" value={d.this_week.avg_form_score == null ? '—' : Math.round(d.this_week.avg_form_score)} icon="target" tone="volt" hint="0–100, on-device" />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card radius="xl" pad="md" brackets>
                <PanelHeader kicker="Fig 1.1 // Participation" kickerDot="brand" title="Active students & verified minutes" />
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={d.trend.map((t) => ({ ...t, label: weekShort(t.week) }))} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                      <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="students" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                      <YAxis yAxisId="minutes" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                      <Tooltip content={<TelemetryTooltip units={{ verified_minutes: 'min' }} />} />
                      <Line yAxisId="students" type="monotone" dataKey="active_students" name="Active students" stroke={CHART_COLORS.brand} strokeWidth={2.4} dot={{ r: 2.5, fill: CHART_COLORS.brand, strokeWidth: 0 }} />
                      <Line yAxisId="minutes" type="monotone" dataKey="verified_minutes" name="Verified minutes" stroke={CHART_COLORS.pulse} strokeWidth={2} strokeDasharray="4 4" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card radius="xl" pad="md" brackets>
                <PanelHeader
                  kicker="Fig 1.2 // By department"
                  kickerDot="pulse"
                  title="Verified minutes this week"
                  right={<span className="font-mono text-[10px] text-slate-500">hidden below {d.k_anonymity_threshold} active</span>}
                />
                {d.by_department.length === 0 ? (
                  <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-line px-6 text-center text-sm text-slate-500">
                    Not enough active students per department yet this week.
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={d.by_department} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                        <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
                        <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="department" width={60} tick={{ ...AXIS_TICK, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: CURSOR_FILL }} content={<TelemetryTooltip units={{ verified_minutes: 'min' }} />} />
                        <Bar dataKey="verified_minutes" name="Verified minutes" fill={CHART_COLORS.brand} radius={[0, 5, 5, 0]} barSize={26} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>

            <Card radius="xl" pad="md">
              <PanelHeader kicker="Campus league // top squads" kickerDot="volt" title="This week's leaderboard" right={<span className="font-mono text-[10px] text-slate-500">camera-verified minutes</span>} />
              {d.top_squads.length === 0 ? (
                <EmptyState flat icon="users" title="No squads yet" body="Create one from the Squad tab and it will appear here." />
              ) : (
                <ol className="space-y-2">
                  {d.top_squads.map((s, i) => (
                    <li key={s.name} className={clsx('flex items-center justify-between gap-3 rounded-lg border p-3', i === 0 ? 'border-line-strong bg-ink-850' : 'border-line bg-ink-900/60')}>
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={clsx(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono text-[11px] font-bold',
                            i === 0 ? 'bg-volt text-ink-950' : i === 1 ? 'bg-slate-300 text-ink-950' : i === 2 ? 'bg-flame/80 text-ink-950' : 'bg-ink-700 text-slate-300',
                          )}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{s.name}</div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {s.members} member{s.members === 1 ? '' : 's'}
                          </div>
                        </div>
                      </div>
                      <span className={clsx('shrink-0 font-mono text-sm font-bold', i === 0 ? 'text-brand-400' : 'text-slate-200')}>{fmtInt(s.verified_minutes)} min</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <p className="flex items-center justify-center gap-2 text-center font-mono text-[11px] text-slate-500">
              <Icon name="lock" size={12} /> Aggregates only. No individual data is shown. All pose detection ran on students' own devices.
            </p>
          </>
        )}
        {!slug && (
          <Link to="/" className="text-sm text-pulse">
            Back
          </Link>
        )}
      </main>
      <FlowFooter width="max-w-[1440px]" />
    </div>
  )
}
