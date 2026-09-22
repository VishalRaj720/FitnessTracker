import { useState } from 'react'
import { Alert, Badge, Button, Card, EmptyState, Input, Label, PageTitle, Spinner } from '@/components/ui'
import { useMySquad } from '@/features/home/api'
import { useCreateSquad, useJoinSquad, useLeaderboard, useLeaveSquad } from '@/features/squad/api'
import { errorMessage } from '@/lib/apiClient'
import { previousWeekLabel } from '@/lib/week'

export function SquadPage() {
  const squad = useMySquad()
  const [week, setWeek] = useState<string | undefined>(undefined)
  const board = useLeaderboard(squad.data?.id, week)
  const leave = useLeaveSquad()
  const [copied, setCopied] = useState(false)

  if (squad.isPending) return <Spinner />
  if (!squad.data) return <NoSquad />

  const s = squad.data
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(s.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle title={s.name} subtitle={`${s.member_count} member${s.member_count === 1 ? '' : 's'}${s.institute ? ` · ${s.institute.name}` : ''}`} />

      <Card className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Invite code</div>
          <div className="font-mono text-2xl font-black tracking-widest">{s.invite_code}</div>
        </div>
        <Button size="sm" variant="secondary" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="font-semibold">Leaderboard</div>
            <div className="text-xs text-slate-400">Verified minutes only — counted by the camera, not typed in.</div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant={week ? 'ghost' : 'secondary'} onClick={() => setWeek(undefined)}>
              This week
            </Button>
            <Button size="sm" variant={week ? 'secondary' : 'ghost'} onClick={() => setWeek(previousWeekLabel())}>
              Last week
            </Button>
          </div>
        </div>
        {board.isPending && <Spinner />}
        {board.isError && <Alert>{errorMessage(board.error)}</Alert>}
        {board.data && (
          <ol className="divide-y divide-slate-800">
            {board.data.rows.map((r) => (
              <li key={r.user_id} className={`flex items-center gap-3 py-2.5 ${r.is_me ? 'rounded-lg bg-brand-500/10 px-2' : ''}`}>
                <div className={`w-7 text-center text-lg font-black ${r.rank === 1 ? 'text-amber-300' : r.rank === 2 ? 'text-slate-300' : r.rank === 3 ? 'text-orange-300' : 'text-slate-500'}`}>{r.rank}</div>
                <div className="flex-1">
                  <div className="font-medium">
                    {r.name} {r.is_me && <span className="text-xs text-brand-300">(you)</span>}
                  </div>
                  <div className="text-xs text-slate-400">
                    {r.sessions} session{r.sessions === 1 ? '' : 's'}
                    {r.avg_form != null && ` · form ${Math.round(r.avg_form)}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{r.verified_minutes}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">min</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <div className="text-center">
        <Button variant="ghost" size="sm" onClick={() => leave.mutate()} loading={leave.isPending}>
          Leave squad
        </Button>
      </div>
    </div>
  )
}

function NoSquad() {
  const create = useCreateSquad()
  const join = useJoinSquad()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  return (
    <div className="space-y-4">
      <PageTitle title="Squad" subtitle="3–8 friends. Weekly leaderboard on verified minutes." />
      <EmptyState title="You're not in a squad yet" body="Roommates, batchmates, hostel block — accountability works best with people who'll notice." />
      <Card className="space-y-2">
        <Label>Join with a code</Label>
        <div className="flex gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. DEMO42" maxLength={8} className="font-mono uppercase tracking-widest" />
          <Button onClick={() => join.mutate(code)} disabled={code.length < 4} loading={join.isPending}>
            Join
          </Button>
        </div>
        {join.isError && <Alert>{errorMessage(join.error)}</Alert>}
      </Card>
      <Card className="space-y-2">
        <Label>Or create your own</Label>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Block C Beasts" maxLength={40} />
          <Button onClick={() => create.mutate(name)} disabled={name.trim().length < 2} loading={create.isPending} variant="secondary">
            Create
          </Button>
        </div>
        {create.isError && <Alert>{errorMessage(create.error)}</Alert>}
      </Card>
      <div className="text-center text-xs text-slate-500">
        <Badge>Tip</Badge> Manual-mode minutes never count on the leaderboard.
      </div>
    </div>
  )
}
