import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { Alert, Button, ButtonLink, Icon, Input, ProgressBar, Segmented, Select, Skeleton, type IconName } from '@/components/ui'
import { useAuthStore } from '@/features/auth/authStore'
import { useMySquad, useProgress } from '@/features/home/api'
import { useCreateSquad, useJoinSquad, useLeaderboard, useLeaveSquad } from '@/features/squad/api'
import { errorMessage } from '@/lib/apiClient'
import { isoWeekLabel } from '@/lib/week'
import type { Leaderboard, LeaderboardRow, Squad } from '@/types/api'

type RankBy = 'minutes' | 'sessions' | 'form'

/** WHO's weekly activity guideline — the bar every squad member is measured against. */
const WEEKLY_TARGET_MIN = 150

function weekOffsetLabel(weeksAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - weeksAgo * 7)
  return isoWeekLabel(d)
}

export function SquadPage() {
  const user = useAuthStore((s) => s.user)
  const squad = useMySquad()
  const progress = useProgress()
  const [weeksAgo, setWeeksAgo] = useState(0)
  const [rankBy, setRankBy] = useState<RankBy>('minutes')
  const week = weeksAgo === 0 ? undefined : weekOffsetLabel(weeksAgo)
  const board = useLeaderboard(squad.data?.id, week)
  const createRef = useRef<HTMLInputElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  const s = squad.data
  const currentLabel = weekOffsetLabel(0)
  const [year, wk] = currentLabel.split('-W')

  const rows = useMemo(() => sortRows(board.data?.rows ?? [], rankBy), [board.data, rankBy])

  const exportCsv = () => {
    if (!board.data) return
    const lines = [['rank', 'name', 'verified_minutes', 'sessions', 'avg_form'].join(',')]
    rows.forEach((r, i) => lines.push([i + 1, `"${r.name.replace(/"/g, '""')}"`, r.verified_minutes, r.sessions, r.avg_form ?? ''].join(',')))
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fitsathi-${board.data.squad.name.replace(/\W+/g, '-').toLowerCase()}-${board.data.week}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onNav = (key: string) => {
    if (key === 'hub') setWeeksAgo(0)
    else if (key === 'history') setWeeksAgo(1)
    else if (key === 'board') boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const nav: { key: string; title: string; hint: string; active: boolean; to?: string; disabled?: boolean; badge?: string }[] = [
    {
      key: 'hub',
      title: 'Active hub & join',
      hint: s ? `${s.name} · ${s.member_count} member${s.member_count === 1 ? '' : 's'}` : 'Unpaired member state',
      active: weeksAgo === 0,
      badge: 'Active',
    },
    {
      key: 'board',
      title: 'Weekly leaderboard',
      hint: 'Verified minutes only',
      active: false,
      disabled: !s,
    },
    {
      key: 'history',
      title: 'Archive & history',
      hint: 'Past weekly seasons',
      active: weeksAgo > 0,
      disabled: !s,
    },
    {
      key: 'league',
      title: 'Campus league',
      hint: user?.institute ? `${user.institute.name} squads` : 'Add your institute in profile',
      active: false,
      to: user?.institute ? `/campus/${user.institute.slug}` : undefined,
      disabled: !user?.institute,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[256px_minmax(0,1fr)_300px]">
      {/* Left: squad context */}
      <aside className="flex flex-col overflow-hidden rounded-2xl border border-line bg-ink-900/60 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)]">
        <div className="border-b border-line p-5">
          <h1 className="mb-1.5 text-xl font-bold tracking-tight text-white">Squads</h1>
          <p className="text-xs leading-relaxed text-slate-400">Turn peer accountability into consistent, camera-verified weekly streaks.</p>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto p-3 lg:flex-1 lg:flex-col lg:overflow-y-auto" aria-label="Squad sections">
          {nav.map((n) => {
            const cls = clsx(
              'group flex min-w-[180px] items-start justify-between gap-2 rounded-lg border p-3 text-left transition lg:min-w-0',
              n.active ? 'border-line bg-ink-800/90' : 'border-transparent hover:border-line hover:bg-ink-900/60',
              n.disabled && 'pointer-events-none opacity-45',
            )
            const body = (
              <>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    {n.active && <span className="h-1.5 w-1.5 animate-pulse-slow rounded-full bg-pulse" />}
                    <span className={clsx('text-xs font-semibold tracking-wide', n.active ? 'text-white' : 'text-slate-300')}>{n.title}</span>
                  </div>
                  <p className={clsx('truncate text-[11px] text-slate-500', n.active && 'pl-3.5 text-slate-400')}>{n.hint}</p>
                </div>
                {n.active && n.badge && <span className="shrink-0 rounded border border-pulse/20 bg-pulse/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-pulse">{n.badge}</span>}
                {n.to && <Icon name="arrow-up-right" size={13} className="shrink-0 text-slate-500 group-hover:text-white" />}
              </>
            )
            return n.to ? (
              <Link key={n.key} to={n.to} className={cls}>
                {body}
              </Link>
            ) : (
              <button key={n.key} type="button" onClick={() => onNav(n.key)} disabled={n.disabled} className={cls}>
                {body}
              </button>
            )
          })}
        </nav>
        <div className="hidden border-t border-line p-4 lg:block">
          <Button
            variant="iris"
            size="md"
            block
            icon="plus"
            disabled={!!s}
            title={s ? 'Leave your current squad to create a new one' : undefined}
            onClick={() => createRef.current?.focus()}
          >
            Create new squad
          </Button>
        </div>
      </aside>

      {/* Centre: the squad itself */}
      <main className="min-w-0">
        <div className="mb-8 flex items-center justify-between border-b border-line/80 pb-5 font-mono text-xs text-slate-400">
          <div className="flex min-w-0 items-center gap-2.5">
            <Icon name="file" size={16} className="shrink-0" />
            <span className="truncate tracking-wider text-slate-300">SQD-{s ? s.invite_code : 'UNPAIRED'}-{year}.hub</span>
          </div>
          <span className="shrink-0 text-slate-500">{week ? `Viewing ${week}` : `Mode ${s ? 'live' : 'join'}`}</span>
        </div>

        <div className="mx-auto w-full max-w-3xl space-y-6">
          <div className="flex flex-col justify-between gap-4 pb-2 md:flex-row md:items-end">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-white">{s ? s.name : 'Squad'}</h2>
              <p className="mt-1 text-sm text-slate-400">3–8 friends. Weekly leaderboard on verified minutes.</p>
            </div>
            <div className="shrink-0 text-left font-mono md:text-right">
              <div className={clsx('flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider md:justify-end', s ? 'text-brand-400' : 'text-pulse')}>
                <span className={clsx('h-2 w-2 rounded-full', s ? 'bg-brand-400' : 'bg-pulse')} />
                Status: {s ? 'Paired' : 'Unpaired'}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Week {Number(wk)}, {year} | Auto-verified season
              </p>
            </div>
          </div>

          {squad.isPending ? (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ) : squad.isError ? (
            <Alert title="Couldn't load your squad">{errorMessage(squad.error)}</Alert>
          ) : s ? (
            <PairedHub squad={s} board={board.data} rows={rows} pending={board.isPending} error={board.error} boardRef={boardRef} rankBy={rankBy} week={week} />
          ) : (
            <UnpairedHub createRef={createRef} />
          )}

          <div className="flex items-center justify-center gap-2.5 pt-3">
            <span className="rounded-md border border-line-strong bg-ink-800 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-300 shadow-sm">Tip</span>
            <p className="text-xs text-slate-400">Manual-mode minutes never count on the leaderboard.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
            <MetricCard
              label="Leaderboard target"
              value={WEEKLY_TARGET_MIN}
              unit="mins / wk"
              flag={
                <>
                  <Icon name="arrow-up" size={12} /> Verified
                </>
              }
              flagTone="text-pulse"
              bar={<ProgressBar value={progress.data?.this_week.verified_minutes ?? 0} max={WEEKLY_TARGET_MIN} tone="pulse" size="sm" label="Your verified minutes this week" />}
              foot={`You: ${progress.data?.this_week.verified_minutes ?? 0} verified min this week (WHO guideline: 150)`}
            />
            <MetricCard
              label="Anti-spoof protocol"
              value={100}
              unit="% camera-gated"
              flag={
                <>
                  <Icon name="check" size={12} /> Active gate
                </>
              }
              flagTone="text-brand-400"
              bar={<ProgressBar value={1} max={1} tone="brand" size="sm" glow={false} label="Camera gate" />}
              foot="Every leaderboard minute passed the on-device checks"
            />
          </div>
        </div>
      </main>

      {/* Right: verification rules & ranking */}
      <aside className="flex flex-col rounded-2xl border border-line bg-ink-900/60 lg:col-span-2 xl:sticky xl:top-24 xl:col-span-1 xl:max-h-[calc(100dvh-8rem)]">
        <div className="space-y-6 overflow-y-auto p-6">
          <div>
            <h3 className="text-base font-bold tracking-tight text-white">Configuration</h3>
            <p className="mt-0.5 text-xs text-slate-500">Verification rules &amp; ranking</p>
          </div>
          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Verification rules</div>
            <div className="space-y-2.5">
              <Rule icon="scan" title="Camera-tracked reps" hint="On-device pose, 33 landmarks" />
              <Rule icon="eye" title="Body in frame ≥ 60%" hint="Visibility gate on every set" />
              <Rule icon="target" title="≥ 60% of the target" hint="Half-done sets don't count" />
              <Rule icon="activity" title="Human-speed reps" hint="At most 3 reps per second" />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="cycle" className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Active cycle
            </label>
            <Select id="cycle" value={weeksAgo} onChange={(e) => setWeeksAgo(Number(e.target.value))} disabled={!s}>
              {[0, 1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? `Current week (W${wk})` : n === 1 ? `Previous week (${weekOffsetLabel(1).split('-')[1]})` : `${n} weeks ago (${weekOffsetLabel(n).split('-')[1]})`}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wider text-slate-400">Rank by</div>
            <Segmented<RankBy>
              value={rankBy}
              onChange={setRankBy}
              options={[
                { value: 'minutes', label: 'Minutes' },
                { value: 'sessions', label: 'Sessions' },
                { value: 'form', label: 'Form' },
              ]}
            />
            <p className="text-[11px] leading-tight text-slate-500">
              {rankBy === 'minutes'
                ? 'The official order: camera-verified minutes this cycle.'
                : rankBy === 'sessions'
                  ? 'Who showed up most often — every session counts once.'
                  : 'Average camera form score across the cycle’s sessions.'}
            </p>
          </div>
        </div>
        <div className="mt-auto space-y-2 border-t border-line bg-ink-900/90 p-6">
          {user?.institute ? (
            <ButtonLink to={`/campus/${user.institute.slug}`} variant="secondary" size="md" block icon="refresh">
              Discover campus squads
            </ButtonLink>
          ) : (
            <ButtonLink to="/profile/edit" variant="secondary" size="md" block icon="building">
              Link your institute
            </ButtonLink>
          )}
          <Button variant="iris" size="md" block icon="download" disabled={!board.data} onClick={exportCsv}>
            Export leaderboard
          </Button>
        </div>
      </aside>
    </div>
  )
}

function sortRows(rows: LeaderboardRow[], by: RankBy): LeaderboardRow[] {
  if (by === 'minutes') return rows
  const copy = [...rows]
  if (by === 'sessions') copy.sort((a, b) => b.sessions - a.sessions || b.verified_minutes - a.verified_minutes)
  else copy.sort((a, b) => (b.avg_form ?? -1) - (a.avg_form ?? -1) || b.verified_minutes - a.verified_minutes)
  return copy
}

function Rule({ icon, title, hint }: { icon: IconName; title: string; hint: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-ink-800/60 p-2.5">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-pulse text-ink-950" aria-hidden>
        <Icon name="check" size={12} strokeWidth={3} />
      </span>
      <div className="min-w-0 text-xs">
        <p className="flex items-center gap-1.5 font-medium text-slate-200">
          {title}
          <Icon name={icon} size={12} className="text-slate-500" />
        </p>
        <p className="text-[11px] text-slate-500">{hint}</p>
      </div>
    </div>
  )
}

function MetricCard({ label, value, unit, flag, flagTone, bar, foot }: { label: string; value: number; unit: string; flag: ReactNode; flagTone: string; bar: ReactNode; foot: string }) {
  return (
    <div className="space-y-2 rounded-xl border border-line bg-ink-900/40 p-5">
      <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">{label}</span>
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-2xl font-bold text-white">
          {value}
          <span className="ml-1 font-sans text-sm font-normal text-slate-400">{unit}</span>
        </div>
        <span className={clsx('flex items-center gap-1 font-mono text-xs', flagTone)}>{flag}</span>
      </div>
      <div className="pt-2">{bar}</div>
      <p className="text-[11px] text-slate-500">{foot}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------

function UnpairedHub({ createRef }: { createRef: RefObject<HTMLInputElement | null> }) {
  const create = useCreateSquad()
  const join = useJoinSquad()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  return (
    <>
      <section className="relative overflow-hidden rounded-xl border border-line bg-ink-900/80 p-8 shadow-2xl backdrop-blur-sm">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-pulse/5 blur-3xl" />
        <div className="relative mx-auto max-w-xl space-y-3 py-2 text-center">
          <span className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full border border-line-strong bg-ink-800 text-pulse shadow-inner">
            <Icon name="users" size={24} strokeWidth={1.8} />
          </span>
          <h3 className="text-xl font-bold tracking-tight text-white">You&apos;re not in a squad yet</h3>
          <p className="mx-auto max-w-lg text-sm leading-relaxed text-slate-400">Roommates, batchmates, hostel block — accountability works best with people who&apos;ll notice.</p>
        </div>
      </section>

      <div className="space-y-4">
        <section className="rounded-xl border border-line bg-ink-900/60 p-6 transition hover:border-line-strong">
          <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span className="h-1.5 w-1.5 rounded-sm bg-pulse" /> Join with a code
          </h4>
          <form
            className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault()
              if (code.length >= 4) join.mutate(code)
            }}
          >
            <div className="relative flex-1">
              <Input
                mono
                big
                aria-label="Invite code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                placeholder="E.G. DEMO42"
                maxLength={8}
                className="pr-16"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 font-mono text-[10px] uppercase tracking-widest text-slate-500 sm:inline">Code</span>
            </div>
            <Button type="submit" variant="primary" mono size="lg" iconRight="arrow-right" disabled={code.length < 4} loading={join.isPending}>
              Join
            </Button>
          </form>
          {join.isError && <Alert className="mt-3">{errorMessage(join.error)}</Alert>}
        </section>

        <section className="rounded-xl border border-line bg-ink-900/60 p-6 transition hover:border-line-strong">
          <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span className="h-1.5 w-1.5 rounded-sm bg-slate-500" /> Or create your own
          </h4>
          <form
            className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim().length >= 2) create.mutate(name)
            }}
          >
            <div className="relative flex-1">
              <Input ref={createRef} big aria-label="Squad name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Block C Beasts" maxLength={40} className="pr-16" />
              <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 font-mono text-[10px] uppercase tracking-widest text-slate-500 sm:inline">Name</span>
            </div>
            <Button type="submit" variant="secondary" mono size="lg" disabled={name.trim().length < 2} loading={create.isPending}>
              Create
            </Button>
          </form>
          {create.isError && <Alert className="mt-3">{errorMessage(create.error)}</Alert>}
        </section>
      </div>
    </>
  )
}

function PairedHub({
  squad,
  board,
  rows,
  pending,
  error,
  boardRef,
  rankBy,
  week,
}: {
  squad: Squad
  board: Leaderboard | undefined
  rows: LeaderboardRow[]
  pending: boolean
  error: unknown
  boardRef: RefObject<HTMLDivElement | null>
  rankBy: RankBy
  week: string | undefined
}) {
  const leave = useLeaveSquad()
  const [copied, setCopied] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const top = Math.max(1, ...rows.map((r) => (rankBy === 'sessions' ? r.sessions : rankBy === 'form' ? (r.avg_form ?? 0) : r.verified_minutes)))

  const share = async () => {
    const text = `Join my FitSathi squad "${squad.name}" with code ${squad.invite_code}`
    try {
      if (navigator.share) await navigator.share({ title: 'FitSathi squad', text })
      else {
        await navigator.clipboard.writeText(squad.invite_code)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    } catch {
      /* the user closed the share sheet */
    }
  }

  return (
    <>
      <section className="relative overflow-hidden rounded-xl border border-line bg-ink-900/80 p-6 shadow-2xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-400/5 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-slate-400">Invite code</div>
            <div className="font-mono text-3xl font-black tracking-[0.3em] text-white">{squad.invite_code}</div>
            <p className="mt-1 text-xs text-slate-400">
              {squad.member_count} of 12 spots used{squad.institute ? ` · ${squad.institute.name}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" icon={copied ? 'check' : 'copy'} onClick={share}>
              {copied ? 'Copied' : 'Share invite'}
            </Button>
          </div>
        </div>
      </section>

      <section ref={boardRef} className="scroll-mt-24 rounded-xl border border-line bg-ink-900/60 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span className="h-1.5 w-1.5 rounded-sm bg-pulse" /> Leaderboard · {board?.week ?? week ?? 'this week'}
          </h4>
          <span className="font-mono text-[11px] text-slate-500">Verified minutes — counted by the camera, not typed in</span>
        </div>
        {pending && (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
        {!!error && <Alert>{errorMessage(error)}</Alert>}
        {board && (
          <ol className="space-y-2">
            {rows.map((r, i) => {
              const metric = rankBy === 'sessions' ? r.sessions : rankBy === 'form' ? (r.avg_form ?? 0) : r.verified_minutes
              return (
                <li
                  key={r.user_id}
                  className={clsx(
                    'flex items-center gap-3 rounded-lg border p-3 transition',
                    r.is_me ? 'border-pulse/30 bg-pulse/[0.05]' : 'border-line bg-ink-850/70',
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono text-[11px] font-bold',
                      i === 0 ? 'bg-volt text-ink-950' : i === 1 ? 'bg-slate-300 text-ink-950' : i === 2 ? 'bg-flame/80 text-ink-950' : 'bg-ink-700 text-slate-300',
                    )}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <span className="truncate">{r.name}</span>
                      {r.is_me && <span className="shrink-0 rounded border border-pulse/25 bg-pulse/10 px-1.5 font-mono text-[10px] text-pulse">YOU</span>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <ProgressBar value={metric} max={top} tone={r.is_me ? 'pulse' : 'brand'} size="sm" glow={r.is_me} className="max-w-[240px]" />
                      <span className="shrink-0 font-mono text-[10px] text-slate-500">
                        {r.sessions} session{r.sessions === 1 ? '' : 's'}
                        {r.avg_form != null && ` · form ${Math.round(r.avg_form)}`}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-lg font-bold text-white">{r.verified_minutes}</div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-slate-500">min</div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <div className="flex justify-center">
        {confirmLeave ? (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] px-3 py-2 text-xs text-rose-200">
            Leave {squad.name}?
            <Button variant="danger" size="xs" loading={leave.isPending} onClick={() => leave.mutate()}>
              Leave
            </Button>
            <Button variant="ghost" size="xs" onClick={() => setConfirmLeave(false)}>
              Stay
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" icon="log-out" onClick={() => setConfirmLeave(true)}>
            Leave squad
          </Button>
        )}
      </div>
    </>
  )
}
