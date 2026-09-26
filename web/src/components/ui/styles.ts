import { clsx } from 'clsx'

/**
 * Class recipes shared by components and by the odd element that has to be styled like one
 * (a router <Link> that looks like a button). Every class is a literal so Tailwind can see it.
 */

export type Tone = 'brand' | 'iris' | 'pulse' | 'volt' | 'flame' | 'rose' | 'aqua' | 'slate'

export type ButtonVariant = 'primary' | 'signal' | 'aqua' | 'iris' | 'secondary' | 'outline' | 'ghost' | 'light' | 'danger'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export function buttonClass({
  variant = 'primary',
  size = 'md',
  mono = false,
  block = false,
}: { variant?: ButtonVariant; size?: ButtonSize; mono?: boolean; block?: boolean } = {}) {
  return clsx(
    'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
    mono && 'font-mono uppercase tracking-[0.12em]',
    block && 'w-full',
    {
      xs: 'h-7 rounded-md px-2.5 text-[11px]',
      sm: 'h-8 rounded-lg px-3 text-xs',
      md: 'h-10 rounded-lg px-4 text-sm',
      lg: 'h-12 rounded-xl px-6 text-sm',
      xl: 'h-14 rounded-xl px-6 text-base',
    }[size],
    {
      primary: 'bg-brand-500 text-ink-950 shadow-glow-brand hover:bg-brand-400',
      signal: 'bg-brand-400 text-ink-950 shadow-glow-signal hover:bg-brand-300',
      aqua: 'bg-aqua text-ink-950 shadow-glow-aqua hover:bg-white',
      iris: 'bg-iris-500 text-white shadow-glow-iris hover:bg-iris-400',
      secondary: 'border border-line bg-ink-800 text-slate-200 hover:border-line-strong hover:bg-ink-750 hover:text-white',
      outline: 'border border-line-strong bg-transparent text-slate-200 hover:bg-white/[0.05] hover:text-white',
      ghost: 'text-slate-400 hover:bg-white/[0.05] hover:text-white',
      light: 'bg-white text-ink-950 hover:bg-volt',
      danger: 'border border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 hover:text-white',
    }[variant],
  )
}

export const TONE_TEXT: Record<Tone, string> = {
  brand: 'text-brand-400',
  iris: 'text-iris-400',
  pulse: 'text-pulse',
  volt: 'text-volt',
  flame: 'text-flame',
  rose: 'text-rose-300',
  aqua: 'text-aqua',
  slate: 'text-slate-400',
}

export const TONE_BG: Record<Tone, string> = {
  brand: 'bg-brand-400',
  iris: 'bg-iris-500',
  pulse: 'bg-pulse',
  volt: 'bg-volt',
  flame: 'bg-flame',
  rose: 'bg-rose-400',
  aqua: 'bg-aqua',
  slate: 'bg-slate-500',
}

export const TONE_SOFT: Record<Tone, string> = {
  brand: 'border-brand-400/25 bg-brand-400/10 text-brand-300',
  iris: 'border-iris-500/30 bg-iris-500/10 text-iris-300',
  pulse: 'border-pulse/25 bg-pulse/[0.07] text-pulse',
  volt: 'border-volt/30 bg-volt/10 text-volt',
  flame: 'border-flame/30 bg-flame/10 text-flame',
  rose: 'border-rose-400/30 bg-rose-500/10 text-rose-300',
  aqua: 'border-aqua/30 bg-aqua/10 text-aqua',
  slate: 'border-line bg-ink-750 text-slate-300',
}

export const TONE_STROKE: Record<Tone, string> = {
  brand: '#00e599',
  iris: '#7c8aff',
  pulse: '#00f2fe',
  volt: '#d2ff00',
  flame: '#ffb800',
  rose: '#fb7185',
  aqua: '#00d2b4',
  slate: '#64748b',
}

export const TONE_GLOW: Record<Tone, string> = {
  brand: 'shadow-[0_0_10px_rgba(0,229,153,0.55)]',
  iris: 'shadow-[0_0_10px_rgba(90,107,255,0.6)]',
  pulse: 'shadow-[0_0_10px_rgba(0,242,254,0.55)]',
  volt: 'shadow-[0_0_10px_rgba(210,255,0,0.5)]',
  flame: 'shadow-[0_0_10px_rgba(255,184,0,0.5)]',
  rose: 'shadow-[0_0_10px_rgba(251,113,133,0.5)]',
  aqua: 'shadow-[0_0_10px_rgba(0,210,180,0.55)]',
  slate: '',
}
