import { useId, type ButtonHTMLAttributes, type ComponentProps, type HTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { clsx } from 'clsx'
import { Icon, type IconName } from '@/components/ui/icons'
import { buttonClass, TONE_BG, TONE_SOFT, TONE_TEXT, type ButtonSize, type ButtonVariant, type Tone } from '@/components/ui/styles'

// ---------------------------------------------------------------------------------------------
// Buttons

type ButtonLook = { variant?: ButtonVariant; size?: ButtonSize; mono?: boolean; block?: boolean }

export function Button({
  variant,
  size,
  mono,
  block,
  loading,
  icon,
  iconRight,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonLook & { loading?: boolean; icon?: IconName; iconRight?: IconName }) {
  return (
    <button type={type} className={clsx(buttonClass({ variant, size, mono, block }), className)} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner className="h-4 w-4" /> : icon && <Icon name={icon} size={size === 'xs' || size === 'sm' ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'xs' || size === 'sm' ? 14 : 16} />}
    </button>
  )
}

/** A router link that looks like a Button. */
export function ButtonLink({
  variant,
  size,
  mono,
  block,
  icon,
  iconRight,
  className,
  children,
  ...rest
}: LinkProps & ButtonLook & { icon?: IconName; iconRight?: IconName }) {
  return (
    <Link className={clsx(buttonClass({ variant, size, mono, block }), className)} {...rest}>
      {icon && <Icon name={icon} size={size === 'xs' || size === 'sm' ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'xs' || size === 'sm' ? 14 : 16} />}
    </Link>
  )
}

export function IconButton({
  icon,
  label,
  className,
  badge,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; badge?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={clsx(
        'relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-slate-400 transition hover:border-line hover:bg-ink-800 hover:text-white',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} />
      {badge && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-pulse" />}
    </button>
  )
}

// ---------------------------------------------------------------------------------------------
// Surfaces

type Pad = 'none' | 'sm' | 'md' | 'lg'
const PAD: Record<Pad, string> = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' }
type Surface = 'panel' | 'raised' | 'inset' | 'glass'
const SURFACE: Record<Surface, string> = {
  panel: 'bg-ink-900/85',
  raised: 'bg-ink-800',
  inset: 'bg-ink-950/70',
  glass: 'bg-ink-850/70 backdrop-blur-md',
}
type CardAccent = 'none' | 'pulse' | 'iris' | 'brand' | 'flame'
const CARD_BORDER: Record<CardAccent, string> = {
  none: 'border-line',
  pulse: 'border-pulse/25',
  iris: 'border-iris-500/30',
  brand: 'border-brand-400/30',
  flame: 'border-flame/30',
}

/**
 * The card every screen is built from: obsidian panel, hairline border, soft drop shadow.
 * `brackets` adds the cyan telemetry corner marks used on the hero cards.
 */
export function Card({
  pad = 'md',
  surface = 'panel',
  accent = 'none',
  brackets,
  radius = '2xl',
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { pad?: Pad; surface?: Surface; accent?: CardAccent; brackets?: boolean; radius?: 'xl' | '2xl' }) {
  return (
    <div
      className={clsx(
        'relative border shadow-card',
        radius === 'xl' ? 'rounded-xl' : 'rounded-2xl',
        CARD_BORDER[accent],
        SURFACE[surface],
        PAD[pad],
        brackets && 'corner-brackets',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Text & labels

export function MonoLabel({ children, className, dot, tone = 'slate' }: { children: ReactNode; className?: string; dot?: Tone; tone?: Tone }) {
  return (
    <span className={clsx('label-mono inline-flex items-center gap-1.5', tone === 'slate' ? 'text-slate-400' : TONE_TEXT[tone], className)}>
      {dot && <Dot tone={dot} />}
      {children}
    </span>
  )
}

export function Dot({ tone = 'brand', pulse, className }: { tone?: Tone; pulse?: boolean; className?: string }) {
  return <span aria-hidden className={clsx('inline-block h-1.5 w-1.5 shrink-0 rounded-full', TONE_BG[tone], pulse && 'animate-pulse-slow', className)} />
}

export function Badge({
  children,
  tone = 'slate',
  mono,
  dot,
  icon,
  size = 'md',
  className,
}: {
  children: ReactNode
  tone?: Tone | 'neutral' | 'warn' | 'danger'
  mono?: boolean
  dot?: boolean
  icon?: IconName
  size?: 'sm' | 'md'
  className?: string
}) {
  // Accept the old tone names so callers written against the previous kit keep working.
  const t: Tone = tone === 'neutral' ? 'slate' : tone === 'warn' ? 'flame' : tone === 'danger' ? 'rose' : tone
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border',
        size === 'sm' ? 'px-1.5 py-0' : 'px-2 py-0.5',
        mono ? 'font-mono text-[10.5px] uppercase tracking-[0.1em]' : 'text-[11px] font-medium',
        TONE_SOFT[t],
        className,
      )}
    >
      {dot && <Dot tone={t} />}
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}

/**
 * Status pill with a live dot — "● Ready to Train", "● Adaptive engine live".
 * `tone` colours the pill, `dotTone` the dot (defaults to the same); `shape="tag"` squares it.
 * Callers must not pass colour/radius/display classes: change them through these props.
 */
export function StatusPill({
  children,
  tone = 'brand',
  dotTone,
  pulse = true,
  mono,
  shape = 'pill',
  className,
}: {
  children: ReactNode
  tone?: Tone
  dotTone?: Tone
  pulse?: boolean
  mono?: boolean
  shape?: 'pill' | 'tag'
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 border px-3 py-1',
        shape === 'pill' ? 'rounded-full' : 'rounded-md',
        mono ? 'font-mono text-[10.5px] uppercase tracking-[0.12em]' : 'text-xs font-medium',
        TONE_SOFT[tone],
        className,
      )}
    >
      <Dot tone={dotTone ?? tone} pulse={pulse} />
      {children}
    </span>
  )
}

export function Label({ children, className, htmlFor }: { children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={clsx('label-mono mb-2 block text-slate-300', className)}>
      {children}
    </label>
  )
}

// ---------------------------------------------------------------------------------------------
// Form controls

type Accent = 'pulse' | 'iris' | 'brand'
const FOCUS: Record<Accent, string> = {
  pulse: 'focus:border-pulse focus:ring-1 focus:ring-pulse/60',
  iris: 'focus:border-iris-500 focus:ring-1 focus:ring-iris-500/70 focus:shadow-glow-iris',
  brand: 'focus:border-brand-400 focus:ring-1 focus:ring-brand-400/60',
}

/**
 * Text input. Size, emphasis and focus colour are props (`big`, `highlight`, `accent`) because
 * Tailwind does not let a caller's `h-12` reliably beat the component's `h-11`.
 */
export function Input({
  accent = 'pulse',
  mono,
  big,
  highlight,
  className,
  ...rest
}: ComponentProps<'input'> & { accent?: Accent; mono?: boolean; big?: boolean; highlight?: boolean }) {
  return (
    <input
      className={clsx(
        'w-full rounded-lg bg-ink-950/70 px-4 text-white placeholder:text-slate-600 transition focus:outline-none disabled:opacity-50',
        big ? 'h-12 text-base' : 'h-11 text-sm',
        highlight ? 'border-2 border-brand-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'border border-line',
        mono && 'font-mono uppercase tracking-[0.12em]',
        FOCUS[accent],
        className,
      )}
      {...rest}
    />
  )
}

export function Select({ accent = 'pulse', className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { accent?: Accent }) {
  return (
    <div className={clsx('relative', className)}>
      <select
        className={clsx(
          'h-10 w-full cursor-pointer appearance-none rounded-lg border border-line bg-ink-950/70 pl-3 pr-9 text-xs text-slate-200 transition focus:outline-none',
          FOCUS[accent],
        )}
        {...rest}
      >
        {children}
      </select>
      <Icon name="chevron-down" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
    </div>
  )
}

/** Label row (mono caption, optional info tip, right-hand meta) + control + hint. */
export function Field({
  label,
  info,
  meta,
  hint,
  children,
  className,
  id,
}: {
  label: ReactNode
  info?: string
  meta?: ReactNode
  hint?: ReactNode
  children: (id: string) => ReactNode
  className?: string
  id?: string
}) {
  const auto = useId()
  const fieldId = id ?? auto
  return (
    <div className={clsx('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor={fieldId} className="label-mono text-slate-300">
            {label}
          </label>
          {info && <InfoTip text={info} />}
        </div>
        {meta}
      </div>
      {children(fieldId)}
      {hint && <div className="pl-1 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

/** A small "i" that reveals a HUD-style popover on hover or keyboard focus. */
export function InfoTip({ text, title }: { text: string; title?: string }) {
  return (
    <span className="group/tip relative inline-flex">
      <button
        type="button"
        aria-label={title ?? 'More information'}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-line bg-white/[0.06] font-mono text-[10px] text-slate-400 transition hover:bg-white/[0.12] hover:text-slate-200"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-64 translate-y-1 rounded-lg border border-line bg-ink-900/95 p-2.5 text-[11px] leading-relaxed text-slate-300 opacity-0 shadow-xl backdrop-blur-md transition duration-200 group-focus-within/tip:translate-y-0 group-focus-within/tip:opacity-100 group-hover/tip:translate-y-0 group-hover/tip:opacity-100"
      >
        {title && <span className="label-mono mb-1 flex items-center gap-1.5 text-pulse">{title}</span>}
        {text}
      </span>
    </span>
  )
}

/** Pill selector (minutes, days, filters). The active pill glows in the accent colour. */
export function Chip({
  active,
  children,
  onClick,
  accent = 'iris',
  size = 'md',
  className,
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
  accent?: Accent
  size?: 'sm' | 'md'
  className?: string
}) {
  const on = {
    iris: 'border-iris-500 bg-iris-500/15 text-white shadow-[0_0_16px_-2px_rgba(90,107,255,0.45)]',
    pulse: 'border-pulse/60 bg-pulse/10 text-white shadow-[0_0_14px_-3px_rgba(0,242,254,0.45)]',
    brand: 'border-brand-400/70 bg-brand-400/10 text-white shadow-[0_0_14px_-3px_rgba(0,229,153,0.45)]',
  }[accent]
  return (
    <button
      type="button"
      aria-pressed={!!active}
      onClick={onClick}
      className={clsx(
        'rounded-lg border text-center transition duration-150',
        size === 'sm' ? 'px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em]' : 'px-3 py-2.5 text-sm font-medium',
        active ? on : 'border-line bg-ink-750/60 text-slate-300 hover:border-line-strong hover:text-white',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Segmented control (the "Lenient / Standard / Strict" bar). */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div role="radiogroup" className={clsx('grid gap-1 rounded-lg border border-line bg-ink-950/70 p-1 text-center', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'rounded-md transition',
            size === 'sm' ? 'py-1 text-[11px]' : 'py-1.5 text-xs',
            o.value === value ? 'border border-line-strong bg-ink-750 font-medium text-white shadow-sm' : 'border border-transparent text-slate-400 hover:text-slate-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative h-6 w-11 shrink-0 rounded-full border transition disabled:opacity-50',
        checked ? 'border-pulse/60 bg-pulse/25 shadow-[0_0_12px_-2px_rgba(0,242,254,0.45)]' : 'border-line bg-ink-700',
      )}
    >
      <span className={clsx('absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all', checked ? 'left-[22px] bg-pulse' : 'left-0.5 bg-slate-400')} />
    </button>
  )
}

/** Big selectable option row with a radio dot (goal / level / coaching mode). */
export function RadioCard({
  selected,
  onSelect,
  title,
  hint,
  accent = 'iris',
  icon,
  className,
}: {
  selected: boolean
  onSelect: () => void
  title: ReactNode
  hint?: ReactNode
  accent?: 'iris' | 'brand'
  icon?: IconName
  className?: string
}) {
  const id = useId()
  const on =
    accent === 'iris'
      ? 'border-iris-500 bg-iris-500/[0.07] shadow-glow-iris'
      : 'border-brand-500/80 bg-brand-500/[0.06] shadow-[0_0_15px_rgba(16,185,129,0.08)]'
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-labelledby={`${id}-t`}
      aria-describedby={hint ? `${id}-h` : undefined}
      onClick={onSelect}
      className={clsx(
        'group flex w-full items-center justify-between gap-4 rounded-xl border-2 p-4 text-left transition duration-150',
        selected ? on : 'border-line bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span
            className={clsx(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              selected ? (accent === 'iris' ? 'bg-iris-500/20 text-iris-300' : 'bg-brand-500/20 text-brand-400') : 'bg-ink-700 text-slate-400',
            )}
          >
            <Icon name={icon} />
          </span>
        )}
        <div className="min-w-0">
          <div id={`${id}-t`} className={clsx('text-[15px] tracking-tight', selected ? 'font-semibold text-white' : 'font-medium text-slate-200 group-hover:text-white')}>
            {title}
          </div>
          {hint && (
            <div id={`${id}-h`} className={clsx('mt-0.5 text-xs sm:text-sm', selected ? 'text-slate-300' : 'text-slate-400')}>
              {hint}
            </div>
          )}
        </div>
      </div>
      <span
        aria-hidden
        className={clsx(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
          selected ? (accent === 'iris' ? 'border-2 border-iris-500' : 'border-2 border-brand-400') : 'border border-white/30 group-hover:border-white/50',
        )}
      >
        {selected && <span className={clsx('h-2.5 w-2.5 rounded-full', accent === 'iris' ? 'bg-iris-500' : 'bg-brand-400')} />}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------------------------
// Feedback

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={clsx('animate-spin', className ?? 'h-5 w-5')} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
    </svg>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx('animate-pulse rounded-lg bg-white/[0.05]', className)} />
}

export function Alert({ tone = 'danger', title, children, className }: { tone?: 'danger' | 'info' | 'warn' | 'success'; title?: string; children: ReactNode; className?: string }) {
  const t = {
    danger: { cls: 'border-rose-500/35 bg-rose-500/[0.08] text-rose-200', icon: 'alert' as const },
    info: { cls: 'border-pulse/25 bg-pulse/[0.06] text-sky-100', icon: 'info' as const },
    warn: { cls: 'border-flame/35 bg-flame/[0.08] text-amber-100', icon: 'alert' as const },
    success: { cls: 'border-brand-400/30 bg-brand-400/[0.07] text-brand-100', icon: 'check' as const },
  }[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={clsx('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', t.cls, className)}>
      <Icon name={t.icon} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        {title && <div className="mb-0.5 font-semibold text-white">{title}</div>}
        {children}
      </div>
    </div>
  )
}
