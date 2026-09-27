import { Link, NavLink, Outlet } from 'react-router-dom'
import { clsx } from 'clsx'
import { Logo } from '@/components/brand/Logo'
import { Backdrop } from '@/components/layout/Backdrop'
import { Icon, type IconName } from '@/components/ui'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useOfflineQueueSync } from '@/features/workout/sync/useOfflineQueueSync'
import { useCompanionStatus } from '@/features/companion/api'
import { useAuthStore } from '@/features/auth/authStore'
import { useMe } from '@/features/auth/api'
import { firstName, greeting, initials } from '@/lib/people'

interface NavItem {
  to: string
  label: string
  short?: string
  icon: IconName
  needsCompanion?: boolean
}

const NAV: NavItem[] = [
  { to: '/home', label: 'Overview', short: 'Home', icon: 'home' },
  { to: '/exercises', label: 'Exercises', icon: 'dumbbell' },
  { to: '/nutrition', label: 'Nutrition', icon: 'apple' },
  { to: '/squad', label: 'Squad', icon: 'users' },
  { to: '/progress', label: 'Progress', icon: 'chart' },
  { to: '/coach', label: 'Coach', icon: 'message', needsCompanion: true },
]

/** The five destinations that fit a phone's bottom bar; Coach and Profile live in the header. */
const MOBILE_TABS = NAV.filter((n) => !n.needsCompanion)

export function AppShell() {
  const online = useOnlineStatus()
  const pending = useOfflineQueueSync()
  useMe()
  const user = useAuthStore((s) => s.user)
  // With no API key configured the coach does not exist, so neither does its tab.
  const companion = useCompanionStatus()
  const nav = NAV.filter((t) => !t.needsCompanion || companion.data?.enabled)
  const streak = user?.stats.current_streak ?? 0

  return (
    <div className="relative min-h-full">
      <Backdrop variant="dots" />

      <header className="sticky top-0 z-40 border-b border-line bg-ink-950/85 backdrop-blur-md" style={{ paddingTop: 'var(--safe-top)' }}>
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-6 md:h-16 lg:px-10">
          <Logo to="/home" tag="v0.1 // beta" />

          <nav aria-label="Primary" className="ml-2 hidden h-full items-stretch gap-1 border-l border-line pl-4 md:flex lg:ml-4 lg:pl-6">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx('relative flex items-center gap-1.5 whitespace-nowrap px-3 text-[13px] font-medium transition-colors', isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200')
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-pulse" />
                        <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-pulse shadow-[0_0_10px_rgba(0,242,254,0.6)]" />
                      </>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <SystemChip online={online} pending={pending} />
            <div className="flex items-center gap-2 rounded-lg border border-line bg-ink-900 px-2.5 py-1.5" title={`${streak}-day streak`}>
              <Icon name="flame" size={15} className={clsx(streak > 0 ? 'text-flame' : 'text-slate-500')} />
              <span className="font-mono text-xs font-semibold tabular-nums text-white">{streak}</span>
              <span className="hidden h-3 w-px bg-white/15 xl:block" />
              <span className="hidden whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400 xl:block">day streak</span>
            </div>
            {companion.data?.enabled && (
              <Link to="/coach" aria-label="Coach" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-ink-800 hover:text-white md:hidden">
                <Icon name="message" size={18} />
              </Link>
            )}
            <Link to="/profile" className="group flex items-center gap-3 border-l border-line pl-3" aria-label="Your profile">
              <div className="hidden whitespace-nowrap text-right lg:block">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">{greeting()}</div>
                <div className="flex items-center justify-end gap-1.5 text-xs font-semibold tracking-tight text-white">
                  {firstName(user?.name, '')}
                  <span className="h-1.5 w-1.5 rounded-full bg-volt" />
                </div>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line-strong bg-gradient-to-tr from-ink-800 to-ink-700 font-mono text-xs font-bold text-pulse shadow-inner transition group-hover:border-pulse/60">
                {initials(user?.name)}
              </span>
            </Link>
          </div>
        </div>
        {(!online || pending > 0) && (
          <div className="border-t border-flame/20 bg-flame/10 px-4 py-1.5 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-amber-200">
            {!online ? 'Offline — workouts still work and sync when you are back' : `Syncing ${pending} saved workout${pending > 1 ? 's' : ''}…`}
          </div>
        )}
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 md:pb-14 lg:px-10 lg:pt-9">
        <Outlet />
      </main>

      <footer className="relative z-10 hidden border-t border-line py-6 md:block">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-6 font-mono text-xs text-slate-500 lg:px-10">
          <div className="flex items-center gap-3">
            <span className="font-semibold tracking-tight text-slate-200">FitSathi Engine</span>
            <span className="text-white/20">/</span>
            <span>On-device pose tracking · video never leaves your phone</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <span className={clsx('h-1.5 w-1.5 rounded-full', online ? 'bg-brand-400' : 'bg-flame')} />
              Sync: {online ? 'online' : 'offline'}
            </span>
            <Link to="/profile/settings" className="transition hover:text-white">
              Privacy model
            </Link>
            {user?.institute && (
              <Link to={`/campus/${user.institute.slug}`} className="transition hover:text-white">
                Campus dashboard
              </Link>
            )}
          </div>
        </div>
      </footer>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink-900/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <div className="mx-auto flex max-w-lg justify-around px-1">
          {MOBILE_TABS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx('relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors', isActive ? 'text-pulse' : 'text-slate-500 hover:text-slate-300')
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-pulse shadow-[0_0_10px_rgba(0,242,254,0.6)]" />}
                  <Icon name={item.icon} size={19} strokeWidth={isActive ? 2.2 : 2} />
                  <span className={clsx(isActive && 'font-semibold')}>{item.short ?? item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

/** Real system state in the dashboard's telemetry-chip style: where CV runs, and sync health. */
function SystemChip({ online, pending }: { online: boolean; pending: number }) {
  return (
    <div className="hidden items-center gap-2 whitespace-nowrap rounded-md border border-line bg-ink-900 px-3 py-1.5 font-mono text-[11px] text-slate-400 2xl:flex">
      <span className="h-2 w-2 animate-pulse-slow rounded-full bg-aqua" />
      <span>
        CV: <span className="text-white">ON-DEVICE</span>
      </span>
      <span className="text-white/20">|</span>
      <span>
        SYNC:{' '}
        <span className={online ? (pending > 0 ? 'text-flame' : 'text-brand-400') : 'text-flame'}>
          {!online ? 'OFFLINE' : pending > 0 ? `${pending} QUEUED` : 'LIVE'}
        </span>
      </span>
    </div>
  )
}
