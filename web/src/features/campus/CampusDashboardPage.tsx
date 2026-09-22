import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Alert, Badge, Card, Spinner, Stat } from '@/components/ui'
import { api, errorMessage } from '@/lib/apiClient'
import { weekShort } from '@/lib/format'
import type { InstituteStats } from '@/types/api'

const tooltipStyle = { background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }

export function CampusDashboardPage() {
  const { slug } = useParams()
  const q = useQuery({
    queryKey: ['institute', slug, 'stats'],
    queryFn: () => api<InstituteStats>(`/institutes/${slug}/stats?weeks=8`, { auth: false }),
    enabled: !!slug,
    staleTime: 60_000,
  })

  return (
    <div className="mx-auto min-h-full max-w-5xl px-4 pb-10 pt-[calc(var(--safe-top)+16px)]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <img src="/icons/icon.svg" alt="" className="h-7 w-7 rounded-md" />
            <span className="text-sm font-semibold text-slate-400">FitSathi · Campus</span>
            <Badge tone="brand">Fit India</Badge>
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{q.data?.institute.name ?? slug}</h1>
          {q.data && (
            <div className="text-sm text-slate-400">
              {q.data.institute.city}, {q.data.institute.state} · {q.data.total_students} students on FitSathi · week {weekShort(q.data.week)}
            </div>
          )}
        </div>
        <Link to="/home" className="text-sm text-slate-400 hover:text-slate-200">
          ← Back to app
        </Link>
      </div>

      {q.isPending && <Spinner />}
      {q.isError && <Alert>{errorMessage(q.error)}</Alert>}

      {q.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Active students" value={q.data.this_week.active_students} hint="this week" />
            <Stat label="Verified sessions" value={q.data.this_week.verified_sessions} hint="camera-counted" />
            <Stat label="Verified minutes" value={q.data.this_week.verified_minutes.toLocaleString('en-IN')} hint="this week" />
            <Stat label="Avg form score" value={q.data.this_week.avg_form_score == null ? '—' : Math.round(q.data.this_week.avg_form_score)} hint="0–100" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <div className="mb-2 font-semibold">Participation trend</div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={q.data.trend.map((t) => ({ ...t, label: weekShort(t.week) }))} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="students" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis yAxisId="minutes" orientation="right" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#cbd5e1' }} />
                    <Line yAxisId="students" type="monotone" dataKey="active_students" name="active students" stroke="#34d399" strokeWidth={2.5} dot={{ r: 3, fill: '#34d399' }} />
                    <Line yAxisId="minutes" type="monotone" dataKey="verified_minutes" name="verified min" stroke="#38bdf8" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <div className="mb-2 flex items-baseline justify-between">
                <div className="font-semibold">By department</div>
                <div className="text-xs text-slate-500">rows with &lt; {q.data.k_anonymity_threshold} active students are hidden</div>
              </div>
              {q.data.by_department.length === 0 ? (
                <div className="flex h-56 items-center justify-center text-sm text-slate-500">Not enough active students per department yet this week.</div>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={q.data.by_department} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid horizontal={false} stroke="#1e293b" />
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="department" width={60} tick={{ fill: '#cbd5e1', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#cbd5e1' }} cursor={{ fill: '#1e293b' }} />
                      <Bar dataKey="verified_minutes" name="verified min" fill="#34d399" radius={[0, 6, 6, 0]} barSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          <Card>
            <div className="mb-2 font-semibold">Top squads this week</div>
            {q.data.top_squads.length === 0 ? (
              <div className="py-4 text-sm text-slate-500">No squads yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-1">#</th>
                    <th className="py-1">Squad</th>
                    <th className="py-1 text-right">Members</th>
                    <th className="py-1 text-right">Verified min</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {q.data.top_squads.map((s, i) => (
                    <tr key={s.name}>
                      <td className="py-2 font-bold text-slate-400">{i + 1}</td>
                      <td className="py-2 font-medium">{s.name}</td>
                      <td className="py-2 text-right">{s.members}</td>
                      <td className="py-2 text-right font-semibold">{s.verified_minutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <p className="text-center text-xs text-slate-600">Aggregates only. No individual data is shown. All pose detection ran on students' own devices.</p>
        </div>
      )}
    </div>
  )
}
