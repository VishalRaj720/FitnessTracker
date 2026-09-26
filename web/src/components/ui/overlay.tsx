import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { Icon } from '@/components/ui/icons'
import { MonoLabel } from '@/components/ui/primitives'

/**
 * Bottom sheet on phones, right-hand drawer from `sm` up. Escape and the backdrop close it,
 * the page behind stops scrolling, and focus moves into the sheet and back out again.
 */
export function Sheet({
  open,
  onClose,
  title,
  kicker,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  kicker?: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className={clsx(
          'relative flex max-h-[92dvh] w-full animate-fade-up flex-col rounded-t-2xl border-t border-line bg-ink-900 shadow-2xl sm:h-full sm:max-h-none sm:rounded-none sm:border-l sm:border-t-0',
          wide ? 'sm:max-w-xl' : 'sm:max-w-md',
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 space-y-1">
            {kicker && <MonoLabel>{kicker}</MonoLabel>}
            <h2 className="truncate text-lg font-bold tracking-tight text-white">{title}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="border-t border-line bg-ink-900/95 px-5 pb-[calc(var(--safe-bottom)+16px)] pt-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
