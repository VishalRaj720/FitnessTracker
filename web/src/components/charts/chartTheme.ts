/** Shared Recharts styling so every chart reads like the telemetry panels in the designs. */

export const AXIS_TICK = { fill: 'var(--text-secondary)', fontSize: 10, fontFamily: '"Plus Jakarta Sans", sans-serif' }
export const GRID_STROKE = 'var(--border-color)'
export const CURSOR_FILL = 'color-mix(in srgb, var(--text-primary) 6%, transparent)'

export const CHART_COLORS = {
  brand: 'var(--accent-success)',
  pulse: 'var(--accent-primary)',
  volt: 'var(--volt)',
  flame: 'var(--flame)',
  iris: 'var(--accent-primary)',
  slate: 'var(--text-secondary)',
} as const
