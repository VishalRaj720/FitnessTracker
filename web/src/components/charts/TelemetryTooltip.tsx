interface Entry {
  name?: string | number
  value?: number | string | readonly (number | string)[]
  color?: string
  dataKey?: string | number | ((obj: unknown) => unknown)
  payload?: Record<string, unknown>
}

/**
 * Recharts tooltip content in the HUD style: mono caption, one row per series. Recharts clones
 * this element and injects `active`, `payload` and `label`.
 */
export function TelemetryTooltip({
  active,
  payload,
  label,
  units = {},
  labelFormat,
}: {
  active?: boolean
  payload?: readonly Entry[]
  label?: string | number
  units?: Record<string, string>
  labelFormat?: (label: string | number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line-strong bg-ink-900/95 px-3 py-2 shadow-2xl backdrop-blur-md">
      {label != null && <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">{labelFormat ? labelFormat(label) : label}</div>}
      <div className="space-y-1">
        {payload.map((p, i) => {
          const key = String(typeof p.dataKey === 'function' ? i : (p.dataKey ?? i))
          const v = Array.isArray(p.value) ? p.value.join('–') : p.value
          return (
            <div key={key} className="flex items-center justify-between gap-5 font-mono text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
                {p.name}
              </span>
              <span className="font-semibold text-white">
                {typeof v === 'number' ? Math.round(v * 10) / 10 : v}
                {units[key] ? ` ${units[key]}` : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
