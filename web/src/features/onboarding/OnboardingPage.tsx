import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Alert, Badge, Button, Chip, Field, Icon, Input, MonoLabel, RadioCard, SegmentBar, Spinner, StatusPill } from '@/components/ui'
import { Backdrop } from '@/components/layout/Backdrop'
import { FlowFooter, FlowHeader } from '@/components/layout/FlowHeader'
import { api, errorMessage } from '@/lib/apiClient'
import { GOAL_LABEL, LEVEL_LABEL } from '@/lib/format'
import { firstName } from '@/lib/people'
import { areaPath, smoothPath, toPoints } from '@/lib/svgPath'
import { useAuthStore } from '@/features/auth/authStore'
import type { Goal, InstituteBrief, InstituteStats, Level, ProfileIn, User } from '@/types/api'

const GOALS: { v: Goal; hint: string }[] = [
  { v: 'general', hint: 'Balanced strength, cardio and core' },
  { v: 'fat_loss', hint: 'More cardio, higher tempo' },
  { v: 'strength', hint: 'More push and legs volume' },
  { v: 'consistency', hint: 'Shorter, easier, camera-tracked — just show up' },
]
const LEVELS: { v: Level; hint: string }[] = [
  { v: 'beginner', hint: 'New or returning after a long break' },
  { v: 'intermediate', hint: 'Can do 10+ push-ups and 20 squats' },
  { v: 'advanced', hint: 'Train regularly, want volume' },
]
const STEPS = [
  { label: 'Goal', long: 'Goal & baseline' },
  { label: 'Time', long: 'Time & frequency' },
  { label: 'Campus', long: 'Campus deployment' },
]

export function OnboardingPage({ edit = false }: { edit?: boolean }) {
  const nav = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)
  const [step, setStep] = useState(0)
  const [reached, setReached] = useState(edit ? 2 : 0)

  const [goal, setGoal] = useState<Goal>(user?.profile?.goal ?? 'general')
  const [level, setLevel] = useState<Level>(user?.profile?.level ?? 'beginner')
  const [minutes, setMinutes] = useState(user?.profile?.minutes_per_session ?? 15)
  const [days, setDays] = useState(user?.profile?.days_per_week ?? 4)
  const [instituteQ, setInstituteQ] = useState(user?.institute?.name ?? '')
  const [institute, setInstitute] = useState<InstituteBrief | null>(user?.institute ?? null)
  const [department, setDepartment] = useState(user?.department ?? '')
  const [hostel, setHostel] = useState(user?.hostel ?? '')

  const save = useMutation({
    mutationFn: (body: ProfileIn) => api<User>('/users/me/profile', { method: 'PUT', body }),
    onSuccess: (u) => {
      setUser(u)
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['plan'] })
      qc.invalidateQueries({ queryKey: ['nutrition'] })
      nav(edit ? '/profile' : '/home', { replace: true })
    },
  })

  useEffect(() => {
    if (!user) nav('/login', { replace: true })
  }, [user, nav])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [step])

  const go = (s: number) => {
    setStep(s)
    setReached((r) => Math.max(r, s))
  }

  const submit = () =>
    save.mutate({
      goal,
      level,
      minutes_per_session: minutes,
      days_per_week: days,
      institute_id: institute?.id ?? null,
      department: department || null,
      hostel: hostel || null,
      preferences: { voice: true, language: 'en', mirror: true, ...(user?.profile?.preferences ?? {}) },
    })

  const name = firstName(user?.name, '')
  const title = edit ? `Tune your plan, ${name}` : `Hi ${name}, let's set you up`

  return (
    <div className="relative flex min-h-full flex-col">
      <Backdrop variant={step === 0 ? 'radial' : step === 1 ? 'grid' : 'radial'} />
      <FlowHeader
        tag="v0.1 // collegiate"
        center={
          <nav aria-label="Setup steps" className="flex h-16 items-stretch gap-2 text-sm lg:gap-5">
            {STEPS.map((s, i) => (
              <button
                key={s.label}
                type="button"
                disabled={i > reached}
                onClick={() => go(i)}
                aria-current={i === step ? 'step' : undefined}
                className={clsx(
                  'relative flex items-center gap-2 px-2 font-medium transition-colors disabled:cursor-not-allowed',
                  i === step ? 'text-white' : i <= reached ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600',
                )}
              >
                <span className="font-mono text-[11px] text-slate-500">0{i + 1}</span>
                {s.long}
                {i === step && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-iris-500 shadow-[0_0_10px_rgba(90,107,255,0.7)]" />}
              </button>
            ))}
          </nav>
        }
        right={
          <>
            <span className="hidden lg:block">
              <StatusPill tone="slate" dotTone="brand">
                Adaptive engine live
              </StatusPill>
            </span>
            <span className="hidden items-center gap-2 rounded-full border border-line bg-ink-900/60 px-3 py-1.5 font-mono text-xs text-slate-400 sm:flex">
              <span className="h-2 w-2 animate-pulse-slow rounded-full bg-brand-400" />
              USER: <span className="font-semibold text-white">{name || 'you'}</span>
            </span>
            {edit ? (
              <Button variant="ghost" size="sm" onClick={() => nav(-1)}>
                Cancel
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logout()
                  qc.clear()
                  nav('/', { replace: true })
                }}
              >
                Exit
              </Button>
            )}
          </>
        }
      />

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 md:py-14">
        {step === 0 && (
          <StepGoal
            title={title}
            goal={goal}
            setGoal={setGoal}
            level={level}
            setLevel={setLevel}
            minutes={minutes}
            days={days}
            edit={edit}
            onBack={() => nav(-1)}
            onNext={() => go(1)}
          />
        )}
        {step === 1 && (
          <StepTime title={title} minutes={minutes} setMinutes={setMinutes} days={days} setDays={setDays} level={level} goal={goal} onBack={() => go(0)} onNext={() => go(2)} />
        )}
        {step === 2 && (
          <StepCampus
            title={title}
            edit={edit}
            instituteQ={instituteQ}
            setInstituteQ={setInstituteQ}
            institute={institute}
            setInstitute={setInstitute}
            department={department}
            setDepartment={setDepartment}
            hostel={hostel}
            setHostel={setHostel}
            onBack={() => go(1)}
            onSubmit={submit}
            saving={save.isPending}
            error={save.isError ? errorMessage(save.error) : null}
          />
        )}
      </main>
      <FlowFooter />
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Step 1 — goal & level

function StepGoal({
  title,
  goal,
  setGoal,
  level,
  setLevel,
  minutes,
  days,
  edit,
  onBack,
  onNext,
}: {
  title: string
  goal: Goal
  setGoal: (g: Goal) => void
  level: Level
  setLevel: (l: Level) => void
  minutes: number
  days: number
  edit: boolean
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="animate-fade-up">
      <section className="mb-12 max-w-3xl text-center md:text-left">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-iris-400">
          <span className="h-1.5 w-1.5 rounded-full bg-iris-500" /> Setup sequence
        </span>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">{title}</h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400 md:text-lg">
          FitSathi shapes your plan from your goal, your level today and what the camera sees in every session.
        </p>
        <div className="mx-auto mt-8 max-w-xl md:mx-0">
          <div className="mb-2.5 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
            <span className="font-semibold text-white">
              Step 1 of 3 <span className="mx-1 text-slate-500">·</span> <span className="text-iris-400">Goal &amp; baseline</span>
            </span>
            <span className="text-slate-500">33% complete</span>
          </div>
          <SegmentBar total={3} filled={1} tone="iris" />
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-7">
          <OptionSection index="01" title="What's your goal?">
            {GOALS.map((g) => (
              <RadioCard key={g.v} selected={goal === g.v} onSelect={() => setGoal(g.v)} title={GOAL_LABEL[g.v]} hint={g.hint} />
            ))}
          </OptionSection>
          <OptionSection index="02" title="Your level today">
            {LEVELS.map((l) => (
              <RadioCard key={l.v} selected={level === l.v} onSelect={() => setLevel(l.v)} title={LEVEL_LABEL[l.v]} hint={l.hint} />
            ))}
          </OptionSection>

          <div className="flex items-center justify-between gap-4 pb-6 pt-2">
            {edit ? (
              <Button variant="ghost" icon="arrow-left" onClick={onBack}>
                Back
              </Button>
            ) : (
              <span />
            )}
            <Button variant="iris" size="lg" iconRight="arrow-right" onClick={onNext} className="w-full min-w-[220px] sm:w-auto">
              Next: Time &amp; frequency
            </Button>
          </div>
        </div>

        <EnginePreview goal={goal} level={level} minutes={minutes} days={days} />
      </div>
    </div>
  )
}

function OptionSection({ index, title, children }: { index: string; title: string; children: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-ink-850/70 p-6 backdrop-blur-sm md:p-7">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Section {index}</span>
          <h2 className="mt-0.5 text-xl font-bold tracking-tight text-white">{title}</h2>
        </div>
        <span className="text-xs font-medium text-slate-500">Required</span>
      </div>
      <div role="radiogroup" aria-label={title} className="space-y-3">
        {children}
      </div>
    </section>
  )
}

// Mirrors LEVEL_FACTOR and the progression rules in backend/app/recommender/catalog.py; this is
// only a picture of how the plan will move, the real numbers come from the server every day.
const LEVEL_FACTOR: Record<Level, number> = { beginner: 0.7, intermediate: 1.0, advanced: 1.3 }
const GROWTH: Record<Goal, number> = { general: 0.07, fat_loss: 0.07, strength: 0.09, consistency: 0.04 }
const READINESS: Record<Level, { label: string; hint: string; tone: string }> = {
  beginner: { label: 'Build', hint: 'Starts at 70% volume', tone: 'text-brand-400' },
  intermediate: { label: 'Steady', hint: 'Standard volume', tone: 'text-pulse' },
  advanced: { label: 'High', hint: 'Starts at 130% volume', tone: 'text-volt' },
}
const GOAL_ADVICE: Record<Goal, string> = {
  general: 'Legs, push, core and cardio rotate across the week, so no muscle group is loaded two days running.',
  fat_loss: 'Cardio-led sessions stay short and brisk; after three days in a row the plan swaps in a lighter core & mobility day.',
  strength: 'Legs and push alternate so each gets a day or two before it is loaded again; reps rise only when form holds.',
  consistency: 'Sessions stay short and easy on purpose — showing up is the metric that matters.',
}
const LEVEL_ADVICE: Record<Level, string> = {
  beginner: 'Beginners start at 70% of standard volume; reps go up only after two clean sessions.',
  intermediate: 'Volume rises about 10% after two complete sessions with good form.',
  advanced: 'You start at 130% volume; the plan trims it automatically if your form dips.',
}

function EnginePreview({ goal, level, minutes, days }: { goal: Goal; level: Level; minutes: number; days: number }) {
  const r = READINESS[level]
  const stim = Array.from({ length: 8 }, (_, i) => LEVEL_FACTOR[level] * (1 + GROWTH[goal] * i) * (i === 4 ? 0.88 : 1))
  const rec = stim.map((v, i) => (stim[i - 1] ?? v * 0.92) * 0.9)
  const W = 500
  const H = 200
  const sp = toPoints(stim, W, H, { pad: 14, min: 0.45, max: 2.1 })
  const rp = toPoints(rec, W, H, { pad: 14, min: 0.45, max: 2.1 })
  const end = sp[sp.length - 1]

  return (
    <aside className="lg:col-span-5">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-ink-850/90 p-6 backdrop-blur-md">
        <div className="mb-5 flex items-center justify-between border-b border-white/[0.06] pb-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">FitSathi engine preview</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">live · updates as you pick</span>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3">
          <Micro label="Target pace" value={days} unit="days" hint={`${days * minutes} min / wk`} hintClass="text-pulse" />
          <Micro label="Base volume" value={minutes} unit="min" hint="Adaptive ramp" />
          <Micro label="Readiness" value={r.label} hint={r.hint} hintClass={r.tone} />
        </div>

        <div className="mb-6 rounded-xl border border-white/[0.06] bg-ink-800/50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold tracking-tight text-slate-300">Projected workload · {GOAL_LABEL[goal]}</span>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="flex items-center gap-1.5 text-iris-400">
                <span className="h-0.5 w-2 bg-iris-500" /> Stimulus
              </span>
              <span className="flex items-center gap-1.5 text-pulse">
                <span className="h-0.5 w-2 bg-pulse" /> Recovery
              </span>
            </div>
          </div>
          <div className="relative h-44 w-full overflow-hidden rounded-lg border border-white/[0.04] bg-ink-950/60">
            <div className="pointer-events-none absolute inset-0 grid grid-cols-6 grid-rows-4 opacity-20">
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className="border-b border-r border-white/10" />
              ))}
            </div>
            <svg className="h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" fill="none" aria-label="Projected weekly workload over eight weeks" role="img">
              <defs>
                <linearGradient id="onb-stim" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#5a6bff" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#5a6bff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={areaPath(sp, H)} fill="url(#onb-stim)" />
              <path d={smoothPath(sp)} stroke="#5a6bff" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path d={smoothPath(rp)} stroke="#22d3ee" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {end && <circle cx={end[0]} cy={end[1]} r="4" fill="#5a6bff" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
            </svg>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-slate-500">
            <span>Wk 1 · Calibration</span>
            <span className="hidden sm:inline">Wk 4 · Progressive overload</span>
            <span>Wk 8 · New baseline</span>
          </div>
        </div>

        <div className="flex items-start gap-3.5 rounded-xl border border-line bg-white/[0.02] p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-flame/25 bg-flame/10 text-flame">
            <Icon name="alert" />
          </span>
          <div>
            <div className="text-xs font-semibold text-white">How your plan will recover you</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {GOAL_ADVICE[goal]} {LEVEL_ADVICE[level]}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}

function Micro({ label, value, unit, hint, hintClass = 'text-slate-400' }: { label: string; value: ReactNode; unit?: string; hint: string; hintClass?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-ink-800/70 p-3">
      <div className="text-[11px] font-medium text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-bold text-white">
        {value} {unit && <span className="text-xs font-normal text-slate-400">{unit}</span>}
      </div>
      <div className={clsx('mt-1 text-[10px] font-medium', hintClass)}>{hint}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Step 2 — time & frequency

const RECOMMENDED_DAYS: Record<Level, number> = { beginner: 3, intermediate: 4, advanced: 5 }
const RHYTHM: Record<number, { label: string; hint: string }> = {
  3: { label: 'Steady', hint: 'Easy to keep' },
  4: { label: 'Optimal', hint: 'High adherence' },
  5: { label: 'Ambitious', hint: 'Needs a routine' },
  6: { label: 'Intense', hint: 'Watch recovery' },
}
// Which weekdays train for a given frequency (Mon-first), spread to leave gaps.
const WEEK_PATTERN: Record<number, number[]> = {
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 3, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
}
const CAPACITY: Record<Level, number> = { beginner: 90, intermediate: 140, advanced: 200 }

function StepTime({
  title,
  minutes,
  setMinutes,
  days,
  setDays,
  level,
  goal,
  onBack,
  onNext,
}: {
  title: string
  minutes: number
  setMinutes: (m: number) => void
  days: number
  setDays: (d: number) => void
  level: Level
  goal: Goal
  onBack: () => void
  onNext: () => void
}) {
  const recommended = Math.min(6, RECOMMENDED_DAYS[level] + (goal === 'fat_loss' ? 1 : 0))
  return (
    <div className="mx-auto flex w-full max-w-5xl animate-fade-up flex-col items-center">
      <section className="mb-8 w-full text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-ink-800 px-3 py-1 text-xs font-medium text-slate-400">
          <span className="font-semibold text-white">Step 2 of 3</span>
          <span className="text-slate-600">·</span>
          <span>Time &amp; frequency</span>
        </div>
        <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl">{title}</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
          Configure your baseline rhythm. FitSathi fits each week's progressive volume around your real timetable.
        </p>
        <div className="mx-auto mt-6 max-w-xs">
          <SegmentBar total={3} filled={2} tone="iris" height="h-1" />
        </div>
      </section>

      <div className="grid w-full grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-7">
          <ParamCard
            kicker="Duration parameter"
            title="Minutes per workout"
            badge={<Badge tone="iris" mono>Active: {minutes} min</Badge>}
            note={
              <>
                <Icon name="info" size={14} className="shrink-0 text-slate-500" />
                The plan fits sets and rest into this budget.
              </>
            }
          >
            {[10, 15, 20, 30].map((m) => (
              <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)}>
                {m} min
              </Chip>
            ))}
          </ParamCard>
          <ParamCard
            kicker="Frequency parameter"
            title="Days per week"
            badge={<Badge tone="brand" mono>Suggested: {recommended} days</Badge>}
            note={
              <>
                <Icon name="calendar" size={14} className="shrink-0 text-slate-500" />
                {days} training days leave {7 - days} rest day{7 - days === 1 ? '' : 's'}, and three days in a row trigger a lighter recovery session.
              </>
            }
          >
            {[3, 4, 5, 6].map((d) => (
              <Chip key={d} active={days === d} onClick={() => setDays(d)}>
                {d} days
              </Chip>
            ))}
          </ParamCard>
        </div>
        <VolumeProjection minutes={minutes} days={days} level={level} />
      </div>

      <section className="mt-10 flex w-full flex-col-reverse items-center justify-between gap-4 border-t border-line pt-6 sm:flex-row">
        <Button variant="secondary" size="lg" icon="chevron-left" onClick={onBack} className="w-full sm:w-auto">
          Back
        </Button>
        <Button variant="iris" size="lg" iconRight="chevron-right" onClick={onNext} className="w-full sm:w-64">
          Next: Campus
        </Button>
      </section>
    </div>
  )
}

function ParamCard({ kicker, title, badge, note, children }: { kicker: string; title: string; badge: ReactNode; note: ReactNode; children: ReactNode }) {
  return (
    <article className="relative overflow-hidden rounded-xl border border-line bg-ink-800 p-6 shadow-xl shadow-black/40 sm:p-7">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <span className="label-mono mb-1 block text-slate-500">{kicker}</span>
          <h2 className="text-lg font-bold tracking-tight text-white">{title}</h2>
        </div>
        {badge}
      </div>
      <div className="my-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">{children}</div>
      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-xs text-slate-400">{note}</div>
    </article>
  )
}

function VolumeProjection({ minutes, days, level }: { minutes: number; days: number; level: Level }) {
  const weekly = minutes * days
  const rhythm = RHYTHM[days] ?? RHYTHM[4]
  const pattern = WEEK_PATTERN[days] ?? WEEK_PATTERN[4]
  const barHeight = minutes >= 30 ? 92 : minutes >= 20 ? 76 : minutes >= 15 ? 62 : 46
  const today = (new Date().getDay() + 6) % 7 // Monday = 0
  const fatigue = Math.max(4, Math.min(96, Math.round((weekly / CAPACITY[level]) * 45)))
  const fatigueLabel = fatigue < 35 ? 'Low' : fatigue < 65 ? 'Moderate' : 'High'
  const fatigueTone = fatigue < 35 ? 'bg-brand-400' : fatigue < 65 ? 'bg-flame' : 'bg-rose-400'
  const fatigueText = fatigue < 35 ? 'text-brand-400' : fatigue < 65 ? 'text-flame' : 'text-rose-300'
  const who = Math.round((weekly / 150) * 100)

  return (
    <aside className="flex h-full flex-col justify-between rounded-xl border border-line bg-ink-800 p-6 shadow-xl shadow-black/40 lg:col-span-5">
      <div>
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse-slow rounded-full bg-brand-400" />
            <span className="text-xs font-semibold tracking-wide text-white">Weekly volume projection</span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">Adaptive model</span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-line bg-ink-950 p-3.5">
            <span className="label-mono mb-1 block text-slate-500">Total target</span>
            <div className="font-mono text-2xl font-bold tracking-tight text-white">
              {weekly} <span className="font-sans text-xs font-normal text-slate-400">min/wk</span>
            </div>
            <span className="mt-0.5 inline-block font-mono text-[11px] text-brand-400">{who}% of WHO's 150 min</span>
          </div>
          <div className="rounded-lg border border-line bg-ink-950 p-3.5">
            <span className="label-mono mb-1 block text-slate-500">Rhythm rating</span>
            <div className="font-mono text-2xl font-bold tracking-tight text-iris-400">{rhythm.label}</div>
            <span className="mt-0.5 inline-block font-mono text-[11px] text-slate-400">{rhythm.hint}</span>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="label-mono text-slate-500">Weekly load distribution</span>
            <span className="font-mono text-[11px] text-white">{days} sessions</span>
          </div>
          <div className="flex h-28 items-end justify-between gap-2 rounded-lg border border-line bg-ink-950/60 px-1.5 pt-4">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
              const on = pattern.includes(i)
              const isToday = i === today
              return (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <div
                    className={clsx(
                      'w-full rounded-t-sm transition-all duration-300',
                      on ? (isToday ? 'bg-iris-500 shadow-[0_0_12px_rgba(90,107,255,0.6)]' : 'bg-iris-500/80') : 'bg-ink-600/40',
                    )}
                    style={{ height: `${on ? barHeight : 10}%` }}
                    title={on ? `${minutes} min session` : 'Rest'}
                  />
                  <span className={clsx('pb-1 font-mono text-[10px]', isToday ? 'font-semibold text-white' : 'text-slate-500')}>{d}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-6 border-t border-line pt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="label-mono text-slate-500">Fatigue risk index</span>
            <span className={clsx('font-mono text-xs', fatigueText)}>
              {fatigueLabel} ({fatigue}%)
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full border border-line bg-ink-950">
            <div className={clsx('h-full rounded-full transition-all duration-500', fatigueTone)} style={{ width: `${fatigue}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-start gap-2 rounded border border-line bg-ink-750/40 p-2.5 text-[11px] leading-relaxed text-slate-400">
        <Icon name="check" size={14} className="mt-0.5 shrink-0 text-brand-400" />
        <span>
          {minutes} min × {days} days fits between lectures — up to {weekly} verified minutes a week when you train with the camera coach.
        </span>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------------------------
// Step 3 — campus

function StepCampus({
  title,
  edit,
  instituteQ,
  setInstituteQ,
  institute,
  setInstitute,
  department,
  setDepartment,
  hostel,
  setHostel,
  onBack,
  onSubmit,
  saving,
  error,
}: {
  title: string
  edit: boolean
  instituteQ: string
  setInstituteQ: (q: string) => void
  institute: InstituteBrief | null
  setInstitute: (i: InstituteBrief | null) => void
  department: string
  setDepartment: (d: string) => void
  hostel: string
  setHostel: (h: string) => void
  onBack: () => void
  onSubmit: () => void
  saving: boolean
  error: string | null
}) {
  const search = useQuery({
    queryKey: ['institutes', instituteQ],
    queryFn: () => api<InstituteBrief[]>(`/institutes?q=${encodeURIComponent(instituteQ)}`, { auth: false }),
    enabled: instituteQ.length >= 2 && (!institute || institute.name !== instituteQ),
  })

  return (
    <div className="mx-auto flex w-full max-w-4xl animate-fade-up flex-col items-center">
      <div className="mb-6 flex w-full max-w-xl flex-col items-center">
        <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-400">
          <span>Step 3 of 3</span>
          <span className="text-slate-600">•</span>
          <span className="font-medium normal-case tracking-normal text-iris-400">Campus deployment</span>
        </div>
        <SegmentBar total={3} filled={3} tone="iris" height="h-1" className="w-full px-1" />
      </div>

      <div className="mb-9 max-w-2xl text-center">
        <h1 className="mb-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">{title}</h1>
        <p className="mx-auto max-w-lg text-sm leading-relaxed text-slate-400 sm:text-base">
          Personalise your campus profile and unlock your collegiate leaderboard telemetry.
        </p>
      </div>

      <section className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-ink-900/90 shadow-[0_8px_32px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-ink-850/60 px-5 py-3 font-mono text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="font-medium tracking-wider text-slate-300">CORE.CAMPUS_LINK</span>
            <span className="text-slate-600">|</span>
            <span className={clsx('font-semibold', institute ? 'text-iris-400' : 'text-slate-500')}>{institute ? 'LINKED' : 'OPTIONAL'}</span>
          </div>
          <span className="truncate">{institute ? `LOC: ${[institute.city, institute.state].filter(Boolean).join(', ')}` : 'LOC: —'}</span>
        </div>

        <div className="space-y-7 p-6 sm:p-8">
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <Field
              label="Your institute"
              info="Links you to your campus leaderboard and the institute's Fit India dashboard. Only anonymous totals are ever shown there."
              meta={
                institute && (
                  <span className="flex items-center gap-1 font-mono text-[11px] text-brand-400">
                    <Icon name="check" size={13} /> Listed institute
                  </span>
                )
              }
              hint="Powers your campus leaderboard and Fit India dashboard. Optional."
            >
              {(id) => (
                <div className="relative">
                  <Input
                    id={id}
                    accent="iris"
                    value={instituteQ}
                    onChange={(e) => {
                      setInstituteQ(e.target.value)
                      setInstitute(null)
                    }}
                    placeholder="Search your campus (e.g. NIT, IIT)"
                    autoComplete="off"
                    big
                    className="pr-36"
                  />
                  {institute && (
                    <span className="pointer-events-none absolute right-3.5 top-1/2 hidden max-w-[45%] -translate-y-1/2 truncate rounded border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 font-mono text-[11px] text-brand-400 sm:inline-block">
                      ✓ {institute.name}
                    </span>
                  )}
                  {!institute && instituteQ.length >= 2 && (
                    <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-60 overflow-y-auto rounded-xl border border-line bg-ink-900 shadow-2xl">
                      {search.isPending && (
                        <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-400">
                          <Spinner className="h-3.5 w-3.5" /> Searching institutes…
                        </div>
                      )}
                      {search.data?.length === 0 && <div className="px-4 py-3 text-xs text-slate-500">No match — you can skip this and add it later.</div>}
                      {search.data?.map((i) => (
                        <button
                          key={i.id}
                          type="button"
                          className="block w-full border-b border-line px-4 py-2.5 text-left last:border-0 hover:bg-white/[0.04]"
                          onClick={() => {
                            setInstitute(i)
                            setInstituteQ(i.name)
                          }}
                        >
                          <div className="text-sm font-medium text-white">{i.name}</div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {[i.city, i.state].filter(Boolean).join(', ')}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label="Department"
                info="Groups your verified minutes with your department on the campus dashboard (only when enough students take part)."
                hint={<span className="font-mono text-[11px]">{department ? `Dept. squad: ${department.toUpperCase()}` : 'e.g. CSE, EEE, MECH'}</span>}
              >
                {(id) => <Input id={id} accent="iris" mono value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="CSE" maxLength={80} />}
              </Field>
              <Field
                label={
                  <>
                    Hostel <span className="normal-case tracking-normal text-slate-500">(optional)</span>
                  </>
                }
                info="Handy for naming a squad after your block. Never shown publicly."
                meta={<span className="font-mono text-[10px] text-pulse">{hostel ? 'SYNC READY' : 'OPTIONAL'}</span>}
                hint={<span className="font-mono text-[11px]">Block & wing, for squad invites</span>}
              >
                {(id) => (
                  <Input
                    id={id}
                    accent="brand"
                    value={hostel}
                    onChange={(e) => setHostel(e.target.value)}
                    placeholder="e.g. Krishna, Block A"
                    maxLength={80}
                    highlight={!!hostel}
                  />
                )}
              </Field>
            </div>
          </form>

          <CampusRelay institute={institute} />
          {error && <Alert>{error}</Alert>}
        </div>

        <div className="flex flex-col-reverse items-center justify-between gap-4 border-t border-line bg-ink-850/80 px-6 py-5 sm:flex-row sm:px-8">
          <Button variant="outline" size="lg" icon="arrow-left" onClick={onBack} className="w-full sm:w-auto">
            Back
          </Button>
          <Button variant="iris" size="lg" iconRight="arrow-right" onClick={onSubmit} loading={saving} className="w-full sm:w-auto">
            {edit ? 'Save changes' : 'Build my first plan'}
          </Button>
        </div>
      </section>

      <div className="mt-6 flex items-center gap-2 text-center font-mono text-xs text-slate-500">
        <Icon name="lock" size={14} className="shrink-0 text-slate-400" />
        <span>Campus details can be changed any time from your profile.</span>
      </div>
    </div>
  )
}

/** The campus you picked, live: real weekly totals from the public institute dashboard. */
function CampusRelay({ institute }: { institute: InstituteBrief | null }) {
  const stats = useQuery({
    queryKey: ['institute', institute?.slug, 'stats'],
    queryFn: () => api<InstituteStats>(`/institutes/${institute!.slug}/stats?weeks=8`, { auth: false }),
    enabled: !!institute,
    staleTime: 60_000,
  })
  const W = 600
  const H = 120
  const trend = stats.data?.trend.map((t) => t.verified_minutes) ?? []
  const hasSignal = trend.some((v) => v > 0)
  const pts = hasSignal ? toPoints(trend, W, H, { pad: 18, min: 0 }) : toPoints([1, 1.2, 0.9, 1.1, 1, 1.15, 0.95, 1.05], W, H, { pad: 18, min: 0, max: 2 })
  const last = pts[pts.length - 1]

  return (
    <div className="border-t border-line pt-3">
      <div className="mb-2 flex items-center justify-between font-mono text-xs text-slate-400">
        <MonoLabel className="text-slate-500">Live campus relay telemetry</MonoLabel>
        <span className="text-[11px] text-iris-400">{institute ? `${institute.slug.toUpperCase()} // 8 WK` : 'CAMPUS_STREAM // —'}</span>
      </div>
      <div className="relative h-28 w-full overflow-hidden rounded-lg border border-white/[0.06] bg-ink-950/80 sm:h-32">
        <div className="absolute inset-0 bg-dot-grid opacity-30" />
        <div className="pointer-events-none absolute left-3 top-2 font-mono">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Campus verified minutes · this week</div>
          <div className="text-xs font-semibold tracking-tight text-white sm:text-sm">
            {institute ? (stats.data ? stats.data.this_week.verified_minutes.toLocaleString('en-IN') : '…') : '—'}{' '}
            <span className="text-[10px] font-normal text-slate-400">min</span>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-2 right-3 text-right font-mono">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Active students</div>
          <div className="text-xs font-semibold tracking-tight text-brand-400 sm:text-sm">{institute ? (stats.data?.this_week.active_students ?? '…') : '—'}</div>
        </div>
        {!institute && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded border border-line bg-ink-900/80 px-2.5 py-1 font-mono text-[10px] text-slate-400">Pick your institute to open its relay</span>
          </div>
        )}
        <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
          <path d={smoothPath(pts)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" transform="translate(0 10)" />
          <path className="animate-dash" d={smoothPath(pts)} fill="none" stroke="#5a6bff" strokeWidth="1.8" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" opacity={institute ? 1 : 0.35} />
          {institute && hasSignal && last && (
            <>
              <circle cx={last[0]} cy={last[1]} r="5" fill="#5a6bff" opacity="0.35" className="animate-ping" style={{ transformOrigin: `${last[0]}px ${last[1]}px` }} />
              <circle cx={last[0]} cy={last[1]} r="3" fill="#ffffff" />
            </>
          )}
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 border-t border-white/[0.05] pt-3 font-mono text-[10px] text-slate-500 sm:grid-cols-2">
        <div>
          <span className="text-slate-400">&gt;</span>{' '}
          {institute ? (
            <>
              Linked to <span className="text-slate-300">{institute.slug.toUpperCase()}::CAMPUS</span>
              {stats.data && ` · ${stats.data.total_students} students on FitSathi`}
            </>
          ) : (
            'No campus linked — you can add one later'
          )}
        </div>
        <div className="text-left text-slate-400 sm:text-right">
          K-ANON: <span className="text-white">≥ 5</span> | <span className="text-brand-400">AGGREGATES ONLY</span>
        </div>
      </div>
    </div>
  )
}
