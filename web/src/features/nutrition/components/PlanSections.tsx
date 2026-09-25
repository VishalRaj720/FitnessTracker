import { useState } from 'react'
import { clsx } from 'clsx'
import { Badge, Button, Card, DietMark, Icon, MonoLabel, PanelHeader, type IconName } from '@/components/ui'
import { MacroSplit } from '@/features/nutrition/components/ProfileForm'
import { useLogMeal } from '@/features/nutrition/api'
import { MEALS } from '@/features/nutrition/meals'
import { ACTIVITY_LABEL, MEAL_LABEL, fmtInt, fmtNum, fmtServings } from '@/lib/format'
import type { Food, MealSuggestion, NutritionPlan } from '@/types/api'

// ---------------------------------------------------------------------------------------------
// Category → targets

export function CategoryCard({ plan, onRecalibrate }: { plan: NutritionPlan; onRecalibrate: () => void }) {
  const { category: c, targets: t, profile: p } = plan
  const steps = [
    { k: 'Resting (BMR)', v: `${fmtInt(t.bmr)} kcal`, hint: 'Mifflin-St Jeor' },
    { k: 'Maintenance (TDEE)', v: `${fmtInt(t.tdee)} kcal`, hint: ACTIVITY_LABEL[c.activity_level]?.label ?? c.activity_level },
    { k: `${c.goal_label} adjustment`, v: `${t.adjustment_pct > 0 ? '+' : ''}${t.adjustment_pct}%`, hint: 'From your onboarding goal' },
  ]
  return (
    <Card radius="xl" pad="md">
      <PanelHeader
        kicker="Your category"
        kickerDot="iris"
        title={c.label}
        right={
          <Button variant="ghost" size="xs" icon="settings" onClick={onRecalibrate}>
            Recalibrate
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-3 gap-2 text-center font-mono">
        <Metric label="Weight" value={`${fmtNum(p.weight_kg)} kg`} />
        <Metric label="Height" value={`${fmtNum(p.height_cm, 0)} cm`} />
        <Metric label="BMI" value={fmtNum(p.bmi)} />
      </div>
      <ol className="mb-4 space-y-2">
        {steps.map((s, i) => (
          <li key={s.k} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-ink-850/70 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="font-mono text-[10px] text-slate-500">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-slate-200">{s.k}</div>
                <div className="truncate font-mono text-[10px] text-slate-500">{s.hint}</div>
              </div>
            </div>
            <span className="shrink-0 font-mono text-xs font-semibold text-white">{s.v}</span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 rounded-lg border border-brand-400/30 bg-brand-400/[0.06] px-3 py-2.5">
          <span className="text-xs font-semibold text-white">Daily target</span>
          <span className="font-mono text-base font-bold text-brand-400">{fmtInt(t.calories)} kcal</span>
        </li>
      </ol>
      <MacroSplit targets={t} />
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-ink-950/50 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-xs font-bold text-white">{value}</div>
    </div>
  )
}

export function StrategyCard({ plan }: { plan: NutritionPlan }) {
  return (
    <Card radius="xl" pad="md" className="overflow-hidden">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-400/[0.06] blur-3xl" />
      <MonoLabel dot="brand">Recommended diet</MonoLabel>
      <h3 className="mt-2 text-lg font-bold tracking-tight text-white">{plan.strategy.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{plan.strategy.summary}</p>
      <ul className="mt-4 space-y-2">
        {plan.strategy.principles.map((pr) => (
          <li key={pr} className="flex gap-2.5 text-sm text-slate-300">
            <Icon name="check" size={15} className="mt-0.5 shrink-0 text-brand-400" />
            {pr}
          </li>
        ))}
      </ul>
    </Card>
  )
}

// ---------------------------------------------------------------------------------------------
// Meal suggestions

export function MealSuggestions({ plan, dateKey }: { plan: NutritionPlan; dateKey: string | undefined }) {
  const logMeal = useLogMeal()
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [logged, setLogged] = useState<string | null>(null)

  const log = (m: MealSuggestion) => {
    setPendingKey(m.key)
    logMeal.mutate(
      { meal: m.meal, date: dateKey ?? null, items: m.items.map((i) => ({ food_id: i.food.id, servings: i.servings })) },
      {
        onSuccess: () => {
          setLogged(m.key)
          window.setTimeout(() => setLogged((k) => (k === m.key ? null : k)), 2200)
        },
        onSettled: () => setPendingKey(null),
      },
    )
  }

  return (
    <section aria-labelledby="meal-suggestions" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <MonoLabel dot="volt">Meal suggestions // portioned to your budget</MonoLabel>
          <h2 id="meal-suggestions" className="mt-1 text-xl font-bold tracking-tight text-white">
            What to eat today
          </h2>
        </div>
        <span className="font-mono text-[11px] text-slate-500">Hostel-mess friendly · {plan.category.diet_label}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {MEALS.map((meal) => {
          const options = plan.meals.filter((m) => m.meal === meal)
          return (
            <div key={meal} className="space-y-3">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-sm font-semibold text-white">{MEAL_LABEL[meal]}</span>
                <span className="font-mono text-[10px] text-slate-500">~{fmtInt(plan.targets.meal_calories[meal])} kcal</span>
              </div>
              {options.map((m, i) => (
                <article key={m.key} className={clsx('rounded-xl border bg-ink-900/85 p-4 shadow-card', i === 0 ? 'border-line-strong' : 'border-line')}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-snug text-slate-100">{m.title}</h3>
                    {i === 0 && (
                      <Badge tone="volt" mono className="shrink-0">
                        Best fit
                      </Badge>
                    )}
                  </div>
                  <ul className="mb-3 space-y-1">
                    {m.items.map((it) => (
                      <li key={it.food.id} className="flex items-center gap-2 text-xs text-slate-400">
                        <DietMark diet={it.food.diet} size="sm" />
                        <span className="font-mono text-slate-300">{fmtServings(it.servings)}×</span>
                        <span className="truncate">{it.food.name}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mb-3 flex items-baseline justify-between border-t border-line pt-2.5 font-mono text-[11px] text-slate-400">
                    <span className="text-sm font-bold text-white">{fmtInt(m.nutrients.calories)} kcal</span>
                    <span>
                      P {fmtNum(m.nutrients.protein_g, 0)} · C {fmtNum(m.nutrients.carbs_g, 0)} · F {fmtNum(m.nutrients.fat_g, 0)}
                    </span>
                  </div>
                  <Button
                    variant={logged === m.key ? 'primary' : 'secondary'}
                    size="sm"
                    block
                    icon={logged === m.key ? 'check' : 'plus'}
                    loading={pendingKey === m.key}
                    onClick={() => log(m)}
                  >
                    {logged === m.key ? 'Logged' : 'Log this meal'}
                  </Button>
                </article>
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------
// Foods

const GROUP_STYLE: Record<string, { icon: IconName; tone: string }> = {
  protein: { icon: 'dumbbell', tone: 'text-pulse border-pulse/25 bg-pulse/[0.07]' },
  carbs: { icon: 'bolt', tone: 'text-volt border-volt/25 bg-volt/[0.07]' },
  fats: { icon: 'droplet', tone: 'text-flame border-flame/25 bg-flame/[0.07]' },
  produce: { icon: 'leaf', tone: 'text-brand-400 border-brand-400/25 bg-brand-400/[0.07]' },
}

export function FoodGroups({ plan, onQuickAdd }: { plan: NutritionPlan; onQuickAdd: (food: Food) => void }) {
  return (
    <Card radius="xl" pad="lg">
      <PanelHeader kicker="Recommended foods" kickerDot="pulse" title={`Best picks for ${plan.category.goal_label.toLowerCase()}`} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {plan.food_groups.map((g) => {
          const st = GROUP_STYLE[g.key] ?? GROUP_STYLE.protein
          return (
            <div key={g.key}>
              <div className="mb-3 flex items-center gap-2.5">
                <span className={clsx('flex h-7 w-7 items-center justify-center rounded-lg border', st.tone)}>
                  <Icon name={st.icon} size={14} />
                </span>
                <h3 className="text-sm font-semibold text-white">{g.title}</h3>
              </div>
              <ul className="space-y-1.5">
                {g.items.map((p) => (
                  <li key={p.food.id} className="group flex items-center justify-between gap-2 rounded-lg border border-transparent px-2 py-1.5 transition hover:border-line hover:bg-ink-850/70">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <DietMark diet={p.food.diet} />
                      <div className="min-w-0">
                        <div className="truncate text-sm text-slate-100">{p.food.name}</div>
                        <div className="truncate font-mono text-[10px] text-slate-500">
                          {p.reason} · {p.food.serving}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`Log ${p.food.name}`}
                      onClick={() => onQuickAdd(p.food)}
                      className="shrink-0 rounded-md border border-line p-1.5 text-slate-400 transition hover:border-pulse/40 hover:text-pulse"
                    >
                      <Icon name="plus" size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export function LimitList({ plan }: { plan: NutritionPlan }) {
  return (
    <Card radius="xl" pad="md">
      <PanelHeader kicker="Foods to limit" kickerDot="flame" title="Keep these occasional" />
      <ul className="space-y-2">
        {plan.limit.map((l) => (
          <li key={l.food.id} className="flex items-start gap-3 rounded-lg border border-flame/15 bg-flame/[0.04] p-3">
            <Icon name="alert" size={15} className="mt-0.5 shrink-0 text-flame" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-100">{l.food.name}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-slate-400">{l.reason}</div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">Nothing here is banned — it just costs a lot of your budget for little protein or fibre.</p>
    </Card>
  )
}

const TONE_STYLE: Record<string, { icon: IconName; cls: string }> = {
  tip: { icon: 'sparkles', cls: 'text-brand-400 border-brand-400/25 bg-brand-400/[0.07]' },
  info: { icon: 'info', cls: 'text-pulse border-pulse/25 bg-pulse/[0.07]' },
  warn: { icon: 'alert', cls: 'text-flame border-flame/25 bg-flame/[0.07]' },
}

export function GuidanceGrid({ plan }: { plan: NutritionPlan }) {
  return (
    <section aria-labelledby="guidance" className="space-y-4">
      <div>
        <MonoLabel dot="iris">Nutrition guidance // for your category</MonoLabel>
        <h2 id="guidance" className="mt-1 text-xl font-bold tracking-tight text-white">
          How to make it work
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {plan.guidance.map((g) => {
          const st = TONE_STYLE[g.tone] ?? TONE_STYLE.info
          return (
            <article key={g.code} className="flex gap-3.5 rounded-xl border border-line bg-ink-900/80 p-4">
              <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', st.cls)}>
                <Icon name={st.icon} size={15} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white">{g.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{g.body}</p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
