import { useState } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { Alert, Badge, Button, Card, Dot, Icon, MonoLabel, ProgressBar, Ring, Skeleton } from '@/components/ui'
import { errorMessage } from '@/lib/apiClient'
import { CATEGORY_LABEL, GOAL_LABEL, LEVEL_LABEL, ORIENTATION_LABEL, fmtInt, targetLabel, weekShort } from '@/lib/format'
import { renderRationale } from '@/lib/rationale'
import { smoothPath, toPoints } from '@/lib/svgPath'
import type { DailyNutrition, Leaderboard, Plan, ProgressSummary, Squad, User } from '@/types/api'

// ---------------------------------------------------------------------------------------------
// Today's plan

export function TodayPlanCard({
  plan,
  pending,
  error,
  offline,
  profile,
  onStart,
  onRegenerate,
  regenerating,
  onRetry,
}: {
  plan: Plan | undefined
  pending: boolean
  error: unknown
  offline: boolean
  profile: User['profile'] | undefined
  onStart: () => void
  onRegenerate: () => void
  regenerating: boolean
  onRetry: () => void
}) {
  const [showWhy, setShowWhy] = useState(false)
  const done = plan?.status === 'completed'
  const sessionTag = plan ? plan.plan_date.slice(5).replace('-', '.') : '--.--'

  return (
    <Card brackets surface="panel" radius="xl" className="overflow-hidden" pad="lg">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
        <div className="space-y-1">
          <MonoLabel dot="volt">Session // {sessionTag}</MonoLabel>
          <h2 className="text-lg font-bold uppercase tracking-tight text-white">Today&apos;s plan</h2>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="rounded border border-white/5 bg-ink-850 px-2 py-1 text-slate-400">
            EST: <span className="text-white">~{plan?.estimated_minutes ?? '–'} MIN</span>
          </span>
          {offline ? (
            <span className="rounded border border-flame/30 bg-flame/10 px-2 py-1 text-flame">OFFLINE COPY</span>
          ) : done ? (
            <span className="rounded border border-brand-400/30 bg-brand-400/10 px-2 py-1 text-brand-400">DONE TODAY</span>
          ) : (
            <span className="rounded border border-pulse/20 bg-pulse/5 px-2 py-1 text-pulse">{plan ? `${plan.items.length} MOVES` : 'LOADING'}</span>
          )}
        </div>
      </div>

      {pending && (
        <div className="divide-y divide-white/5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center justify-between py-4">
              <div className="flex gap-3.5">
                <Skeleton className="h-4 w-5" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      )}

      {!!error && !plan && (
        <div className="py-6">
          <Alert title="Couldn't load today's plan">{errorMessage(error)}</Alert>
          <Button variant="secondary" size="sm" className="mt-3" icon="refresh" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}

      {plan && (
        <>
          <ol className="my-2 divide-y divide-white/5">
            {plan.items.map((it, i) => {
              const cv = it.exercise.cv_supported
              const detail = it.focus_cue ?? it.exercise.muscle_groups.slice(0, 2).join(' · ')
              return (
                <li key={it.id} className="group -mx-2 flex items-center justify-between gap-3 rounded px-2 py-4 transition-colors hover:bg-white/[0.015]">
                  <div className="flex min-w-0 items-start gap-3.5">
                    <span className="mt-0.5 font-mono text-xs text-slate-400">{String(i + 1).padStart(2, '0')}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={clsx('truncate text-sm font-semibold tracking-wide text-white transition-colors', cv ? 'group-hover:text-volt' : 'group-hover:text-pulse')}>
                          {it.exercise.name}
                        </h3>
                        {cv && <Dot tone="volt" />}
                      </div>
                      <p className="mt-0.5 truncate font-mono text-xs text-slate-400">
                        {targetLabel(it)} <span className="text-white/20">|</span> <span className="capitalize">{detail}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden font-mono text-[10px] uppercase text-slate-400 md:inline">
                      {cv ? ORIENTATION_LABEL[it.exercise.orientation] : CATEGORY_LABEL[it.exercise.category]}
                    </span>
                    {cv ? (
                      <span className="flex items-center gap-1.5 rounded border border-volt/30 bg-volt/10 px-2.5 py-1 font-mono text-[11px] text-volt">
                        <Icon name="scan" size={12} /> Camera
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded border border-line bg-ink-800 px-2.5 py-1 font-mono text-[11px] text-slate-300">
                        <Icon name="clock" size={12} /> Timer
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>

          <div className="flex flex-wrap items-center justify-between gap-2 pb-5 pt-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => setShowWhy((v) => !v)}
              aria-expanded={showWhy}
              className="inline-flex items-center gap-1.5 text-slate-400 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-white"
            >
              <Icon name="info" size={14} className="text-pulse" />
              {showWhy ? 'Hide the reasoning' : 'Why this plan? (Read the adaptive rationale)'}
            </button>
            {profile && (
              <span className="hidden text-[11px] uppercase text-slate-400 sm:inline">
                {GOAL_LABEL[profile.goal]} // {LEVEL_LABEL[profile.level]}
              </span>
            )}
          </div>
          {showWhy && (
            <ul className="mb-5 space-y-1.5 rounded-lg border border-line bg-ink-950/70 p-4 text-xs text-slate-300">
              {renderRationale(plan.rationale).map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-pulse">›</span>
                  {line}
                </li>
              ))}
              <li className="pt-1 font-mono text-[11px] text-slate-500">Generated by {plan.generated_by} — deterministic rules, no black box.</li>
            </ul>
          )}

          <div className="flex items-stretch gap-2.5 pt-1">
            <button
              type="button"
              onClick={onStart}
              className="group flex flex-1 items-center justify-center gap-3 rounded-md bg-aqua px-6 py-4 font-mono text-sm font-bold uppercase tracking-wide text-ink-950 shadow-glow-aqua transition-all duration-200 hover:bg-white"
            >
              <Icon name="play" size={16} className="transition-transform group-hover:scale-110" />
              {done ? 'Train again' : 'Start workout & form tracking'}
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              disabled={done || offline || regenerating}
              title={done ? 'Already completed today' : 'Shuffle today’s exercises'}
              aria-label="Shuffle today's exercises"
              className="flex w-14 items-center justify-center rounded-md border border-line bg-ink-850 text-slate-400 transition-colors hover:bg-ink-800 hover:text-white disabled:opacity-40"
            >
              <Icon name="refresh" className={clsx(regenerating && 'animate-spin')} />
            </button>
          </div>
        </>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------------------------
// Form trace (FIG 0.3)

export function FormTraceCard({ progress, pending }: { progress: ProgressSummary | undefined; pending: boolean }) {
  const traces = (progress?.form_trend ?? []).filter((t) => t.points.length > 0).sort((a, b) => b.points.length - a.points.length)
  const primary = traces[0]
  const secondary = traces[1]
  const W = 450
  const H = 180
  const toPts = (vals: number[]) => toPoints(vals, W, H, { pad: 14, min: 40, max: 100 })
  const p1 = primary ? toPts(primary.points.map((p) => p.form_score)) : []
  const p2 = secondary ? toPts(secondary.points.map((p) => p.form_score)) : []
  const all = traces.flatMap((t) => t.points)
  const first = primary?.points[0]?.form_score
  const last = primary?.points[primary.points.length - 1]?.form_score
  const delta = first != null && last != null ? last - first : null
  const trend = delta == null ? 'NO DATA' : delta > 2 ? 'RISING' : delta < -2 ? 'DIPPING' : 'STABLE'
  const best = all.length ? Math.max(...all.map((p) => p.form_score)) : null
  const yOf = (v: number) => H - 14 - ((v - 40) / 60) * (H - 28)

  return (
    <Card brackets radius="xl" pad="md">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div className="space-y-0.5">
          <MonoLabel>Fig 0.3 // Form trace</MonoLabel>
          <div className="flex items-center gap-2 font-mono text-xs font-semibold text-white">
            <span>FORM SCORE · 30 DAYS</span>
            <span
              className={clsx(
                'rounded border px-1.5 text-[10px]',
                trend === 'DIPPING' ? 'border-flame/30 bg-flame/10 text-flame' : trend === 'NO DATA' ? 'border-line text-slate-500' : 'border-pulse/30 bg-pulse/10 text-pulse',
              )}
            >
              {trend}
            </span>
          </div>
        </div>
        <span className="font-mono text-[11px] text-slate-400">{all.length} TRACKED SETS</span>
      </div>

      <div className="relative my-3 h-48 w-full overflow-hidden rounded border border-white/5 bg-ink-950/70 bg-dot-fine">
        <div className="pointer-events-none absolute inset-0">
          {[100, 85, 65].map((v) => (
            <div key={v} className="absolute inset-x-3 border-b border-white/[0.07]" style={{ top: `${(yOf(v) / H) * 100}%` }}>
              <span className="absolute -top-3.5 right-0 font-mono text-[9px] text-slate-500">{v === 100 ? 'MAX 100' : v === 85 ? 'CLEAN 85' : 'WORK ON IT 65'}</span>
            </div>
          ))}
        </div>
        {pending ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Skeleton className="h-2/3 w-5/6" />
          </div>
        ) : primary ? (
          <>
            <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" fill="none" role="img" aria-label={`Form score trend for ${primary.exercise_name}`}>
              {p2.length > 1 && <path d={smoothPath(p2)} stroke="#d2ff00" strokeWidth="1.75" strokeDasharray="3 3" opacity="0.85" vectorEffect="non-scaling-stroke" />}
              {p1.length > 1 && <path d={smoothPath(p1)} stroke="#00f2fe" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
            </svg>
            {p1.length > 0 && <TraceDot x={p1[p1.length - 1][0] / W} y={p1[p1.length - 1][1] / H} color="#00f2fe" />}
            {p2.length > 0 && <TraceDot x={p2[p2.length - 1][0] / W} y={p2[p2.length - 1][1] / H} color="#d2ff00" />}
            <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-1.5 rounded border border-line bg-ink-950/90 px-2 py-1 font-mono text-[10px] shadow-lg backdrop-blur">
              <Dot tone="pulse" />
              <span className="uppercase text-slate-400">{primary.exercise_name}:</span>
              <span className="font-bold text-white">{Math.round(last ?? 0)}</span>
            </div>
            {secondary && (
              <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-1.5 rounded border border-line bg-ink-950/90 px-2 py-1 font-mono text-[10px] shadow-lg backdrop-blur">
                <Dot tone="volt" />
                <span className="uppercase text-slate-400">{secondary.exercise_name}:</span>
                <span className="font-bold text-volt">{Math.round(secondary.points[secondary.points.length - 1].form_score)}</span>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
            <span className="rounded border border-line bg-ink-900/80 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-400">
              No camera-tracked sets yet — your form trace starts with your first workout.
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 font-mono text-[11px]">
        <div className="space-y-1 rounded border border-line bg-ink-850 p-2.5">
          <div className="flex items-center justify-between text-slate-400">
            <span>FORM_DELTA</span>
            <span className={clsx('font-bold', delta == null ? 'text-slate-500' : delta >= 0 ? 'text-pulse' : 'text-flame')}>
              {delta == null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`}
            </span>
          </div>
          <div className="text-[10px] text-slate-400">Change across the last 30 days</div>
        </div>
        <div className="space-y-1 rounded border border-line bg-ink-850 p-2.5">
          <div className="flex items-center justify-between text-slate-400">
            <span>BEST_SET</span>
            <span className="font-bold text-volt">{best == null ? '—' : Math.round(best)}</span>
          </div>
          <div className="text-[10px] text-slate-400">Full 33-point skeletal tracking</div>
        </div>
      </div>
    </Card>
  )
}

function TraceDot({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <span className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>
      <span className="absolute inset-0 animate-ping rounded-full opacity-40" style={{ background: color }} />
      <span className="relative block h-2.5 w-2.5 rounded-full border-2 bg-ink-900" style={{ borderColor: color }} />
    </span>
  )
}

// ---------------------------------------------------------------------------------------------
// Week & squad

export function ThisWeekCard({ progress, targetDays }: { progress: ProgressSummary | undefined; targetDays: number }) {
  const w = progress?.this_week
  const done = w?.days_done ?? 0
  const target = w?.target_days ?? targetDays
  const current = progress?.weekly[progress.weekly.length - 1]?.week
  const note =
    done === 0 ? 'One session starts this week’s streak' : done >= target ? 'Weekly target hit — nice work' : `${target - done} more session${target - done === 1 ? '' : 's'} to hit your target`
  return (
    <Card radius="xl" pad="sm" className="space-y-4 sm:p-5">
      <div className="flex items-center justify-between">
        <MonoLabel>This week</MonoLabel>
        <span className="font-mono text-xs text-slate-400">CYCLE {current ? weekShort(current) : '—'}</span>
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-3xl font-extrabold text-white">{done}</span>
          <span className="font-mono text-sm text-slate-400">/ {target} days</span>
        </div>
        <div className="mt-1 font-mono text-[11px] text-slate-400">{w?.verified_minutes ?? 0} verified camera min</div>
      </div>
      <div className="grid gap-1.5 pt-1" style={{ gridTemplateColumns: `repeat(${Math.max(1, target)}, minmax(0, 1fr))` }}>
        {Array.from({ length: target }, (_, i) => (
          <div key={i} className={clsx('h-2 rounded-sm border', i < done ? 'border-brand-400/60 bg-brand-400 shadow-[0_0_8px_rgba(0,229,153,0.5)]' : 'border-white/10 bg-ink-800')} />
        ))}
      </div>
      <div className="flex items-center gap-1.5 pt-1 font-mono text-[10px] text-slate-400">
        <Dot tone={done >= target ? 'brand' : 'flame'} />
        <span>{note}</span>
      </div>
    </Card>
  )
}

export function SquadCard({ squad, board }: { squad: Squad | null | undefined; board: Leaderboard | undefined }) {
  const me = board?.rows.find((r) => r.is_me)
  return (
    <Card radius="xl" pad="sm" className="flex flex-col justify-between space-y-4 sm:p-5">
      <div>
        <div className="flex items-center justify-between">
          <MonoLabel>Squad sync</MonoLabel>
          <Dot tone={squad ? 'pulse' : 'slate'} pulse={!!squad} className="h-2 w-2" />
        </div>
        {squad ? (
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-3xl font-extrabold text-white">#{me?.rank ?? '–'}</span>
              <span className="font-mono text-sm text-slate-400">of {squad.member_count}</span>
            </div>
            <p className="mt-1 truncate text-xs text-slate-400">
              {squad.name} · {me?.verified_minutes ?? 0} verified min this week
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <div className="text-sm font-semibold text-white">No squad linked yet</div>
            <p className="mt-1 text-xs text-slate-400">Compete on weekly verified minutes with 3–8 friends.</p>
          </div>
        )}
      </div>
      <Link to="/squad" className="group inline-flex items-center gap-1.5 pt-2 font-mono text-xs text-pulse transition-colors hover:text-white">
        {squad ? 'Open leaderboard' : 'Create or join squad'}
        <Icon name="arrow-right" size={13} className="transition-transform group-hover:translate-x-1" />
      </Link>
    </Card>
  )
}

// ---------------------------------------------------------------------------------------------
// Nutrition (the Diet & Nutrition feature surfaced on the dashboard)

export function FuelCard({ day, pending }: { day: DailyNutrition | undefined; pending: boolean }) {
  const t = day?.targets
  const c = day?.consumed
  return (
    <Card radius="xl" pad="sm" className="sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <MonoLabel dot="brand">Fuel // today</MonoLabel>
        <Link to="/nutrition" className="group inline-flex items-center gap-1 font-mono text-[11px] text-pulse hover:text-white">
          Diet plan <Icon name="arrow-right" size={12} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      {pending ? (
        <div className="flex items-center gap-4">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ) : t && c ? (
        <div className="flex items-center gap-5">
          <Ring value={c.calories} max={t.calories} size={104} stroke={9} tone="brand">
            <span className="font-mono text-lg font-bold leading-none text-white">{fmtInt(c.calories)}</span>
            <span className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-500">/ {fmtInt(t.calories)} kcal</span>
          </Ring>
          <div className="min-w-0 flex-1 space-y-2.5">
            {(
              [
                ['Protein', c.protein_g, t.protein_g, 'g', 'pulse'],
                ['Carbs', c.carbs_g, t.carbs_g, 'g', 'volt'],
                ['Fat', c.fat_g, t.fat_g, 'g', 'flame'],
                ['Water', c.water_ml / 1000, t.water_ml / 1000, 'L', 'iris'],
              ] as const
            ).map(([label, v, max, unit, tone]) => (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-slate-300">
                    {unit === 'L' ? v.toFixed(1) : Math.round(v)} / {unit === 'L' ? max.toFixed(1) : Math.round(max)} {unit}
                  </span>
                </div>
                <ProgressBar value={v} max={max} tone={tone} size="sm" label={label} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">Get daily calorie, protein and water targets built from your goal and body metrics.</p>
          <Link to="/nutrition" className="inline-flex items-center gap-1.5 font-mono text-xs text-brand-400 hover:text-white">
            Set up nutrition <Icon name="arrow-right" size={13} />
          </Link>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------------------------
// Campus banner & feature strip

export function CampusBanner({ user, activeStudents }: { user: User; activeStudents: number | undefined }) {
  if (!user.institute) return null
  return (
    <Link
      to={`/campus/${user.institute.slug}`}
      className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-900/85 p-4 transition-colors hover:border-slate-700"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-white/10 bg-ink-800 text-slate-300 transition-colors group-hover:text-volt">
          <Icon name="building" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-white transition-colors group-hover:text-volt">
            <span className="truncate">{user.institute.name} campus dashboard</span>
            <Badge mono size="sm" className="shrink-0">
              Campus mesh
            </Badge>
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            {activeStudents == null ? 'Fit India participation report' : `${activeStudents} athlete${activeStudents === 1 ? '' : 's'} active this week`}
          </div>
        </div>
      </div>
      <Icon name="arrow-right" size={14} className="shrink-0 text-slate-400 transition-all group-hover:translate-x-0.5 group-hover:text-white" />
    </Link>
  )
}

const FEATURES = [
  { key: 'CV_INFERENCE', tone: 'bg-pulse', title: 'Zero-lag edge vision', body: 'Every rep is scored on your own phone — no video upload, no server round-trip, no privacy trade-off.' },
  { key: 'RHYTHM_ADAPTATION', tone: 'bg-volt', title: 'Adaptive daily plan', body: 'Tomorrow’s plan adapts to today’s completion, form score and the effort you rated.' },
  { key: 'STREAK_TELEMETRY', tone: 'bg-flame', title: 'Verified habit chains', body: 'Only camera-tracked minutes reach leaderboards — nothing to type in, nothing to fake.' },
  { key: 'FUEL_PROTOCOL', tone: 'bg-brand-400', title: 'Category-based nutrition', body: 'Calorie, protein and water targets built from your goal, level and diet — plus a daily intake log.' },
]

export function FeatureStrip() {
  return (
    <section className="border-t border-line pb-4 pt-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.key} className="space-y-2 border-l border-white/10 pl-4">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-slate-400">
              <span className={clsx('h-1.5 w-1.5 rounded-full', f.tone)} />
              {f.key}
            </div>
            <h4 className="text-sm font-semibold text-white">{f.title}</h4>
            <p className="text-xs leading-relaxed text-slate-400">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
