/** Geometry for the hand-drawn telemetry charts (smooth curves through real data points). */

export type Pt = [number, number]

/** Catmull-Rom spline through the points, emitted as cubic Béziers. */
export function smoothPath(points: Pt[]): string {
  if (points.length === 0) return ''
  const f = (n: number) => Math.round(n * 10) / 10
  if (points.length === 1) return `M ${f(points[0][0])} ${f(points[0][1])}`
  let d = `M ${f(points[0][0])} ${f(points[0][1])}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C ${f(c1[0])} ${f(c1[1])}, ${f(c2[0])} ${f(c2[1])}, ${f(p2[0])} ${f(p2[1])}`
  }
  return d
}

/** Map values onto a width x height box (y grows downward), leaving `pad` on every side. */
export function toPoints(values: number[], width: number, height: number, opts: { pad?: number; min?: number; max?: number } = {}): Pt[] {
  const pad = opts.pad ?? 8
  if (values.length === 0) return []
  const lo = opts.min ?? Math.min(...values)
  const hi = opts.max ?? Math.max(...values)
  const span = hi - lo || 1
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0
  return values.map((v, i) => [pad + i * step, height - pad - ((v - lo) / span) * (height - pad * 2)])
}

/** Closed area under a smooth line, down to the bottom edge. */
export function areaPath(points: Pt[], height: number): string {
  if (points.length < 2) return ''
  const line = smoothPath(points)
  const last = points[points.length - 1]
  return `${line} L ${last[0]} ${height} L ${points[0][0]} ${height} Z`
}
