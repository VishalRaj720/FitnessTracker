import { useRef, useState } from 'react'
import { Alert, Button, Card, Icon, PageHeader, Sheet, Skeleton } from '@/components/ui'
import { useAuthStore } from '@/features/auth/authStore'
import { isProfileMissing, useNutritionDay, useNutritionPlan, useNutritionProfile } from '@/features/nutrition/api'
import { FoodPicker } from '@/features/nutrition/components/FoodPicker'
import { HistoryCard } from '@/features/nutrition/components/HistoryCard'
import { IntakePanel } from '@/features/nutrition/components/IntakePanel'
import { MealLog } from '@/features/nutrition/components/MealLog'
import { CategoryCard, FoodGroups, GuidanceGrid, LimitList, MealSuggestions, StrategyCard } from '@/features/nutrition/components/PlanSections'
import { ProfileForm } from '@/features/nutrition/components/ProfileForm'
import { mealForNow, type PickerRequest } from '@/features/nutrition/meals'
import { errorMessage } from '@/lib/apiClient'
import { GOAL_LABEL, fmtIsoDay, shiftIsoDate } from '@/lib/format'
import type { Food, Meal } from '@/types/api'

/** The server accepts logs for the last 60 days (nutrition_service.MAX_BACKFILL_DAYS). */
const MAX_BACK_DAYS = 60

/**
 * Diet & Nutrition. The person's category (onboarding goal + level) plus their body metrics
 * and diet type drive every target here; the server computes them, this page only shows them.
 */
export function NutritionPage() {
  const user = useAuthStore((s) => s.user)
  const profile = useNutritionProfile()
  const hasProfile = !!profile.data
  const plan = useNutritionPlan(hasProfile)
  // `undefined` = today on the server's (IST) calendar; otherwise an ISO date we navigated to.
  const [date, setDate] = useState<string | undefined>(undefined)
  const todayQ = useNutritionDay()
  const day = useNutritionDay(date)
  const serverToday = todayQ.data?.date
  const [picker, setPicker] = useState<PickerRequest | null>(null)
  const [recalibrate, setRecalibrate] = useState(false)
  const openId = useRef(0)

  const openPicker = (meal: Meal, food?: Food) => {
    openId.current += 1
    setPicker({ id: openId.current, meal, food })
  }

  const today = !date
  const shownDate = day.data?.date
  const dayLabel = today ? 'Today' : shownDate ? fmtIsoDay(shownDate) : '…'

  const header = (
    <PageHeader
      size="lg"
      badge={plan.data ? `Fuel protocol // ${plan.data.category.label}` : 'Fuel protocol // category-based'}
      badgeTone="brand"
      title="Diet & Nutrition"
      subtitle={
        user?.profile
          ? `Targets built from your ${GOAL_LABEL[user.profile.goal].toLowerCase()} goal, your level and your body metrics — recalculated whenever any of them change.`
          : 'Targets built from your goal, level and body metrics.'
      }
      right={
        hasProfile && (
          <>
            <div className="flex items-center rounded-lg border border-line bg-ink-900">
              <button
                type="button"
                aria-label="Previous day"
                disabled={!shownDate || !serverToday || shownDate <= shiftIsoDate(serverToday, -MAX_BACK_DAYS)}
                onClick={() => shownDate && setDate(shiftIsoDate(shownDate, -1))}
                className="rounded-l-lg p-2.5 text-slate-400 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
              >
                <Icon name="chevron-left" />
              </button>
              <span className="min-w-[110px] px-2 text-center font-mono text-xs uppercase tracking-wider text-white">{dayLabel}</span>
              <button
                type="button"
                aria-label="Next day"
                disabled={today}
                onClick={() => {
                  if (!shownDate) return
                  const next = shiftIsoDate(shownDate, 1)
                  // Stepping onto today returns to the live "today" query.
                  setDate(serverToday && next >= serverToday ? undefined : next)
                }}
                className="rounded-r-lg p-2.5 text-slate-400 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
              >
                <Icon name="chevron-right" />
              </button>
            </div>
            {!today && (
              <Button variant="ghost" size="sm" onClick={() => setDate(undefined)}>
                Today
              </Button>
            )}
            <Button variant="secondary" size="md" icon="settings" onClick={() => setRecalibrate(true)}>
              Update metrics
            </Button>
          </>
        )
      }
    />
  )

  if (profile.isPending) {
    return (
      <div className="space-y-8">
        {header}
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-[420px] lg:col-span-8" />
          <Skeleton className="h-[420px] lg:col-span-4" />
        </div>
      </div>
    )
  }

  if (profile.isError) {
    return (
      <div className="space-y-8">
        {header}
        <Alert title="Couldn't load your nutrition profile">{errorMessage(profile.error)}</Alert>
      </div>
    )
  }

  if (!hasProfile) {
    return (
      <div className="space-y-8">
        {header}
        <Card radius="xl" pad="md" accent="iris">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-iris-500/30 bg-iris-500/10 text-iris-300">
              <Icon name="target" size={18} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">Calibrate your nutrition engine</h2>
              <p className="text-sm text-slate-400">
                Your category ({user?.profile ? GOAL_LABEL[user.profile.goal] : 'goal'}) is already set from onboarding. Add a few body metrics and your diet type to get daily targets, meal ideas and an intake log.
              </p>
            </div>
          </div>
        </Card>
        <ProfileForm initial={null} fitness={user?.profile} />
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {header}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          {day.isPending ? (
            <Skeleton className="h-[460px] w-full rounded-xl" />
          ) : day.isError ? (
            <Alert title="Couldn't load this day">{errorMessage(day.error)}</Alert>
          ) : (
            day.data && (
              <>
                <IntakePanel day={day.data} dateKey={date} dayLabel={dayLabel} />
                <MealLog day={day.data} onAdd={(meal) => openPicker(meal)} />
              </>
            )
          )}
        </div>
        <div className="space-y-6 lg:col-span-4">
          {plan.isPending ? (
            <Skeleton className="h-96 w-full rounded-xl" />
          ) : plan.isError ? (
            <Alert title="Couldn't build your plan">{isProfileMissing(plan.error) ? 'Add your body metrics first.' : errorMessage(plan.error)}</Alert>
          ) : (
            plan.data && (
              <>
                <CategoryCard plan={plan.data} onRecalibrate={() => setRecalibrate(true)} />
                <StrategyCard plan={plan.data} />
              </>
            )
          )}
          <HistoryCard />
        </div>
      </div>

      {plan.data && (
        <>
          <MealSuggestions plan={plan.data} dateKey={date} />
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <FoodGroups plan={plan.data} onQuickAdd={(food) => openPicker(mealForNow(), food)} />
            </div>
            <div className="lg:col-span-4">
              <LimitList plan={plan.data} />
            </div>
          </div>
          <GuidanceGrid plan={plan.data} />
        </>
      )}

      {picker && <FoodPicker key={picker.id} request={picker} onClose={() => setPicker(null)} dateKey={date} dayLabel={dayLabel} />}

      <Sheet open={recalibrate} onClose={() => setRecalibrate(false)} kicker="Nutrition profile" title="Update your metrics" wide>
        <ProfileForm initial={profile.data} fitness={user?.profile} layout="sheet" onSaved={() => setRecalibrate(false)} />
      </Sheet>
    </div>
  )
}
