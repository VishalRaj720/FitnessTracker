import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, ButtonLink, Icon } from '@/components/ui'
import { useAuthStore } from '@/features/auth/authStore'
import { useMySquad, useProgress, useRegeneratePlan, useTodayPlan } from '@/features/home/api'
import { CampusBanner, FeatureStrip, FormTraceCard, FuelCard, SquadCard, ThisWeekCard, TodayPlanCard } from '@/features/home/widgets'
import { useLeaderboard } from '@/features/squad/api'
import { useNutritionDay } from '@/features/nutrition/api'
import { getDefinition } from '@/cv/exercises'
import { api } from '@/lib/apiClient'
import { firstName, greeting } from '@/lib/people'
import type { InstituteStats } from '@/types/api'

export function HomePage() {
  const nav = useNavigate()
  const user = useAuthStore((s) => s.user)
  const plan = useTodayPlan()
  const progress = useProgress()
  const squad = useMySquad()
  const board = useLeaderboard(squad.data?.id)
  const regen = useRegeneratePlan()
  const fuel = useNutritionDay()
  const campus = useQuery({
    queryKey: ['institute', user?.institute?.slug, 'stats'],
    queryFn: () => api<InstituteStats>(`/institutes/${user!.institute!.slug}/stats?weeks=8`, { auth: false }),
    enabled: !!user?.institute,
    staleTime: 60_000,
  })

  const offline = !!(plan.data as { __offline?: boolean } | undefined)?.__offline
  const done = plan.data?.status === 'completed'
  const now = new Date()
  const protocol = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`
  // "Calibrate camera" opens the guided camera tutorial for the first exercise that has one.
  const calibrateSlug = plan.data?.items.find((i) => i.exercise.cv_supported && getDefinition(i.exercise.slug)?.tutorial)?.exercise.slug

  const startWorkout = () => {
    if (!plan.data) return
    nav('/workout/preview', { state: { plan: plan.data, title: "Today's workout" } })
  }

  return (
    <div className="space-y-10">
      <section className="flex flex-col justify-between gap-6 border-b border-line pb-6 xl:flex-row xl:items-end" aria-labelledby="home-title">
        <div className="max-w-4xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded border border-white/10 bg-ink-900 px-2.5 py-1 font-mono text-[11px] tracking-wider text-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-pulse" />
            ATHLETE DISCIPLINE PROTOCOL // {protocol}
          </div>
          <h1 id="home-title" className="text-balance text-3xl font-extrabold leading-[1.12] tracking-tight text-white sm:text-4xl lg:text-5xl">
            {greeting()}, {firstName(user?.name)}.
            <br className="hidden sm:block" />{' '}
            <span className="text-slate-300">{done ? 'Today’s session is in the bank.' : 'Your command dashboard is ready.'}</span>
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
            FitSathi turns scattered daily routines, on-device camera form checks, fuel targets and verified minutes into one calm, low-noise cockpit.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3.5 sm:flex-row xl:flex-col xl:items-end">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="light" mono size="md" iconRight="arrow-right" onClick={startWorkout} disabled={!plan.data}>
              Start routine
            </Button>
            <ButtonLink variant="secondary" mono size="md" to={calibrateSlug ? `/exercises/${calibrateSlug}/tutorial` : '/exercises'}>
              Calibrate camera
            </ButtonLink>
          </div>
          <Link to="/progress" className="inline-flex items-center gap-1.5 pt-1 font-mono text-xs text-slate-400 transition-colors hover:text-pulse">
            Live telemetry layer: /progress <Icon name="arrow-right" size={12} className="text-pulse" />
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <TodayPlanCard
            plan={plan.data}
            pending={plan.isPending}
            error={plan.error}
            offline={offline}
            profile={user?.profile}
            onStart={startWorkout}
            onRegenerate={() => regen.mutate()}
            regenerating={regen.isPending}
            onRetry={() => void plan.refetch()}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/5 bg-ink-900/60 p-4 font-mono text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-pulse" />
              POSE ENGINE: MediaPipe Pose Landmarker · on-device inference
            </span>
            <span className="text-white/40">ZERO-CLOUD VIDEO PRIVACY</span>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <FormTraceCard progress={progress.data} pending={progress.isPending} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ThisWeekCard progress={progress.data} targetDays={user?.profile?.days_per_week ?? 4} />
            <SquadCard squad={squad.data} board={board.data} />
          </div>
          <FuelCard day={fuel.data} pending={fuel.isPending} />
          {user && <CampusBanner user={user} activeStudents={campus.data?.this_week.active_students} />}
        </div>
      </div>

      <FeatureStrip />
    </div>
  )
}
