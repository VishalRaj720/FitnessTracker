import { NavLink, Outlet } from 'react-router-dom'
import { clsx } from 'clsx'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useOfflineQueueSync } from '@/features/workout/sync/useOfflineQueueSync'
import { useCompanionStatus } from '@/features/companion/CoachPage'

const TABS = [
  { to: '/home', label: 'Home', icon: HomeIcon },
  { to: '/exercises', label: 'Exercises', icon: DumbbellIcon },
  { to: '/coach', label: 'Coach', icon: CoachIcon, needsCompanion: true },
  { to: '/squad', label: 'Squad', icon: UsersIcon },
  { to: '/progress', label: 'Progress', icon: ChartIcon },
  { to: '/profile', label: 'Profile', icon: UserIcon },
]

export function AppShell() {
  const online = useOnlineStatus()
  const pending = useOfflineQueueSync()
  // With no API key configured the coach does not exist, so neither does its tab.
  const companion = useCompanionStatus()
  const tabs = TABS.filter((t) => !t.needsCompanion || companion.data?.enabled)
  return (
    <div className="mx-auto flex h-full max-w-md flex-col md:max-w-2xl lg:max-w-3xl">
      {(!online || pending > 0) && (
        <div className="bg-amber-500/15 px-4 py-1.5 text-center text-xs font-medium text-amber-300">
          {!online ? 'Offline — workouts still work; they sync when you are back.' : `Syncing ${pending} saved workout${pending > 1 ? 's' : ''}…`}
        </div>
      )}
      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-[calc(var(--safe-top)+16px)]">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-md justify-around md:max-w-2xl lg:max-w-3xl" style={{ paddingBottom: 'var(--safe-bottom)' }}>
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx('flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', isActive ? 'text-brand-400' : 'text-slate-500')
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

function CoachIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.3 9 9 0 0 1-3.3-.6L3 21l1.9-5.1A8.2 8.2 0 0 1 4 11.5C4 6.9 7.8 3.5 12.5 3.5S21 6.9 21 11.5z" />
    </svg>
  )
}
function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z" />
    </svg>
  )
}
function DumbbellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6v12M18 6v12M3 9v6M21 9v6M6 12h12" />
    </svg>
  )
}
function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-5-6.3" />
    </svg>
  )
}
function ChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  )
}
function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}
