import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Chip, Input, Label, PageTitle } from '@/components/ui'
import { api, errorMessage } from '@/lib/apiClient'
import { GOAL_LABEL, LEVEL_LABEL } from '@/lib/format'
import { useAuthStore } from '@/features/auth/authStore'
import type { Goal, InstituteBrief, Level, ProfileIn, User } from '@/types/api'

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

export function OnboardingPage({ edit = false }: { edit?: boolean }) {
  const nav = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [step, setStep] = useState(0)

  const [goal, setGoal] = useState<Goal>(user?.profile?.goal ?? 'general')
  const [level, setLevel] = useState<Level>(user?.profile?.level ?? 'beginner')
  const [minutes, setMinutes] = useState(user?.profile?.minutes_per_session ?? 15)
  const [days, setDays] = useState(user?.profile?.days_per_week ?? 4)
  const [instituteQ, setInstituteQ] = useState(user?.institute?.name ?? '')
  const [institute, setInstitute] = useState<InstituteBrief | null>(user?.institute ?? null)
  const [department, setDepartment] = useState(user?.department ?? '')
  const [hostel, setHostel] = useState(user?.hostel ?? '')

  const search = useQuery({
    queryKey: ['institutes', instituteQ],
    queryFn: () => api<InstituteBrief[]>(`/institutes?q=${encodeURIComponent(instituteQ)}`, { auth: false }),
    enabled: instituteQ.length >= 2 && (!institute || institute.name !== instituteQ),
  })

  const save = useMutation({
    mutationFn: (body: ProfileIn) => api<User>('/users/me/profile', { method: 'PUT', body }),
    onSuccess: (u) => {
      setUser(u)
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['plan'] })
      nav('/home', { replace: true })
    },
  })

  useEffect(() => {
    if (!user) nav('/login', { replace: true })
  }, [user, nav])

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

  const steps = ['Goal', 'Time', 'Campus']

  return (
    <div className="mx-auto flex h-full max-w-md flex-col px-4 pb-6 pt-[calc(var(--safe-top)+16px)]">
      <PageTitle title={edit ? 'Update your plan settings' : `Hi ${user?.name?.split(' ')[0] ?? ''}, let's set you up`} subtitle={`Step ${step + 1} of 3 · ${steps[step]}`} />
      <div className="mb-4 flex gap-1.5">
        {steps.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand-500' : 'bg-slate-800'}`} />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <Card>
            <Label>What's your goal?</Label>
            <div className="space-y-2">
              {GOALS.map((g) => (
                <OptionRow key={g.v} active={goal === g.v} onClick={() => setGoal(g.v)} title={GOAL_LABEL[g.v]} hint={g.hint} />
              ))}
            </div>
          </Card>
          <Card>
            <Label>Your level today</Label>
            <div className="space-y-2">
              {LEVELS.map((l) => (
                <OptionRow key={l.v} active={level === l.v} onClick={() => setLevel(l.v)} title={LEVEL_LABEL[l.v]} hint={l.hint} />
              ))}
            </div>
          </Card>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <Card>
            <Label>Minutes per workout</Label>
            <div className="flex flex-wrap gap-2">
              {[10, 15, 20, 30].map((m) => (
                <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)}>
                  {m} min
                </Chip>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">The plan fits sets and rest into this budget.</p>
          </Card>
          <Card>
            <Label>Days per week</Label>
            <div className="flex flex-wrap gap-2">
              {[3, 4, 5, 6].map((d) => (
                <Chip key={d} active={days === d} onClick={() => setDays(d)}>
                  {d} days
                </Chip>
              ))}
            </div>
          </Card>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <Label>Your institute</Label>
            <Input
              value={instituteQ}
              onChange={(e) => {
                setInstituteQ(e.target.value)
                setInstitute(null)
              }}
              placeholder="Search by name (e.g. NIT)"
            />
            {!institute && search.data && search.data.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-800">
                {search.data.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    className="block w-full border-b border-slate-800 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-800"
                    onClick={() => {
                      setInstitute(i)
                      setInstituteQ(i.name)
                    }}
                  >
                    <div className="font-medium">{i.name}</div>
                    <div className="text-xs text-slate-400">
                      {i.city}, {i.state}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {institute && <div className="mt-2 text-xs text-brand-300">✓ {institute.name}</div>}
            <p className="mt-2 text-xs text-slate-500">Powers your campus leaderboard and Fit India dashboard. Optional.</p>
          </Card>
          <Card className="space-y-3">
            <div>
              <Label>Department</Label>
              <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="CSE, ECE, MECH…" maxLength={80} />
            </div>
            <div>
              <Label>Hostel (optional)</Label>
              <Input value={hostel} onChange={(e) => setHostel(e.target.value)} placeholder="Block C" maxLength={80} />
            </div>
          </Card>
        </div>
      )}

      {save.isError && (
        <div className="mt-3">
          <Alert>{errorMessage(save.error)}</Alert>
        </div>
      )}

      <div className="mt-auto flex gap-2 pt-4">
        {step > 0 ? (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : edit ? (
          <Button variant="secondary" onClick={() => nav(-1)}>
            Cancel
          </Button>
        ) : null}
        {step < 2 ? (
          <Button className="flex-1" size="lg" onClick={() => setStep(step + 1)}>
            Next
          </Button>
        ) : (
          <Button className="flex-1" size="lg" onClick={submit} loading={save.isPending}>
            {edit ? 'Save' : 'Build my first plan'}
          </Button>
        )}
      </div>
    </div>
  )
}

function OptionRow({ active, onClick, title, hint }: { active: boolean; onClick: () => void; title: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${active ? 'border-brand-400 bg-brand-500/10' : 'border-slate-700 bg-slate-900'}`}
    >
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-xs text-slate-400">{hint}</div>
      </div>
      <span className={`h-4 w-4 rounded-full border-2 ${active ? 'border-brand-400 bg-brand-400' : 'border-slate-600'}`} />
    </button>
  )
}
