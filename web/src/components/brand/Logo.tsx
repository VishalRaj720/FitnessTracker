import { useId } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'

/** The bolt mark in a gradient-ringed obsidian tile (emerald → cyan → iris). */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const gid = useId().replace(/:/g, '')
  return (
    <span
      className={clsx('relative inline-flex shrink-0 rounded-lg bg-gradient-to-br from-brand-400 via-pulse to-iris-500 p-px shadow-[0_0_18px_-6px_rgba(0,242,254,0.6)]', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="flex h-full w-full items-center justify-center rounded-[7px] bg-ink-900">
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <defs>
            <linearGradient id={`fs-bolt-${gid}`} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#00e599" />
              <stop offset="1" stopColor="#00f2fe" />
            </linearGradient>
          </defs>
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" stroke={`url(#fs-bolt-${gid})`} />
        </svg>
      </span>
    </span>
  )
}

/** Mark + wordmark, with an optional mono edition tag and a live status dot. */
export function Logo({
  to,
  tag,
  live,
  size = 'md',
  className,
}: {
  to?: string
  tag?: string
  live?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const content = (
    <>
      <LogoMark size={size === 'lg' ? 36 : size === 'sm' ? 28 : 32} />
      <span className={clsx('flex items-center gap-1.5 font-bold tracking-tight text-white', size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-base' : 'text-lg')}>
        FitSathi
        {live && <span className="h-1.5 w-1.5 animate-pulse-slow rounded-full bg-brand-400" />}
      </span>
      {tag && (
        <span className="hidden whitespace-nowrap rounded border border-line bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400 sm:inline">
          {tag}
        </span>
      )}
    </>
  )
  const cls = clsx('group flex items-center gap-2.5', className)
  return to ? (
    <Link to={to} className={cls} aria-label="FitSathi home">
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  )
}
