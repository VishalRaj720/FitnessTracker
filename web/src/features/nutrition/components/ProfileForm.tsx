import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { Alert, Button, DietMark, Field, Icon, Input, MonoLabel, Segmented, Spinner } from '@/components/ui'
import { useNutritionPreview, useSaveNutritionProfile } from '@/features/nutrition/api'
import { errorMessage } from '@/lib/apiClient'
import { ACTIVITY_LABEL, DIET_LABEL, GOAL_LABEL, LEVEL_LABEL, fmtInt } from '@/lib/format'
import type { ActivityLevel, DietType, NutritionProfile, NutritionProfileIn, NutritionTargets, Profile, Sex } from '@/types/api'

const ACTIVITIES: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active']
const DIETS: DietType[] = ['veg', 'egg', 'non_veg', 'vegan']

interface Draft {
  sex: Sex | null
  age: string
  height_cm: string
  weight_kg: string
  activity_level: ActivityLevel
  diet_type: DietType | null
}

function toDraft(p: NutritionProfile | null | undefined, fitness: Profile | null | undefined): Draft {
  if (p) {
    return {
      sex: p.sex,
      age: String(p.age),
      height_cm: String(p.height_cm),
      weight_kg: String(p.weight_kg),
      activity_level: p.activity_level,
      diet_type: p.diet_type,
    }
  }
  // Activity starts from the training frequency they already told us about.
  const days = fitness?.days_per_week ?? 4
  return { sex: null, age: '', height_cm: '', weight_kg: '', activity_level: days >= 5 ? 'moderate' : 'light', diet_type: null }
}

/** Parse the draft into an API body, or `null` while anything is missing or out of range. */
function toBody(d: Draft): NutritionProfileIn | null {
  const age = Number(d.age)
  const h = Number(d.height_cm)
  const w = Number(d.weight_kg)
  if (!d.sex || !d.diet_type) return null
  if (!Number.isFinite(age) || age < 14 || age > 80) return null
  if (!Number.isFinite(h) || h < 120 || h > 230) return null
  if (!Number.isFinite(w) || w < 30 || w > 250) return null
  return { sex: d.sex, age: Math.round(age), height_cm: h, weight_kg: w, activity_level: d.activity_level, diet_type: d.diet_type }
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return v
}

/**
 * Body metrics + diet type. Used full-page the first time (with the engine preview beside it)
 * and inside a sheet when recalibrating.
 */
export function ProfileForm({
  initial,
  fitness,
  onSaved,
  layout = 'page',
}: {
  initial: NutritionProfile | null | undefined
  fitness: Profile | null | undefined
  onSaved?: () => void
  layout?: 'page' | 'sheet'
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial, fitness))
  const save = useSaveNutritionProfile()
  const body = useMemo(() => toBody(draft), [draft])
  const settled = useDebounced(body, 350)
  const preview = useNutritionPreview(settled)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const submit = () => {
    if (body) save.mutate(body, { onSuccess: () => onSaved?.() })
  }

  const form = (
    <div className="space-y-6">
      <Field label="Sex" info="Used only for the resting-energy equation and the iron / vitamin C recommendations.">
        {() => (
          <Segmented<Sex>
            value={draft.sex ?? ('' as Sex)}
            onChange={(v) => set('sex', v)}
            options={[
              { value: 'female', label: 'Female' },
              { value: 'male', label: 'Male' },
              { value: 'other', label: 'Other / prefer not' },
            ]}
          />
        )}
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Age">{(id) => <Input id={id} accent="iris" mono type="number" inputMode="numeric" min={14} max={80} placeholder="20" value={draft.age} onChange={(e) => set('age', e.target.value)} />}</Field>
        <Field label="Height · cm">
          {(id) => <Input id={id} accent="iris" mono type="number" inputMode="decimal" min={120} max={230} placeholder="165" value={draft.height_cm} onChange={(e) => set('height_cm', e.target.value)} />}
        </Field>
        <Field label="Weight · kg">
          {(id) => <Input id={id} accent="iris" mono type="number" inputMode="decimal" min={30} max={250} step="0.1" placeholder="60" value={draft.weight_kg} onChange={(e) => set('weight_kg', e.target.value)} />}
        </Field>
      </div>

      <div className="space-y-2">
        <MonoLabel className="text-slate-300">Diet type</MonoLabel>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {DIETS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={draft.diet_type === d}
              onClick={() => set('diet_type', d)}
              className={clsx(
                'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition',
                draft.diet_type === d ? 'border-iris-500 bg-iris-500/15 text-white shadow-[0_0_16px_-2px_rgba(90,107,255,0.45)]' : 'border-line bg-ink-750/60 text-slate-300 hover:border-line-strong hover:text-white',
              )}
            >
              <DietMark diet={d} /> {DIET_LABEL[d]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <MonoLabel className="text-slate-300">Daily activity outside workouts</MonoLabel>
        <div role="radiogroup" aria-label="Daily activity" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ACTIVITIES.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={draft.activity_level === a}
              aria-label={`${ACTIVITY_LABEL[a].label}: ${ACTIVITY_LABEL[a].hint}`}
              onClick={() => set('activity_level', a)}
              className={clsx(
                'flex items-start justify-between gap-3 rounded-lg border p-3 text-left transition',
                draft.activity_level === a ? 'border-iris-500 bg-iris-500/[0.08]' : 'border-line bg-white/[0.02] hover:border-white/20',
                a === 'very_active' && 'sm:col-span-2',
              )}
            >
              <div>
                <div className={clsx('text-sm font-semibold', draft.activity_level === a ? 'text-white' : 'text-slate-200')}>{ACTIVITY_LABEL[a].label}</div>
                <div className="mt-0.5 text-xs text-slate-400">{ACTIVITY_LABEL[a].hint}</div>
              </div>
              <span className={clsx('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full', draft.activity_level === a ? 'border-2 border-iris-500' : 'border border-white/30')}>
                {draft.activity_level === a && <span className="h-2 w-2 rounded-full bg-iris-500" />}
              </span>
            </button>
          ))}
        </div>
      </div>

      {save.isError && <Alert>{errorMessage(save.error)}</Alert>}
    </div>
  )

  const submitButton = (
    <Button variant="iris" size="lg" iconRight="arrow-right" disabled={!body} loading={save.isPending} onClick={submit} className="w-full sm:w-auto">
      {initial ? 'Save & recalculate' : 'Calculate my targets'}
    </Button>
  )

  if (layout === 'sheet') {
    return (
      <div className="space-y-6">
        {form}
        <PreviewStrip targets={preview.data} pending={!!body && preview.isFetching} />
        <div className="flex justify-end">{submitButton}</div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
      <section className="overflow-hidden rounded-xl border border-white/10 bg-ink-900/90 shadow-[0_8px_32px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.05)] lg:col-span-7">
        <div className="flex items-center justify-between border-b border-line bg-ink-850/60 px-5 py-3 font-mono text-[11px] text-slate-400">
          <span className="font-medium tracking-wider text-slate-300">CORE.NUTRITION_PROFILE</span>
          <span className={body ? 'text-iris-400' : 'text-slate-500'}>{body ? 'READY' : 'AWAITING INPUT'}</span>
        </div>
        <div className="p-6 sm:p-8">{form}</div>
        <div className="flex flex-col-reverse items-center justify-between gap-3 border-t border-line bg-ink-850/80 px-6 py-5 sm:flex-row sm:px-8">
          <p className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
            <Icon name="lock" size={13} /> Stored with your account, never shared.
          </p>
          {submitButton}
        </div>
      </section>
      <EnginePreview targets={body ? preview.data : undefined} pending={!!body && preview.isFetching} fitness={fitness} />
    </div>
  )
}

function EnginePreview({ targets, pending, fitness }: { targets: NutritionTargets | undefined; pending: boolean; fitness: Profile | null | undefined }) {
  return (
    <aside className="rounded-2xl border border-line bg-ink-850/90 p-6 backdrop-blur-md lg:sticky lg:top-24 lg:col-span-5">
      <div className="mb-5 flex items-center justify-between border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Nutrition engine preview</span>
        </div>
        {pending ? <Spinner className="h-3.5 w-3.5 text-slate-500" /> : <span className="font-mono text-[11px] text-slate-500">live</span>}
      </div>
      {fitness && (
        <div className="mb-5 rounded-xl border border-iris-500/25 bg-iris-500/[0.06] p-3.5">
          <MonoLabel tone="iris">Your category</MonoLabel>
          <div className="mt-1 text-sm font-semibold text-white">
            {GOAL_LABEL[fitness.goal]} · {LEVEL_LABEL[fitness.level]}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {fitness.goal === 'fat_loss'
              ? 'Fat loss sets a ~20% deficit with high protein to protect muscle.'
              : fitness.goal === 'strength'
                ? 'Strength adds a ~10% surplus and more protein per kg.'
                : 'Your goal keeps you at maintenance, with protein scaled to your level.'}
          </p>
        </div>
      )}
      {targets ? (
        <>
          <div className="mb-5 grid grid-cols-3 gap-3">
            <MiniStat label="Resting" value={fmtInt(targets.bmr)} unit="kcal" hint="BMR" />
            <MiniStat label="Maintenance" value={fmtInt(targets.tdee)} unit="kcal" hint="TDEE" />
            <MiniStat label="Target" value={fmtInt(targets.calories)} unit="kcal" hint={`${targets.adjustment_pct > 0 ? '+' : ''}${targets.adjustment_pct}% vs TDEE`} tone="text-brand-400" />
          </div>
          <MacroSplit targets={targets} />
          <div className="mt-5 grid grid-cols-2 gap-3 font-mono text-[11px]">
            <div className="rounded-lg border border-line bg-ink-950/60 p-2.5 text-slate-400">
              FIBRE <span className="float-right text-white">{targets.fiber_g} g</span>
            </div>
            <div className="rounded-lg border border-line bg-ink-950/60 p-2.5 text-slate-400">
              WATER <span className="float-right text-white">{(targets.water_ml / 1000).toFixed(2)} L</span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line text-center">
          <Icon name="activity" size={22} className="text-slate-600" />
          <p className="max-w-[16rem] text-xs leading-relaxed text-slate-500">Fill in your sex, age, height, weight and diet to see your daily targets update live.</p>
        </div>
      )}
    </aside>
  )
}

function MiniStat({ label, value, unit, hint, tone = 'text-white' }: { label: string; value: string; unit: string; hint: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-ink-800/70 p-3">
      <div className="text-[11px] font-medium text-slate-400">{label}</div>
      <div className={clsx('mt-1 font-mono text-lg font-bold', tone)}>
        {value} <span className="font-sans text-[10px] font-normal text-slate-400">{unit}</span>
      </div>
      <div className="mt-0.5 font-mono text-[10px] text-slate-500">{hint}</div>
    </div>
  )
}

/** Stacked protein / carbs / fat bar with gram targets underneath. */
export function MacroSplit({ targets }: { targets: NutritionTargets }) {
  const parts = [
    { key: 'Protein', pct: targets.protein_pct, g: targets.protein_g, bar: 'bg-pulse', text: 'text-pulse' },
    { key: 'Carbs', pct: targets.carbs_pct, g: targets.carbs_g, bar: 'bg-volt', text: 'text-volt' },
    { key: 'Fat', pct: targets.fat_pct, g: targets.fat_g, bar: 'bg-flame', text: 'text-flame' },
  ]
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <MonoLabel className="text-slate-500">Macro split</MonoLabel>
        <span className="font-mono text-[10px] text-slate-500">of {fmtInt(targets.calories)} kcal</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-line bg-ink-950">
        {parts.map((p) => (
          <div key={p.key} className={clsx('h-full', p.bar)} style={{ width: `${p.pct}%` }} title={`${p.key} ${p.pct}%`} />
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 font-mono text-[11px]">
        {parts.map((p) => (
          <div key={p.key}>
            <div className={clsx('font-semibold', p.text)}>
              {p.pct}% <span className="text-slate-500">{p.key}</span>
            </div>
            <div className="text-white">{p.g} g</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PreviewStrip({ targets, pending }: { targets: NutritionTargets | undefined; pending: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-ink-850 p-4">
      <div className="mb-3 flex items-center justify-between">
        <MonoLabel dot="pulse">New targets</MonoLabel>
        {pending && <Spinner className="h-3.5 w-3.5 text-slate-500" />}
      </div>
      {targets ? (
        <>
          <div className="mb-3 font-mono text-2xl font-bold text-white">
            {fmtInt(targets.calories)} <span className="font-sans text-xs font-normal text-slate-400">kcal / day</span>
          </div>
          <MacroSplit targets={targets} />
        </>
      ) : (
        <p className="text-xs text-slate-500">Complete every field to preview your targets.</p>
      )}
    </div>
  )
}
