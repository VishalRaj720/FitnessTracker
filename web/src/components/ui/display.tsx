import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import { Icon, type IconName } from '@/components/ui/icons'
import { MonoLabel, StatusPill } from '@/components/ui/primitives'
import { TONE_BG, TONE_GLOW, TONE_STROKE, TONE_TEXT, type Tone } from '@/components/ui/styles'

// ---------------------------------------------------------------------------------------------
// Headings

/**
 * Page hero: status badge, heavy display title, muted subtitle, actions on the right.
 * Mirrors the headline block every reference screen opens with.
 */
export function PageHeader({
  badge,
  badgeTone = 'pulse',
  title,
  subtitle,
  right,
  size = 'md',
  className,
}: {
  badge?: ReactNode
  badgeTone?: Tone
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <div className={clsx('flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0 max-w-3xl space-y-3">
        {badge && (
          <StatusPill tone={badgeTone} mono pulse={false} shape="tag">
            {badge}
          </StatusPill>
        )}
        <h1
          className={clsx(
            'font-extrabold tracking-tight text-white',
            size === 'lg' && 'text-3xl leading-[1.1] sm:text-4xl lg:text-5xl',
            size === 'md' && 'text-2xl leading-tight sm:text-3xl',
            size === 'sm' && 'text-xl leading-tight sm:text-2xl',
          )}
        >
          {title}
        </h1>
        {subtitle && <p className="max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">{subtitle}</p>}
      </div>
      {right && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{right}</div>}
    </div>
  )
}

/** Compact heading kept for dev tools and small pages. */
export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return <PageHeader title={title} subtitle={subtitle} right={right} size="sm" className="mb-5" />
}

/** "// SECTION NAME ............ meta" row that sits above a group of cards. */
export function SectionHeader({ label, meta, dot, className }: { label: ReactNode; meta?: ReactNode; dot?: Tone; className?: string }) {
  return (
    <div className={clsx('flex items-center justify-between gap-3 px-0.5', className)}>
      <MonoLabel dot={dot}>{label}</MonoLabel>
      {meta && <span className="font-mono text-[10.5px] text-slate-500">{meta}</span>}
    </div>
  )
}

/** Card header: small mono kicker over a bold title, meta on the right, hairline below. */
export function PanelHeader({
  kicker,
  kickerDot,
  title,
  right,
  divider = true,
  className,
}: {
  kicker?: ReactNode
  kickerDot?: Tone
  title?: ReactNode
  right?: ReactNode
  divider?: boolean
  className?: string
}) {
  return (
    <div className={clsx('flex flex-wrap items-start justify-between gap-3', divider && 'mb-4 border-b border-line pb-4', !divider && 'mb-4', className)}>
      <div className="min-w-0 space-y-1">
        {kicker && <MonoLabel dot={kickerDot}>{kicker}</MonoLabel>}
        {title && <h2 className="text-base font-bold tracking-tight text-white sm:text-lg">{title}</h2>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Numbers

/** Telemetry stat tile: mono caption, big mono number with unit, a coloured footnote. */
export function Stat({
  label,
  value,
  unit,
  hint,
  hintTone = 'slate',
  tone,
  icon,
  className,
}: {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  hint?: ReactNode
  hintTone?: Tone
  tone?: Tone
  icon?: IconName
  className?: string
}) {
  return (
    <div className={clsx('rounded-xl border border-line bg-ink-850/80 p-3.5 sm:p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <MonoLabel className="text-slate-500">{label}</MonoLabel>
        {icon && <Icon name={icon} size={14} className={tone ? TONE_TEXT[tone] : 'text-slate-500'} />}
      </div>
      <div className={clsx('mt-1.5 font-mono text-2xl font-bold tracking-tight tabular-nums', tone ? TONE_TEXT[tone] : 'text-white')}>
        {value}
        {unit && <span className="ml-1 font-sans text-xs font-normal text-slate-400">{unit}</span>}
      </div>
      {hint && <div className={clsx('mt-1 font-mono text-[11px]', hintTone === 'slate' ? 'text-slate-500' : TONE_TEXT[hintTone])}>{hint}</div>}
    </div>
  )
}

/** Linear meter. Over-target values stay full and switch to amber so "over" is visible. */
export function ProgressBar({
  value,
  max,
  tone = 'brand',
  glow = true,
  size = 'md',
  className,
  label,
}: {
  value: number
  max: number
  tone?: Tone
  glow?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const over = max > 0 && value > max * 1.05
  const t: Tone = over ? 'flame' : tone
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
      className={clsx('w-full overflow-hidden rounded-full border border-line bg-ink-950/80', size === 'sm' ? 'h-1' : size === 'md' ? 'h-1.5' : 'h-2.5', className)}
    >
      <div className={clsx('h-full rounded-full transition-[width] duration-500', TONE_BG[t], glow && pct > 0 && TONE_GLOW[t])} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** A row of equal segments, `filled` of them lit (step progress, days this week). */
export function SegmentBar({
  total,
  filled,
  current,
  tone = 'iris',
  className,
  height = 'h-1.5',
}: {
  total: number
  filled: number
  current?: number
  tone?: Tone
  className?: string
  height?: string
}) {
  return (
    <div className={clsx('grid gap-2', className)} style={{ gridTemplateColumns: `repeat(${Math.max(1, total)}, minmax(0, 1fr))` }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={clsx(
            'rounded-full transition-colors duration-300',
            height,
            i < filled ? TONE_BG[tone] : 'bg-white/[0.08]',
            (current === i || (current === undefined && i === filled - 1)) && i < filled && TONE_GLOW[tone],
          )}
        />
      ))}
    </div>
  )
}

/** Circular meter with arbitrary centre content. */
export function Ring({
  value,
  max,
  size = 120,
  stroke = 10,
  tone = 'brand',
  track = '#1c2230',
  children,
  className,
}: {
  value: number
  max: number
  size?: number
  stroke?: number
  tone?: Tone
  track?: string
  children?: ReactNode
  className?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, value / max) : 0
  const over = max > 0 && value > max * 1.05
  const color = TONE_STROKE[over ? 'flame' : tone]
  return (
    <div className={clsx('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {pct > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${pct * c} ${c}`}
          style={{ filter: `drop-shadow(0 0 6px ${color}88)`, transition: 'stroke-dasharray 0.6s ease' }}
        />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// States

export function EmptyState({
  title,
  body,
  action,
  icon = 'sparkles',
  tone = 'pulse',
  flat,
  className,
}: {
  title: string
  body?: ReactNode
  action?: ReactNode
  icon?: IconName
  tone?: Tone
  /** Inside another card: dashed outline, no fill or shadow. */
  flat?: boolean
  className?: string
}) {
  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl px-6 py-10 text-center',
        flat ? 'border border-dashed border-line' : 'border border-line bg-ink-900/80 shadow-card',
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-pulse/5 blur-3xl" />
      <div className="relative mx-auto flex max-w-lg flex-col items-center gap-3">
        <span className={clsx('flex h-12 w-12 items-center justify-center rounded-full border border-line-strong bg-ink-800 shadow-inner', TONE_TEXT[tone])}>
          <Icon name={icon} size={22} strokeWidth={1.8} />
        </span>
        <h3 className="text-lg font-bold tracking-tight text-white sm:text-xl">{title}</h3>
        {body && <p className="text-sm leading-relaxed text-slate-400">{body}</p>}
        {action && <div className="pt-1">{action}</div>}
      </div>
    </div>
  )
}

/**
 * The FSSAI-style food mark Indian packaging uses: a green square-dot for vegetarian and
 * vegan, a brown one for non-vegetarian, amber for egg.
 */
export function DietMark({ diet, size = 'md', className }: { diet: string; size?: 'sm' | 'md'; className?: string }) {
  const color = diet === 'non_veg' ? '#b45309' : diet === 'egg' ? '#f59e0b' : '#16a34a'
  const label = diet === 'non_veg' ? 'Non-vegetarian' : diet === 'egg' ? 'Contains egg' : diet === 'vegan' ? 'Vegan' : 'Vegetarian'
  return (
    <span
      title={label}
      aria-label={label}
      role="img"
      className={clsx('inline-flex shrink-0 items-center justify-center rounded-[3px] border-[1.5px]', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5', className)}
      style={{ borderColor: color }}
    >
      <span className={clsx('rounded-full', size === 'sm' ? 'h-1 w-1' : 'h-1.5 w-1.5')} style={{ background: color }} />
    </span>
  )
}

/** Mono key/value row used in telemetry summaries. */
export function KeyValue({ k, v, tone }: { k: ReactNode; v: ReactNode; tone?: Tone }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-slate-500">{k}</span>
      <span className={clsx('text-right font-mono text-xs tabular-nums', tone ? TONE_TEXT[tone] : 'text-slate-200')}>{v}</span>
    </div>
  )
}
