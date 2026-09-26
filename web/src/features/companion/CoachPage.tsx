import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Alert, Button, Card, EmptyState, Icon, Input, KeyValue, MonoLabel, PageHeader, PanelHeader, Skeleton, Spinner } from '@/components/ui'
import { companionApi, useCompanionStatus, type CoachMessage, type SuggestedAction } from '@/features/companion/api'
import { useProgress, useTodayPlan } from '@/features/home/api'
import { errorMessage } from '@/lib/apiClient'

const STARTERS = ['How is my squat form trending?', 'What should I focus on today?', 'Why did my form score drop?', 'I keep missing days — help.']

export function CoachPage() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const status = useCompanionStatus()
  const thread = useQuery({
    queryKey: ['companion', 'thread'],
    queryFn: () => companionApi.thread(),
    enabled: status.data?.enabled === true,
  })
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [actions, setActions] = useState<SuggestedAction[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const send = useMutation({
    mutationFn: (message: string) => companionApi.chat(message),
    onSuccess: (res) => {
      setActions(res.suggested_actions)
      setPending(null)
      void qc.invalidateQueries({ queryKey: ['companion', 'thread'] })
    },
    onError: () => setPending(null),
  })

  const messages: CoachMessage[] = thread.data?.messages ?? []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages.length, pending])

  const submit = (text: string) => {
    const message = text.trim()
    if (!message || send.isPending) return
    setDraft('')
    setActions([])
    setPending(message)
    send.mutate(message)
  }

  const runAction = (a: SuggestedAction) => {
    if (a.kind === 'start_workout') nav('/home')
    else if (a.kind === 'open_progress') nav('/progress')
    else if (a.kind === 'open_tutorial' && a.slug) nav(`/exercises/${a.slug}/tutorial`)
    else nav('/exercises')
  }

  const header = (
    <PageHeader
      size="lg"
      badge={status.data?.enabled ? `Coach channel // ${status.data.provider}` : 'Coach channel // offline'}
      title="Coach"
      subtitle="Ask about your training, your form or your plan. It reads your numbers — never your video."
    />
  )

  if (status.isPending) {
    return (
      <div className="space-y-8">
        {header}
        <Skeleton className="h-[480px] rounded-xl" />
      </div>
    )
  }
  if (!status.data?.enabled) {
    return (
      <div className="space-y-8">
        {header}
        <EmptyState
          icon="message"
          title="The AI coach isn't configured on this server"
          body="Workouts still give you live form cues — those are built in and work offline. Ask your admin to add a Gemini API key to switch the coach on."
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {header}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card radius="xl" pad="none" className="flex min-h-[560px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line bg-ink-850/60 px-5 py-3 font-mono text-[11px] text-slate-400">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse-slow rounded-full bg-brand-400" />
              <span className="tracking-wider text-slate-300">COACH.SESSION</span>
            </span>
            {messages.length > 0 && (
              <button
                type="button"
                className="rounded px-2 py-0.5 text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
                onClick={async () => {
                  await companionApi.clearThread()
                  void qc.invalidateQueries({ queryKey: ['companion', 'thread'] })
                }}
              >
                CLEAR
              </button>
            )}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && !pending && (
              <div className="space-y-4">
                <div className="rounded-xl border border-line bg-ink-850/70 p-4">
                  <p className="text-sm leading-relaxed text-slate-300">I can see your streak, your plan and which form faults the camera has caught over the last month. Ask me about any of it.</p>
                  <p className="mt-2 font-mono text-[11px] text-slate-500">Only numbers leave your device — joint angles and workout totals. No video, ever.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submit(s)}
                      className="rounded-full border border-line bg-ink-850/60 px-3.5 py-1.5 text-left text-xs text-slate-300 transition hover:border-pulse/40 hover:text-white"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {thread.isPending && <Skeleton className="h-16 w-2/3" />}
            {messages.map((m) => (
              <Bubble key={m.id} role={m.role} text={m.content} />
            ))}
            {pending && <Bubble role="user" text={pending} />}
            {send.isPending && (
              <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                <Spinner className="h-3.5 w-3.5" /> coach is thinking…
              </div>
            )}
            {send.isError && <Alert>{errorMessage(send.error)}</Alert>}
            {actions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {actions.map((a, i) => (
                  <Button key={i} size="sm" variant="secondary" iconRight="arrow-right" onClick={() => runAction(a)}>
                    {a.label}
                  </Button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            className="flex gap-2 border-t border-line bg-ink-900/90 p-3"
            onSubmit={(e) => {
              e.preventDefault()
              submit(draft)
            }}
          >
            <Input big aria-label="Message your coach" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask your coach…" maxLength={1000} />
            <Button type="submit" variant="primary" size="lg" icon="send" disabled={!draft.trim() || send.isPending}>
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>
        </Card>

        <CoachContext />
      </div>
    </div>
  )
}

/** What the coach is working from — the same server-side numbers it gets in its prompt. */
function CoachContext() {
  const progress = useProgress()
  const plan = useTodayPlan()
  const p = progress.data
  return (
    <Card radius="xl" pad="md" className="lg:sticky lg:top-24">
      <PanelHeader kicker="Context the coach sees" kickerDot="pulse" title="Your numbers" />
      {p ? (
        <div className="divide-y divide-line">
          <KeyValue k="Streak" v={`${p.streak.current} days (best ${p.streak.longest})`} tone={p.streak.current ? 'flame' : undefined} />
          <KeyValue k="This week" v={`${p.this_week.days_done}/${p.this_week.target_days} days`} />
          <KeyValue k="Verified" v={`${p.this_week.verified_minutes} min this week`} tone="brand" />
          <KeyValue k="Form traces" v={`${p.form_trend.filter((t) => t.points.length).length} exercises`} />
          <KeyValue k="Today's plan" v={plan.data ? `${plan.data.items.length} moves · ~${plan.data.estimated_minutes} min` : '—'} />
        </div>
      ) : (
        <Skeleton className="h-40 w-full" />
      )}
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-line bg-ink-850/70 p-3 text-[11px] leading-relaxed text-slate-400">
        <Icon name="lock" size={13} className="mt-0.5 shrink-0 text-slate-500" />
        <span>
          The coach never improvises medical or nutrition advice — injuries go to a doctor or physio, and food targets live on your <MonoLabel tone="brand">Nutrition</MonoLabel> tab.
        </span>
      </div>
    </Card>
  )
}

function Bubble({ role, text }: { role: 'user' | 'coach'; text: string }) {
  const mine = role === 'user'
  return (
    <div className={clsx('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">{mine ? 'You' : 'Coach'}</span>
      <div
        className={clsx(
          'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          mine ? 'rounded-tr-md bg-brand-500 text-ink-950' : 'rounded-tl-md border border-line bg-ink-850 text-slate-100',
        )}
      >
        {text}
      </div>
    </div>
  )
}
