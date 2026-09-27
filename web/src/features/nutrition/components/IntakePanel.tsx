import { clsx } from 'clsx'
import { Button, Card, Icon, MonoLabel, PanelHeader, ProgressBar, Ring } from '@/components/ui'
import type { Tone } from '@/components/ui/styles'
import { useAddWater } from '@/features/nutrition/api'
import { fmtInt, fmtNum } from '@/lib/format'
import type { DailyNutrients, DailyNutrition, NutritionTargets } from '@/types/api'

const MACROS: { key: keyof DailyNutrients; label: string; unit: string; tone: Tone }[] = [
  { key: 'protein_g', label: 'Protein', unit: 'g', tone: 'pulse' },
  { key: 'carbs_g', label: 'Carbohydrates', unit: 'g', tone: 'volt' },
  { key: 'fat_g', label: 'Fat', unit: 'g', tone: 'flame' },
  { key: 'fiber_g', label: 'Fibre', unit: 'g', tone: 'brand' },
]

const MICROS: { key: keyof DailyNutrients; label: string; unit: string; why: string }[] = [
  { key: 'iron_mg', label: 'Iron', unit: 'mg', why: 'Oxygen to working muscles' },
  { key: 'calcium_mg', label: 'Calcium', unit: 'mg', why: 'Bones under load' },
  { key: 'vitamin_c_mg', label: 'Vitamin C', unit: 'mg', why: 'Helps absorb plant iron' },
]

function calorieStatus(consumed: number, target: number): { label: string; cls: string } {
  const r = consumed / target
  if (r > 1.08) return { label: 'OVER TARGET', cls: 'border-flame/30 bg-flame/10 text-flame' }
  if (r >= 0.9) return { label: 'ON TARGET', cls: 'border-brand-400/30 bg-brand-400/10 text-brand-400' }
  if (r > 0) return { label: 'IN PROGRESS', cls: 'border-pulse/25 bg-pulse/[0.07] text-pulse' }
  return { label: 'NOTHING LOGGED', cls: 'border-line bg-ink-800 text-slate-400' }
}

export function IntakePanel({ day, dateKey, dayLabel }: { day: DailyNutrition; dateKey: string | undefined; dayLabel: string }) {
  const t = day.targets
  const c = day.consumed
  if (!t) return null
  const status = calorieStatus(c.calories, t.calories)
  const left = t.calories - c.calories

  return (
    <Card brackets radius="xl" pad="lg">
      <PanelHeader
        kicker={`Daily intake // ${dayLabel}`}
        kickerDot="brand"
        title="Daily nutrition"
        right={<span className={clsx('rounded border px-2 py-1 font-mono text-[11px]', status.cls)}>{status.label}</span>}
      />
      <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-4">
          <Ring value={c.calories} max={t.calories} size={184} stroke={13} tone="brand">
            <span className="label-mono text-slate-500">Calories</span>
            <span className="mt-1 font-mono text-3xl font-bold leading-none text-white">{fmtInt(c.calories)}</span>
            <span className="mt-1 font-mono text-[11px] text-slate-400">/ {fmtInt(t.calories)} kcal</span>
            <span className={clsx('mt-2 font-mono text-[11px] font-semibold', left >= 0 ? 'text-brand-400' : 'text-flame')}>
              {left >= 0 ? `${fmtInt(left)} left` : `${fmtInt(-left)} over`}
            </span>
          </Ring>
          <div className="grid w-full grid-cols-3 gap-2 text-center font-mono">
            <MiniTile label="Target" value={fmtInt(t.calories)} />
            <MiniTile label="Eaten" value={fmtInt(c.calories)} tone="text-brand-400" />
            <MiniTile label="Meals" value={String(day.entries.length)} />
          </div>
        </div>

        <div className="space-y-5">
          {MACROS.map((m) => (
            <MacroRow key={m.key} label={m.label} unit={m.unit} tone={m.tone} value={c[m.key]} target={t[m.key]} />
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 border-t border-line pt-6 md:grid-cols-2">
        <WaterTracker consumed={c.water_ml} target={t.water_ml} dateKey={dateKey} />
        <MicroPanel consumed={c} targets={t} />
      </div>
    </Card>
  )
}

function MiniTile({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-line bg-ink-850 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={clsx('text-sm font-bold', tone)}>{value}</div>
    </div>
  )
}

function MacroRow({ label, unit, tone, value, target }: { label: string; unit: string; tone: Tone; value: number; target: number }) {
  const left = target - value
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-white">{label}</span>
        <span className="font-mono text-xs tabular-nums text-slate-300">
          <span className="text-base font-bold text-white">{fmtNum(value, 0)}</span> / {fmtInt(target)} {unit}
          <span className={clsx('ml-2 text-[11px]', left >= 0 ? 'text-slate-500' : 'text-flame')}>{left >= 0 ? `${fmtNum(left, 0)} ${unit} left` : `+${fmtNum(-left, 0)} ${unit}`}</span>
        </span>
      </div>
      <ProgressBar value={value} max={target} tone={tone} size="lg" label={`${label} consumed`} />
    </div>
  )
}

const GLASS_ML = 250

function WaterTracker({ consumed, target, dateKey }: { consumed: number; target: number; dateKey: string | undefined }) {
  const add = useAddWater(dateKey)
  const glasses = Math.min(16, Math.round(target / GLASS_ML))
  const filled = Math.floor(consumed / GLASS_ML)
  return (
    <div className="rounded-xl border border-line bg-ink-850/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <MonoLabel dot="iris">Hydration</MonoLabel>
        <span className="font-mono text-xs text-slate-300">
          <span className="text-base font-bold text-white">{(consumed / 1000).toFixed(2)}</span> / {(target / 1000).toFixed(2)} L
        </span>
      </div>
      <div className="mb-4 grid grid-cols-8 gap-1.5" aria-label={`${filled} of ${glasses} glasses`}>
        {Array.from({ length: glasses }, (_, i) => (
          <span
            key={i}
            className={clsx(
              'flex h-8 items-center justify-center rounded-md border transition-colors',
              i < filled ? 'border-iris-500/60 bg-iris-500/20 text-iris-300 shadow-[0_0_10px_-2px_rgba(90,107,255,0.6)]' : 'border-line bg-ink-950/60 text-slate-700',
            )}
          >
            <Icon name="droplet" size={14} />
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" icon="minus" aria-label="Remove a glass" disabled={consumed <= 0 || add.isPending} onClick={() => add.mutate(-GLASS_ML)}>
          <span className="sr-only">Remove 250 ml</span>
        </Button>
        <Button variant="iris" size="sm" icon="plus" className="flex-1" onClick={() => add.mutate(GLASS_ML)}>
          Glass · 250 ml
        </Button>
        <Button variant="secondary" size="sm" onClick={() => add.mutate(500)}>
          +500 ml
        </Button>
      </div>
      <p className="mt-2.5 font-mono text-[10px] text-slate-500">{consumed >= target ? 'Hydration target reached ✓' : `${Math.ceil((target - consumed) / GLASS_ML)} glasses to go`}</p>
    </div>
  )
}

function MicroPanel({ consumed, targets }: { consumed: DailyNutrients; targets: NutritionTargets }) {
  return (
    <div className="rounded-xl border border-line bg-ink-850/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <MonoLabel dot="volt">Micronutrients</MonoLabel>
        <span className="font-mono text-[10px] text-slate-500">ICMR-NIN RDA</span>
      </div>
      <div className="space-y-3.5">
        {MICROS.map((m) => (
          <div key={m.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-slate-200">
                {m.label} <span className="text-[10px] text-slate-500">· {m.why}</span>
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-300">
                {fmtNum(consumed[m.key], 1)} / {fmtNum(targets[m.key], 0)} {m.unit}
              </span>
            </div>
            <ProgressBar value={consumed[m.key]} max={targets[m.key]} tone="volt" size="sm" label={`${m.label} consumed`} />
          </div>
        ))}
      </div>
    </div>
  )
}
