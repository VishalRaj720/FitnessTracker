import { clsx } from 'clsx'

/**
 * Fixed ambient background behind a screen. Each variant is lifted from a reference:
 *   dots   — the dashboard's dot matrix with teal/cyan glow orbs
 *   grid   — onboarding's 40px line grid with an indigo glow over the headline
 *   radial — the campus step's dot field under a soft indigo halo
 *   tech   — the welcome screen's fine telemetry grid
 */
export function Backdrop({ variant = 'dots' }: { variant?: 'dots' | 'grid' | 'radial' | 'tech' }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {variant === 'dots' && (
        <>
          <div className="absolute inset-0 bg-dot-grid opacity-70" />
          <div className="absolute -top-24 left-1/4 h-[480px] w-[640px] rounded-full bg-aqua/[0.05] blur-[140px]" />
          <div className="absolute bottom-0 right-0 h-[520px] w-[520px] rounded-full bg-pulse/[0.04] blur-[160px]" />
        </>
      )}
      {variant === 'grid' && (
        <>
          <div className="absolute inset-0 bg-line-grid" />
          <div className="absolute left-1/2 top-0 h-[480px] w-[1000px] -translate-x-1/2 bg-[radial-gradient(circle_at_50%_15%,rgba(90,107,255,0.13)_0%,rgba(0,229,153,0.04)_45%,transparent_75%)]" />
        </>
      )}
      {variant === 'radial' && (
        <>
          <div className="absolute inset-0 bg-dot-grid opacity-40" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(90,107,255,0.09)_0%,transparent_60%)]" />
        </>
      )}
      {variant === 'tech' && <div className={clsx('absolute inset-0 bg-tech-grid')} />}
    </div>
  )
}
