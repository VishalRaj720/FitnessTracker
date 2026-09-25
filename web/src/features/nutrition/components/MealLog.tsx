import { clsx } from 'clsx'
import { Button, Card, Icon, PanelHeader } from '@/components/ui'
import { useDeleteLog } from '@/features/nutrition/api'
import { MEALS, mealForNow } from '@/features/nutrition/meals'
import { MEAL_LABEL, fmtInt, fmtNum, fmtServings } from '@/lib/format'
import type { DailyNutrition, Meal } from '@/types/api'

const MEAL_ICON_TONE: Record<Meal, string> = {
  breakfast: 'bg-flame',
  lunch: 'bg-brand-400',
  snack: 'bg-volt',
  dinner: 'bg-iris-500',
}

export function MealLog({ day, onAdd }: { day: DailyNutrition; onAdd: (meal: Meal) => void }) {
  const del = useDeleteLog()
  const budgets = day.targets?.meal_calories

  return (
    <Card radius="xl" pad="lg">
      <PanelHeader
        kicker={`Meal log // ${day.entries.length} entr${day.entries.length === 1 ? 'y' : 'ies'}`}
        title="What you ate"
        right={
          <span className="hidden sm:block">
            <Button variant="primary" size="sm" icon="plus" onClick={() => onAdd(mealForNow())}>
              Add food
            </Button>
          </span>
        }
      />
      <div className="space-y-5">
        {MEALS.map((meal) => {
          const entries = day.entries.filter((e) => e.meal === meal)
          const kcal = entries.reduce((s, e) => s + e.nutrients.calories, 0)
          const budget = budgets?.[meal]
          return (
            <section key={meal} aria-label={MEAL_LABEL[meal]}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={clsx('h-2 w-2 rounded-full', MEAL_ICON_TONE[meal])} />
                  <h3 className="text-sm font-semibold text-white">{MEAL_LABEL[meal]}</h3>
                  <span className="font-mono text-[11px] text-slate-500">
                    {fmtInt(kcal)}
                    {budget ? ` / ~${fmtInt(budget)}` : ''} kcal
                  </span>
                </div>
                <button type="button" onClick={() => onAdd(meal)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] text-pulse transition hover:bg-pulse/10">
                  <Icon name="plus" size={12} /> Add
                </button>
              </div>
              {entries.length === 0 ? (
                <button
                  type="button"
                  onClick={() => onAdd(meal)}
                  className="w-full rounded-lg border border-dashed border-line px-4 py-3 text-left text-xs text-slate-500 transition hover:border-line-strong hover:text-slate-300"
                >
                  Nothing logged for {MEAL_LABEL[meal].toLowerCase()} yet.
                </button>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-ink-850/60">
                  {entries.map((e) => (
                    <li key={e.id} className="group flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-100">{e.name}</div>
                        <div className="truncate font-mono text-[10.5px] text-slate-500">
                          {fmtServings(e.servings)} × {e.serving ?? 'serving'} · P {fmtNum(e.nutrients.protein_g)} · C {fmtNum(e.nutrients.carbs_g)} · F {fmtNum(e.nutrients.fat_g)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-sm font-semibold tabular-nums text-white">{fmtInt(e.nutrients.calories)}</span>
                        <span className="font-mono text-[10px] text-slate-500">kcal</span>
                        <button
                          type="button"
                          aria-label={`Remove ${e.name}`}
                          disabled={del.isPending && del.variables === e.id}
                          onClick={() => del.mutate(e.id)}
                          className="rounded-md p-1.5 text-slate-600 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
      <div className="mt-6 sm:hidden">
        <Button variant="primary" size="md" block icon="plus" onClick={() => onAdd(mealForNow())}>
          Add food
        </Button>
      </div>
    </Card>
  )
}
