import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, PageTitle } from '@/components/ui'
import { useAuthStore } from '@/features/auth/authStore'
import { useMe } from '@/features/auth/api'
import { api } from '@/lib/apiClient'
import { GOAL_LABEL, LEVEL_LABEL } from '@/lib/format'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import type { ProfileIn, User } from '@/types/api'

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  useMe()
  const install = useInstallPrompt()
  if (!user) return null
  const p = user.profile
  return (
    <div className="space-y-4">
      <PageTitle title={user.name} subtitle={user.email} />
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <div className="font-semibold">Plan settings</div>
          <Link to="/profile/edit">
            <Button size="sm" variant="secondary">
              Edit
            </Button>
          </Link>
        </div>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-slate-400">Goal</dt>
          <dd>{p ? GOAL_LABEL[p.goal] : '—'}</dd>
          <dt className="text-slate-400">Level</dt>
          <dd>{p ? LEVEL_LABEL[p.level] : '—'}</dd>
          <dt className="text-slate-400">Session</dt>
          <dd>{p ? `${p.minutes_per_session} min · ${p.days_per_week} days/wk` : '—'}</dd>
          <dt className="text-slate-400">Institute</dt>
          <dd>{user.institute?.name ?? '—'}</dd>
          <dt className="text-slate-400">Department</dt>
          <dd>{user.department ?? '—'}</dd>
        </dl>
      </Card>
      <Card>
        <div className="mb-2 font-semibold">Lifetime</div>
        <div className="flex gap-4 text-sm">
          <div>
            <div className="text-2xl font-bold">{user.stats.total_sessions}</div>
            <div className="text-xs text-slate-400">sessions</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{user.stats.total_verified_minutes}</div>
            <div className="text-xs text-slate-400">verified min</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{user.stats.longest_streak}</div>
            <div className="text-xs text-slate-400">best streak</div>
          </div>
        </div>
      </Card>
      <Link to="/profile/settings" className="block">
        <Card className="flex items-center justify-between">
          <div className="font-semibold">Settings</div>
          <span className="text-slate-500">›</span>
        </Card>
      </Link>
      {user.institute && (
        <Link to={`/campus/${user.institute.slug}`} className="block">
          <Card className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Campus dashboard</div>
              <div className="text-xs text-slate-400">{user.institute.name}</div>
            </div>
            <Badge tone="brand">Fit India</Badge>
          </Card>
        </Link>
      )}
      {install.canInstall && (
        <Button className="w-full" variant="secondary" onClick={install.install}>
          Install FitSathi on this phone
        </Button>
      )}
    </div>
  )
}

export function SettingsPage() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)
  const prefs = (user?.profile?.preferences ?? {}) as { voice?: boolean; language?: 'en' | 'hi'; mirror?: boolean }

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
  const Toggle = ({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) => (
    <button type="button" onClick={() => onChange(!value)} className="flex w-full items-center justify-between py-2.5 text-left">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-slate-400">{hint}</div>
      </div>
      <span className={`relative h-6 w-11 rounded-full transition ${value ? 'bg-brand-500' : 'bg-slate-700'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  )

  return (
    <div className="space-y-4">
      <PageTitle title="Settings" />
      <Card className="divide-y divide-slate-800">
        <Toggle label="Voice cues" hint="The coach speaks corrections and counts" value={prefs.voice !== false} onChange={(v) => save.mutate({ voice: v })} />
        <Toggle label="Hindi cues" hint="Corrections in Hindi (device voice permitting)" value={prefs.language === 'hi'} onChange={(v) => save.mutate({ language: v ? 'hi' : 'en' })} />
        <Toggle label="Mirror camera" hint="Show the preview like a mirror" value={prefs.mirror !== false} onChange={(v) => save.mutate({ mirror: v })} />
      </Card>
      <Card>
        <div className="mb-1 font-semibold">Privacy</div>
        <p className="text-xs text-slate-400">Pose detection runs entirely on this device. Video frames are never uploaded. Only reps, timings and scores are sent to the server.</p>
      </Card>
      <Button
        variant="danger"
        className="w-full"
        onClick={() => {
          logout()
          qc.clear()
          nav('/', { replace: true })
        }}
      >
        Log out
      </Button>
    </div>
  )
}
