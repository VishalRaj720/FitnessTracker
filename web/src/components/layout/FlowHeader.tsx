import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import { Logo } from '@/components/brand/Logo'
import { Icon } from '@/components/ui'

/**
 * Header for focused flows that live outside the tabbed app (onboarding, auth, the workout
 * preview): brand on the left, an optional centre slot, actions on the right.
 */
export function FlowHeader({
  center,
  right,
  tag,
  logoTo,
  width = 'max-w-7xl',
  className,
}: {
  center?: ReactNode
  right?: ReactNode
  tag?: string
  logoTo?: string
  width?: string
  className?: string
}) {
  return (
    <header
      className={clsx('sticky top-0 z-40 w-full border-b border-line bg-ink-950/80 backdrop-blur-md', className)}
      style={{ paddingTop: 'var(--safe-top)' }}
    >
      <div className={clsx('mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-6', width)}>
        <Logo to={logoTo} tag={tag} />
        {center && <div className="hidden min-w-0 flex-1 justify-center md:flex">{center}</div>}
        <div className="flex items-center gap-3">{right}</div>
      </div>
    </header>
  )
}

/** Slim footer for flows: brand, copyright and the privacy promise, no dead links. */
export function FlowFooter({ width = 'max-w-7xl' }: { width?: string }) {
  return (
    <footer className="relative z-10 mt-auto w-full border-t border-line bg-ink-950/90 py-7">
      <div className={clsx('mx-auto flex flex-col items-center justify-between gap-4 px-6 text-xs text-slate-500 sm:flex-row', width)}>
        <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-4 sm:text-left">
          <span className="text-sm font-bold text-white">FitSathi</span>
          <span className="hidden text-slate-700 sm:inline">|</span>
          <span>© {new Date().getFullYear()} FitSathi · Built for campus fitness.</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.1em]">
          <span className="flex items-center gap-1.5">
            <Icon name="lock" size={12} /> Video stays on device
          </span>
          <span>Works offline</span>
          <span>Campus stats k-anonymous</span>
        </div>
      </div>
    </footer>
  )
}
