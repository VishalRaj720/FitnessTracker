import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { useSessionStore } from '@/features/workout/store/sessionStore'
import { fmtClock } from '@/lib/format'

/** Big rep counter; subscribes only to `live.reps` so it re-renders per rep, not per frame. */
export function RepCounter({ target }: { target: number }) {
  const reps = useSessionStore((s) => s.live.reps)
  const [pop, setPop] = useState(false)
  useEffect(() => {
    if (reps === 0) return
    setPop(true)
    const id = setTimeout(() => setPop(false), 260)
    return () => clearTimeout(id)
  }, [reps])
  return (
    <div className="flex items-end gap-2">
      <div className={clsx('font-mono text-7xl font-bold leading-none tabular-nums', pop && 'pop', reps >= target && target > 0 ? 'text-brand-400' : 'text-white')}>{reps}</div>
      <div className="mb-2 font-mono text-xl font-semibold text-slate-500">/ {target}</div>
    </div>
  )
}

export function HoldTimerDisplay({ targetSeconds }: { targetSeconds: number }) {
  const heldMs = useSessionStore((s) => s.live.heldMs)
  const inTol = useSessionStore((s) => s.live.inTolerance)
  const held = Math.floor(heldMs / 1000)
  return (
    <div className="flex items-end gap-2">
      <div className={clsx('font-mono text-6xl font-bold leading-none tabular-nums', held >= targetSeconds ? 'text-brand-400' : inTol ? 'text-white' : 'text-flame')}>{fmtClock(held)}</div>
      <div className="mb-1.5 font-mono text-lg font-semibold text-slate-500">/ {fmtClock(targetSeconds)}</div>
    </div>
  )
}

export function PhaseRing() {
  const phase = useSessionStore((s) => s.live.phase)
  const label = phase === 'BOTTOM' ? 'DOWN' : phase === 'GOING_DOWN' ? '↓' : phase === 'GOING_UP' ? '↑' : 'UP'
  return (
    <div
      className={clsx(
        'flex h-14 w-14 items-center justify-center rounded-full border-4 font-mono text-xs font-bold transition-colors',
        phase === 'BOTTOM' ? 'border-brand-400 bg-brand-500/20 text-brand-300' : phase === 'TOP' ? 'border-ink-600 text-slate-300' : 'border-pulse text-pulse',
      )}
    >
      {label}
    </div>
  )
}

export function FormScoreRing() {
  const score = useSessionStore((s) => s.live.formScore)
  const r = 24
  const c = 2 * Math.PI * r
  const dash = (score / 100) * c
  const tone = score >= 85 ? '#00e599' : score >= 65 ? '#ffb800' : '#fb7185'
  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={r} stroke="#1c2230" strokeWidth="6" fill="none" />
        <circle cx="32" cy="32" r={r} stroke={tone} strokeWidth="6" fill="none" strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round" />
      </svg>
      <div className="text-center">
        <div className="font-mono text-base font-bold leading-none">{score}</div>
        <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-400">form</div>
      </div>
    </div>
  )
}

export function CueBanner() {
  const cue = useSessionStore((s) => s.live.cue)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!cue) return
    setVisible(true)
    // A coach line is a sentence, not a shout: give it long enough to actually read.
    const id = setTimeout(() => setVisible(false), cue.tone === 'correction' ? 2400 : cue.tone === 'coach' ? 3600 : 1200)
    return () => clearTimeout(id)
  }, [cue])
  if (!cue || !visible) return null
  if (cue.tone === 'count') return null // the big counter already shows it
  return (
    <div
      className={clsx(
        'pointer-events-none rounded-2xl px-5 py-3 text-center text-2xl font-extrabold shadow-lg',
        cue.tone === 'correction' && 'bg-rose-500 text-white',
        cue.tone === 'praise' && 'bg-brand-400 text-ink-950 shadow-glow-signal',
        cue.tone === 'info' && 'border border-line bg-ink-800/90 text-slate-100',
        cue.tone === 'coach' && 'bg-pulse text-ink-950 shadow-glow-pulse',
      )}
    >
      {cue.text}
    </div>
  )
}

export function GatedOverlay() {
  const gated = useSessionStore((s) => s.live.gated)
  if (!gated) return null
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink-950/50">
      <div className="rounded-xl bg-flame px-4 py-2 text-base font-bold text-ink-950">Step back into view</div>
    </div>
  )
}

/**
 * Render rate and inference rate are shown separately on purpose: the overlay runs its own
 * loop, so these two numbers diverging (60 render / 24 cv) is the pipeline working correctly.
 */
export function FpsBadge() {
  const fps = useSessionStore((s) => s.live.fps)
  const renderFps = useSessionStore((s) => s.live.renderFps)
  const inf = useSessionStore((s) => s.live.inferenceMs)
  const tier = useSessionStore((s) => s.live.tier)
  return (
    <div className="rounded-md border border-line bg-ink-950/70 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-slate-300">
      {renderFps} render · {fps} cv · {inf} ms · <span className={clsx(tier === 'low' && 'text-flame', tier === 'high' && 'text-brand-300')}>{tier}</span>
    </div>
  )
}
