import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Alert, Button, Card, Input, PageTitle, Spinner } from '@/components/ui'
import { companionApi, type CoachMessage, type SuggestedAction } from '@/features/companion/api'
import { errorMessage } from '@/lib/apiClient'

export function useCompanionStatus() {
  return useQuery({
    queryKey: ['companion', 'status'],
    queryFn: () => companionApi.status(),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

const STARTERS = [
  'How is my squat form trending?',
  'What should I focus on today?',
  'Why did my form score drop?',
  'I keep missing days — help.',
]

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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  if (status.isPending) return <Spinner />
  if (!status.data?.enabled) {
    return (
      <div className="space-y-4">
        <PageTitle title="Coach" />
        <Alert tone="info">
          The AI coach is not configured on this server. Workouts still give you live form cues — those
          are built in and work offline.
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageTitle
        title="Coach"
        subtitle="Ask about your training, form or plan"
        right={
          messages.length > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await companionApi.clearThread()
                void qc.invalidateQueries({ queryKey: ['companion', 'thread'] })
              }}
            >
              Clear
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 space-y-3">
        {messages.length === 0 && !pending && (
          <>
            <Card>
              <p className="text-sm text-slate-300">
                I can see your streak, your plan and which form faults the camera has caught over the
                last month. Ask me about any of it.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Only numbers leave your device — joint angles and workout totals. No video, ever.
              </p>
            </Card>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="rounded-full border border-slate-700 px-3 py-1.5 text-left text-xs text-slate-300 transition hover:border-slate-500"
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} text={m.content} />
        ))}
        {pending && <Bubble role="user" text={pending} />}
        {send.isPending && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Spinner className="h-3.5 w-3.5" /> thinking…
          </div>
        )}
        {send.isError && <Alert>{errorMessage(send.error)}</Alert>}

        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((a, i) => (
              <Button key={i} size="sm" variant="secondary" onClick={() => runAction(a)}>
                {a.label}
              </Button>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="sticky bottom-0 -mx-4 mt-3 flex gap-2 bg-slate-950/90 px-4 py-3 backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault()
          submit(draft)
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask your coach…"
          maxLength={1000}
        />
        <Button type="submit" disabled={!draft.trim() || send.isPending}>
          Send
        </Button>
      </form>
    </div>
  )
}

function Bubble({ role, text }: { role: 'user' | 'coach'; text: string }) {
  const mine = role === 'user'
  return (
    <div className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm',
          mine ? 'bg-brand-500 text-slate-950' : 'border border-slate-800 bg-slate-900 text-slate-100',
        )}
      >
        {text}
      </div>
    </div>
  )
}
