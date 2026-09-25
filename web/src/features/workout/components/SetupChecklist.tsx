import { clsx } from 'clsx'
import type { FramingCheck } from '@/cv/geometry/orientation'

export function SetupChecklist({ framing, orientation }: { framing: FramingCheck | null; orientation: 'side' | 'front' | 'any' }) {
  const items = [
    { ok: !!framing?.visible, label: 'Lighting & visibility' },
    { ok: !!framing?.inFrame, label: 'Whole body in frame' },
    { ok: !!framing?.facingOk, label: orientation === 'side' ? 'Standing side-on' : orientation === 'front' ? 'Facing the camera' : 'Position' },
  ]
  return (
    <div className="space-y-1.5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2 text-sm">
          <span className={clsx('flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold', it.ok ? 'bg-brand-400 text-ink-950 shadow-[0_0_10px_rgba(0,229,153,0.5)]' : 'bg-ink-700 text-slate-400')}>
            {it.ok ? '✓' : '·'}
          </span>
          <span className={it.ok ? 'text-slate-100' : 'text-slate-400'}>{it.label}</span>
        </div>
      ))}
      {framing?.hint && <div className="pt-1 text-sm font-medium text-flame">{framing.hint}</div>}
    </div>
  )
}

/** Simple silhouette guide drawn with SVG: a side-on or front-on stick figure. */
export function SilhouetteGuide({ orientation }: { orientation: 'side' | 'front' | 'any' }) {
  const front = orientation !== 'side'
  return (
    <svg viewBox="0 0 100 200" className="pointer-events-none h-[70%] opacity-40" aria-hidden>
      <circle cx="50" cy="22" r="12" fill="none" stroke="#00e599" strokeWidth="2" strokeDasharray="4 3" />
      {front ? (
        <>
          <path d="M50 34 L50 105 M50 45 L22 85 M50 45 L78 85 M50 105 L30 180 M50 105 L70 180" fill="none" stroke="#00e599" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M50 34 L50 105 M50 48 L58 88 M50 105 L52 145 L48 180 M50 105 L44 145 L52 180" fill="none" stroke="#00e599" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}
