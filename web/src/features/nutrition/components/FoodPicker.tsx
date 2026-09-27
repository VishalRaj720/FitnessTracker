import { useState } from 'react'
import { clsx } from 'clsx'
import { Alert, Badge, Button, DietMark, Field, Icon, Input, MonoLabel, Segmented, Sheet, Skeleton, Toggle } from '@/components/ui'
import { useFoods, useLogFood } from '@/features/nutrition/api'
import { MEALS, type PickerRequest } from '@/features/nutrition/meals'
import { errorMessage } from '@/lib/apiClient'
import { MEAL_LABEL, fmtNum, fmtServings } from '@/lib/format'
import type { Food, Meal } from '@/types/api'

/** Mounted per request (the parent keys it by `request.id`), so every open starts clean. */
export function FoodPicker({
  request,
  onClose,
  dateKey,
  dayLabel,
}: {
  request: PickerRequest
  onClose: () => void
  dateKey: string | undefined
  dayLabel: string
}) {
  const [meal, setMeal] = useState<Meal>(request.meal)
  const [tab, setTab] = useState<'catalog' | 'custom'>('catalog')
  const [q, setQ] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [picked, setPicked] = useState<Food | null>(request.food ?? null)
  const [servings, setServings] = useState(1)
  const [custom, setCustom] = useState({ name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '' })
  const foods = useFoods(q, !showAll)
  const log = useLogFood()

  const num = (s: string) => (s.trim() === '' ? 0 : Number(s))
  const customValid = custom.name.trim().length > 0 && custom.calories.trim() !== '' && [custom.calories, custom.protein_g, custom.carbs_g, custom.fat_g, custom.fiber_g].every((v) => v.trim() === '' || (Number.isFinite(Number(v)) && Number(v) >= 0))

  const submit = () => {
    const base = { meal, servings, date: dateKey ?? null }
    const body =
      tab === 'catalog'
        ? { ...base, food_id: picked!.id }
        : {
            ...base,
            custom: {
              name: custom.name.trim(),
              calories: num(custom.calories),
              protein_g: num(custom.protein_g),
              carbs_g: num(custom.carbs_g),
              fat_g: num(custom.fat_g),
              fiber_g: num(custom.fiber_g),
            },
          }
    log.mutate(body, { onSuccess: onClose })
  }

  const canSubmit = tab === 'catalog' ? !!picked : customValid

  return (
    <Sheet
      open
      onClose={onClose}
      wide
      kicker={`Log food // ${dayLabel}`}
      title={`Add to ${MEAL_LABEL[meal].toLowerCase()}`}
      footer={
        <div className="space-y-3">
          {log.isError && <Alert>{errorMessage(log.error)}</Alert>}
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" block icon="plus" disabled={!canSubmit} loading={log.isPending} onClick={submit}>
              {tab === 'catalog' && picked ? `Add ${fmtServings(servings)} × ${picked.name}` : `Add to ${MEAL_LABEL[meal]}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <Segmented<Meal> value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: MEAL_LABEL[m] }))} />
        <Segmented<'catalog' | 'custom'>
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'catalog', label: 'Food catalog' },
            { value: 'custom', label: 'Custom food' },
          ]}
        />

        {tab === 'catalog' ? (
          <>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input aria-label="Search foods" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dal, roti, eggs…" className="pl-10" />
              </div>
              <label className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                All
                <Toggle checked={showAll} onChange={setShowAll} label="Show foods outside my diet" />
              </label>
            </div>

            {picked && (
              <div className="rounded-xl border border-brand-400/30 bg-brand-400/[0.05] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <DietMark diet={picked.diet} /> <span className="truncate">{picked.name}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-400">per {picked.serving}</div>
                  </div>
                  <button type="button" onClick={() => setPicked(null)} className="text-xs text-slate-400 underline-offset-2 hover:text-white hover:underline">
                    Change
                  </button>
                </div>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" icon="minus" aria-label="Less" disabled={servings <= 0.5} onClick={() => setServings((s) => Math.max(0.5, s - 0.5))}>
                      <span className="sr-only">Less</span>
                    </Button>
                    <span className="w-16 text-center font-mono text-lg font-bold text-white">{fmtServings(servings)}×</span>
                    <Button variant="secondary" size="sm" icon="plus" aria-label="More" disabled={servings >= 10} onClick={() => setServings((s) => Math.min(10, s + 0.5))}>
                      <span className="sr-only">More</span>
                    </Button>
                  </div>
                  <div className="text-right font-mono text-xs text-slate-300">
                    <div className="text-lg font-bold text-white">{fmtNum(picked.nutrients.calories * servings, 0)} kcal</div>
                    P {fmtNum(picked.nutrients.protein_g * servings)} · C {fmtNum(picked.nutrients.carbs_g * servings)} · F {fmtNum(picked.nutrients.fat_g * servings)}
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <MonoLabel className="text-slate-500">{showAll ? 'All foods' : 'Foods for your diet'}</MonoLabel>
                <span className="font-mono text-[10px] text-slate-500">{foods.data?.length ?? 0} results · values per serving</span>
              </div>
              {foods.isPending ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : foods.isError ? (
                <Alert>{errorMessage(foods.error)}</Alert>
              ) : foods.data?.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line p-4 text-center text-xs text-slate-500">No match. Try another word, or add it as a custom food.</p>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                  {foods.data?.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPicked(f)
                          setServings(1)
                        }}
                        className={clsx('flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition', picked?.id === f.id ? 'bg-brand-400/[0.07]' : 'hover:bg-white/[0.03]')}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <DietMark diet={f.diet} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 truncate text-sm font-medium text-slate-100">
                              {f.name}
                              {f.tags.includes('limit') && (
                                <Badge tone="flame" mono size="sm">
                                  limit
                                </Badge>
                              )}
                            </div>
                            <div className="truncate font-mono text-[10px] text-slate-500">{f.serving}</div>
                          </div>
                        </div>
                        <div className="shrink-0 text-right font-mono text-[11px] text-slate-400">
                          <div className="text-xs font-semibold text-white">{fmtNum(f.nutrients.calories, 0)} kcal</div>P {fmtNum(f.nutrients.protein_g)}g
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <Field label="Food name">{(id) => <Input id={id} value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="e.g. Canteen veg sandwich" maxLength={80} />}</Field>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(
                [
                  ['calories', 'Calories · kcal'],
                  ['protein_g', 'Protein · g'],
                  ['carbs_g', 'Carbs · g'],
                  ['fat_g', 'Fat · g'],
                  ['fiber_g', 'Fibre · g'],
                ] as const
              ).map(([k, label]) => (
                <Field key={k} label={label}>
                  {(id) => <Input id={id} mono type="number" inputMode="decimal" min={0} value={custom[k]} onChange={(e) => setCustom({ ...custom, [k]: e.target.value })} placeholder="0" />}
                </Field>
              ))}
              <Field label="Servings">
                {(id) => <Input id={id} mono type="number" inputMode="decimal" min={0.5} max={10} step={0.5} value={servings} onChange={(e) => setServings(Math.min(10, Math.max(0.5, Number(e.target.value) || 1)))} />}
              </Field>
            </div>
            <p className="text-xs text-slate-500">Enter values for one serving. Use the label on the pack, or your best estimate.</p>
          </div>
        )}
      </div>
    </Sheet>
  )
}
