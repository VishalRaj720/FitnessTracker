import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Alert, Button, ButtonLink, Card, DietMark, Icon, KeyValue, MonoLabel, PageHeader, PanelHeader, Skeleton, Stat, Toggle, type IconName } from '@/components/ui'
import { useAuthStore } from '@/features/auth/authStore'
import { useNutritionProfile } from '@/features/nutrition/api'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { api, errorMessage } from '@/lib/apiClient'
import { ACTIVITY_LABEL, DIET_LABEL, GOAL_LABEL, LEVEL_LABEL, fmtInt, fmtNum } from '@/lib/format'
import { initials } from '@/lib/people'
import type { ProfileIn, User } from '@/types/api'

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const install = useInstallPrompt()
  const nutrition = useNutritionProfile()
  if (!user) return null
  const p = user.profile
  const n = nutrition.data

  return (
    <div className="space-y-8">
      <PageHeader
        size="lg"
        badge="Athlete profile // on-device first"
        title={user.name}
        subtitle={user.email}
        right={
          <>
            <ButtonLink to="/profile/edit" variant="iris" icon="settings">
              Edit plan
            </ButtonLink>
            <ButtonLink to="/profile/settings" variant="secondary" icon="volume">
              Settings
            </ButtonLink>
          </>
        }
      />

      <Card radius="xl" pad="md" brackets className="overflow-hidden">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-pulse/[0.06] blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-line-strong bg-gradient-to-tr from-ink-800 to-ink-700 font-mono text-xl font-bold text-pulse shadow-inner">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-line bg-ink-850 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-slate-300">{user.role}</span>
              {user.institute && <span className="rounded-md border border-iris-500/30 bg-iris-500/10 px-2 py-0.5 text-xs text-iris-300">{user.institute.name}</span>}
              {user.department && <span className="rounded-md border border-line bg-ink-850 px-2 py-0.5 font-mono text-[11px] uppercase text-slate-300">{user.department}</span>}
              {user.hostel && <span className="rounded-md border border-line bg-ink-850 px-2 py-0.5 text-xs text-slate-300">{user.hostel}</span>}
            </div>
            <p className="text-sm text-slate-400">{p ? `${GOAL_LABEL[p.goal]} · ${LEVEL_LABEL[p.level]} · ${p.minutes_per_session} min × ${p.days_per_week} days a week` : 'Plan not set up yet'}</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-ink-900 px-3 py-2">
            <Icon name="flame" size={16} className={user.stats.current_streak > 0 ? 'text-flame' : 'text-slate-500'} />
            <span className="font-mono text-lg font-bold text-white">{user.stats.current_streak}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">day streak</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Sessions" value={user.stats.total_sessions} icon="activity" hint="All-time" />
        <Stat label="Verified" value={fmtInt(user.stats.total_verified_minutes)} unit="min" icon="shield-check" tone="brand" hint="Camera-counted" />
        <Stat label="Best streak" value={user.stats.longest_streak} unit="days" icon="trophy" tone="volt" />
        <Stat label="Current" value={user.stats.current_streak} unit="days" icon="flame" tone={user.stats.current_streak ? 'flame' : undefined} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card radius="xl" pad="md">
          <PanelHeader kicker="Plan settings" kickerDot="iris" title="Your training category" right={<ButtonLink to="/profile/edit" variant="ghost" size="xs" icon="settings">Edit</ButtonLink>} />
          <div className="divide-y divide-line">
            <KeyValue k="Goal" v={p ? GOAL_LABEL[p.goal] : '—'} />
            <KeyValue k="Level" v={p ? LEVEL_LABEL[p.level] : '—'} />
            <KeyValue k="Session" v={p ? `${p.minutes_per_session} min` : '—'} />
            <KeyValue k="Frequency" v={p ? `${p.days_per_week} days / week` : '—'} />
            <KeyValue k="Institute" v={user.institute?.name ?? '—'} />
            <KeyValue k="Department" v={user.department ?? '—'} />
          </div>
        </Card>

        <Card radius="xl" pad="md">
          <PanelHeader
            kicker="Nutrition profile"
            kickerDot="brand"
            title="Body metrics & diet"
            right={
              <ButtonLink to="/nutrition" variant="ghost" size="xs" iconRight="arrow-right">
                {n ? 'Diet plan' : 'Set up'}
              </ButtonLink>
            }
          />
          {nutrition.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : nutrition.isError ? (
            <Alert>{errorMessage(nutrition.error)}</Alert>
          ) : n ? (
            <div className="divide-y divide-line">
              <KeyValue
                k="Diet"
                v={
                  <span className="inline-flex items-center gap-1.5">
                    <DietMark diet={n.diet_type} /> {DIET_LABEL[n.diet_type]}
                  </span>
                }
              />
              <KeyValue k="Body" v={`${fmtNum(n.height_cm, 0)} cm · ${fmtNum(n.weight_kg)} kg · BMI ${fmtNum(n.bmi)}`} />
              <KeyValue k="Age · sex" v={`${n.age} · ${n.sex === 'other' ? 'other' : n.sex}`} />
              <KeyValue k="Activity" v={ACTIVITY_LABEL[n.activity_level]?.label ?? n.activity_level} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line p-5 text-center">
              <p className="text-sm text-slate-300">No nutrition profile yet.</p>
              <p className="mt-1 text-xs text-slate-500">Add height, weight and diet type to get daily calorie, protein and water targets.</p>
              <ButtonLink to="/nutrition" variant="primary" size="sm" className="mt-4" iconRight="arrow-right">
                Set up nutrition
              </ButtonLink>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <LinkTile to="/profile/settings" icon="volume" title="Settings" body="Voice cues, Hindi, mirror camera" />
        {user.institute ? (
          <LinkTile to={`/campus/${user.institute.slug}`} icon="building" title="Campus dashboard" body={`${user.institute.name} · Fit India report`} />
        ) : (
          <LinkTile to="/profile/edit" icon="building" title="Link your campus" body="Unlock campus leagues and the Fit India report" />
        )}
        {install.canInstall ? (
          <button type="button" onClick={install.install} className="text-left">
            <TileBody icon="smartphone" title="Install FitSathi" body="Works offline in the hostel" />
          </button>
        ) : (
          <LinkTile to="/progress" icon="chart" title="Progress telemetry" body="Verified minutes and form trends" />
        )}
      </div>
    </div>
  )
}

function LinkTile({ to, icon, title, body }: { to: string; icon: IconName; title: string; body: string }) {
  return (
    <Link to={to} className="block">
      <TileBody icon={icon} title={title} body={body} />
    </Link>
  )
}

function TileBody({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <div className="group flex h-full items-center justify-between gap-3 rounded-xl border border-line bg-ink-900/85 p-4 transition hover:border-line-strong">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-ink-800 text-slate-300 transition group-hover:text-pulse">
          <Icon name={icon} />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="truncate text-xs text-slate-400">{body}</div>
        </div>
      </div>
      <Icon name="arrow-right" size={14} className="shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-white" />
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Settings

interface Prefs {
  voice?: boolean
  language?: 'en' | 'hi'
  mirror?: boolean
}

function SettingRow({ icon, label, hint, checked, onChange, disabled }: { icon: IconName; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-ink-800/60 p-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', checked ? 'border-pulse/30 bg-pulse/10 text-pulse' : 'border-line bg-ink-700 text-slate-400')}>
          <Icon name={icon} size={15} />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-100">{label}</div>
          <div className="text-xs text-slate-500">{hint}</div>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  )
}

export function SettingsPage() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)
  const prefs = (user?.profile?.preferences ?? {}) as Prefs

  const save = useMutation({
    mutationFn: (preferences: Record<string, unknown>) => {
      const p = user!.profile!
      const body: ProfileIn = {
        goal: p.goal,
        level: p.level,
        minutes_per_session: p.minutes_per_session,
        days_per_week: p.days_per_week,
        institute_id: user!.institute?.id ?? null,
        department: user!.department,
        hostel: user!.hostel,
        preferences: { ...p.preferences, ...preferences },
      }
      return api<User>('/users/me/profile', { method: 'PUT', body })
    },
    onSuccess: (u) => {
      setUser(u)
      qc.invalidateQueries({ queryKey: ['me'] })
    },
  })

  if (!user?.profile) return null

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader size="lg" badge="System // preferences" title="Configuration" subtitle="How the coach talks to you, and exactly what leaves your phone." />

      <Card radius="xl" pad="md">
        <PanelHeader kicker="Coach output" kickerDot="pulse" title="During workouts" right={save.isPending ? <span className="font-mono text-[11px] text-slate-500">saving…</span> : undefined} />
        <div className="space-y-2.5">
          <SettingRow icon="volume" label="Voice cues" hint="The coach speaks corrections and counts" checked={prefs.voice !== false} onChange={(v) => save.mutate({ voice: v })} />
          <SettingRow icon="globe" label="Hindi cues" hint="Corrections in Hindi (device voice permitting)" checked={prefs.language === 'hi'} onChange={(v) => save.mutate({ language: v ? 'hi' : 'en' })} />
          <SettingRow icon="flip" label="Mirror camera" hint="Show the camera preview like a mirror" checked={prefs.mirror !== false} onChange={(v) => save.mutate({ mirror: v })} />
        </div>
        {save.isError && <Alert className="mt-3">{errorMessage(save.error)}</Alert>}
      </Card>

      <Card radius="xl" pad="md">
        <PanelHeader kicker="Privacy model" kickerDot="brand" title="What stays, what syncs" />
        <ul className="space-y-3">
          {[
            ['On this phone only', 'Camera frames and the pose skeleton. Detection runs on-device; video is never uploaded.', 'lock'],
            ['Synced to your account', 'Reps, timings, form scores, your plan settings and the food and water you log.', 'shield-check'],
            ['Shared with your campus', 'Only anonymous totals, and only for groups of five or more active students.', 'users'],
          ].map(([t, b, i]) => (
            <li key={t} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-ink-800 text-brand-400">
                <Icon name={i as IconName} size={14} />
              </span>
              <div>
                <div className="text-sm font-medium text-slate-100">{t}</div>
                <div className="text-xs leading-relaxed text-slate-400">{b}</div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card radius="xl" pad="md">
        <PanelHeader kicker="Account" title={user.email} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <MonoLabel>Signed in on this device</MonoLabel>
          <Button
            variant="danger"
            icon="log-out"
            onClick={() => {
              logout()
              qc.clear()
              nav('/', { replace: true })
            }}
          >
            Log out
          </Button>
        </div>
      </Card>
    </div>
  )
}
