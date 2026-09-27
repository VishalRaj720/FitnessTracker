import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Alert, Card, PanelHeader, Skeleton } from '@/components/ui'
import { AXIS_TICK, CHART_COLORS, CURSOR_FILL, GRID_STROKE } from '@/components/charts/chartTheme'
import { TelemetryTooltip } from '@/components/charts/TelemetryTooltip'
import { useNutritionHistory } from '@/features/nutrition/api'
import { errorMessage } from '@/lib/apiClient'
import { fmtInt, fmtIsoDay } from '@/lib/format'

export function HistoryCard() {
  const q = useNutritionHistory(7)
  const days = q.data?.days ?? []
  const target = q.data?.targets?.calories
  const logged = days.filter((d) => d.entries > 0)
  const avg = (k: 'calories' | 'protein_g' | 'water_ml') => (logged.length ? logged.reduce((s, d) => s + d[k], 0) / logged.length : 0)
  const data = days.map((d) => ({ ...d, label: fmtIsoDay(d.date, { weekday: 'short' }), water_l: d.water_ml / 1000 }))

  return (
    <Card radius="xl" pad="md">
      <PanelHeader kicker="Fig 0.4 // 7-day intake" kickerDot="brand" title="Calories vs target" right={<span className="font-mono text-[11px] text-slate-500">{logged.length}/7 days logged</span>} />
      {q.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : q.isError ? (
        <Alert>{errorMessage(q.error)}</Alert>
      ) : (
        <>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={34} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
                <Tooltip
                  cursor={{ fill: CURSOR_FILL }}
                  content={<TelemetryTooltip units={{ calories: 'kcal', protein_g: 'g', water_l: 'L' }} />}
                />
                {target && <ReferenceLine y={target} stroke={CHART_COLORS.flame} strokeDasharray="4 4" label={{ value: 'target', position: 'insideTopRight', fill: CHART_COLORS.flame, fontSize: 10 }} />}
                <Bar dataKey="calories" name="Calories" radius={[4, 4, 0, 0]} maxBarSize={34}>
                  {data.map((d) => (
                    <Cell key={d.date} fill={target && d.calories > target * 1.08 ? CHART_COLORS.flame : CHART_COLORS.brand} fillOpacity={d.entries ? 0.85 : 0.18} />
                  ))}
                </Bar>
                <Bar dataKey="protein_g" name="Protein" fill={CHART_COLORS.pulse} hide />
                <Bar dataKey="water_l" name="Water" fill={CHART_COLORS.iris} hide />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 font-mono">
            <Avg label="Avg kcal" value={fmtInt(avg('calories'))} />
            <Avg label="Avg protein" value={`${fmtInt(avg('protein_g'))} g`} />
            <Avg label="Avg water" value={`${(avg('water_ml') / 1000).toFixed(1)} L`} />
          </div>
        </>
      )}
    </Card>
  )
}

function Avg({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-ink-850 px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-bold text-white">{value}</div>
    </div>
  )
}
