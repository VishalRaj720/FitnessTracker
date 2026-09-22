import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
        {
          'bg-brand-500 text-slate-950 hover:bg-brand-400': variant === 'primary',
          'bg-slate-800 text-slate-100 hover:bg-slate-700': variant === 'secondary',
          'bg-transparent text-slate-300 hover:bg-slate-800/60': variant === 'ghost',
          'bg-rose-600 text-white hover:bg-rose-500': variant === 'danger',
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2.5 text-base': size === 'md',
          'px-6 py-3.5 text-lg': size === 'lg',
        },
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('rounded-2xl border border-slate-800 bg-slate-900/70 p-4', className)} {...rest}>
      {children}
    </div>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-base text-slate-100 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30',
        className,
      )}
      {...rest}
    />
  )
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <label className={clsx('mb-1.5 block text-sm font-medium text-slate-300', className)}>{children}</label>
}

export function Chip({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
        active
          ? 'border-brand-400 bg-brand-500/15 text-brand-300'
          : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'warn' | 'danger'; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
        {
          'bg-slate-800 text-slate-300': tone === 'neutral',
          'bg-brand-500/15 text-brand-300': tone === 'brand',
          'bg-amber-500/15 text-amber-300': tone === 'warn',
          'bg-rose-500/15 text-rose-300': tone === 'danger',
        },
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={clsx('animate-spin', className ?? 'h-5 w-5')} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export function Alert({ tone = 'danger', children }: { tone?: 'danger' | 'info' | 'warn'; children: ReactNode }) {
  return (
    <div
      className={clsx('rounded-xl border px-3.5 py-2.5 text-sm', {
        'border-rose-500/40 bg-rose-500/10 text-rose-200': tone === 'danger',
        'border-sky-500/40 bg-sky-500/10 text-sky-200': tone === 'info',
        'border-amber-500/40 bg-amber-500/10 text-amber-200': tone === 'warn',
      })}
    >
      {children}
    </div>
  )
}

export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: string; className?: string }) {
  return (
    <Card className={clsx('p-3.5', className)}>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </Card>
  )
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-2 py-8 text-center">
      <div className="text-lg font-semibold">{title}</div>
      {body && <p className="max-w-xs text-sm text-slate-400">{body}</p>}
      {action}
    </Card>
  )
}
