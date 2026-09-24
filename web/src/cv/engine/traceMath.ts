import type { RepKinematics } from '@/cv/engine/FeatureTrace'

/**
 * Small pure readers over a rep's feature series, so a FormRule can ask about the *shape*
 * of a repetition instead of only its top and bottom snapshots.
 *
 * Why this exists: a snapshot cannot tell a controlled descent from a drop, a squat where
 * the hips rose before the chest from one where they rose together, or a set whose depth is
 * fading from one that is holding. Those are the faults coaches actually call out, and they
 * live in the curve between the snapshots — which `FeatureTrace` was already recording for
 * the coach model. Letting the deterministic rules read the same series is what moves
 * in-rep feedback off the network: it lands on the rep that earned it, not seconds later.
 *
 * Every function is fail-safe rather than throwing. Missing or too-short data returns NaN
 * (or 0 for a "no change" reading), and a rule comparing NaN with `>` or `<` is simply
 * false — so a rep the trace could not describe is never reported as a fault.
 *
 * Time is normalised: u = 0 is the start of the rep, u = 1 is the end. `descentWindow` and
 * friends convert the FSM's own phase durations into that scale, so "during the ascent"
 * means exactly what the rep counter thought it meant.
 */

/** Minimum normalised width before a window is too thin to read anything from. */
const MIN_WINDOW = 0.02

/** Linearly interpolated value of a series at normalised time u. */
function at(series: number[] | undefined, u: number): number {
  if (!series || series.length === 0) return NaN
  if (series.length === 1) return series[0]
  const x = Math.min(1, Math.max(0, u)) * (series.length - 1)
  const i = Math.floor(x)
  if (i >= series.length - 1) return series[series.length - 1]
  const k = x - i
  return series[i] + (series[i + 1] - series[i]) * k
}

/** Signed change in a feature across [u0, u1]. Positive means the value grew. */
export function changeOver(series: number[] | undefined, u0: number, u1: number): number {
  if (u1 - u0 < MIN_WINDOW) return NaN
  const a = at(series, u0)
  const b = at(series, u1)
  return b - a
}

/** Rate of change across [u0, u1], in feature units per whole rep duration. */
export function slopeOver(series: number[] | undefined, u0: number, u1: number): number {
  const d = changeOver(series, u0, u1)
  return Number.isNaN(d) ? NaN : d / (u1 - u0)
}

function extremeIn(series: number[] | undefined, u0: number, u1: number, want: 'max' | 'min'): number {
  if (!series || series.length === 0) return NaN
  if (u1 - u0 < MIN_WINDOW) return NaN
  // Endpoints are interpolated, so a window that falls between two samples still reads.
  let best = want === 'max' ? Math.max(at(series, u0), at(series, u1)) : Math.min(at(series, u0), at(series, u1))
  for (let i = 0; i < series.length; i++) {
    const u = i / Math.max(1, series.length - 1)
    if (u < u0 || u > u1) continue
    const v = series[i]
    if (!Number.isFinite(v)) continue
    best = want === 'max' ? Math.max(best, v) : Math.min(best, v)
  }
  return best
}

export function maxIn(series: number[] | undefined, u0 = 0, u1 = 1): number {
  return extremeIn(series, u0, u1, 'max')
}

export function minIn(series: number[] | undefined, u0 = 0, u1 = 1): number {
  return extremeIn(series, u0, u1, 'min')
}

function extremeAt(series: number[] | undefined, want: 'max' | 'min'): number {
  if (!series || series.length < 2) return NaN
  let bestI = -1
  let best = NaN
  for (let i = 0; i < series.length; i++) {
    const v = series[i]
    if (!Number.isFinite(v)) continue
    if (bestI < 0 || (want === 'max' ? v > best : v < best)) {
      best = v
      bestI = i
    }
  }
  return bestI < 0 ? NaN : bestI / (series.length - 1)
}

/** Normalised time at which a feature peaks. Used to compare *when* two joints moved. */
export function peakAt(series: number[] | undefined): number {
  return extremeAt(series, 'max')
}

/** Normalised time at which a feature bottoms out. */
export function troughAt(series: number[] | undefined): number {
  return extremeAt(series, 'min')
}

type Window = [number, number]

function clampWindow(a: number, b: number): Window {
  const u0 = Math.min(1, Math.max(0, a))
  const u1 = Math.min(1, Math.max(0, b))
  return u1 > u0 ? [u0, u1] : [u0, u0]
}

export function descentWindow(k: RepKinematics): Window {
  const total = k.totalMs || 1
  return clampWindow(0, k.descentMs / total)
}

export function bottomWindow(k: RepKinematics): Window {
  const total = k.totalMs || 1
  return clampWindow(k.descentMs / total, (k.descentMs + k.bottomMs) / total)
}

export function ascentWindow(k: RepKinematics): Window {
  const total = k.totalMs || 1
  return clampWindow((k.descentMs + k.bottomMs) / total, 1)
}

/**
 * Least-squares slope of a per-rep number across the last `n` reps, in units per rep.
 *
 * This is where fatigue lives. A single rep cannot show depth fading or lean creeping —
 * only the run of reps can, which is why `check` receives the history at all. Fewer than
 * `n` reps returns 0, so a trend rule stays silent until it has grounds to speak, and the
 * short window means it goes quiet again once the user corrects.
 */
export function trendAcross(history: RepKinematics[] | undefined, pick: (k: RepKinematics) => number, n = 3): number {
  if (!history || history.length < n) return 0
  const vals: number[] = []
  for (const k of history.slice(-n)) {
    const v = pick(k)
    if (!Number.isFinite(v)) return 0
    vals.push(v)
  }
  const m = vals.length
  const meanX = (m - 1) / 2
  let meanY = 0
  for (const v of vals) meanY += v
  meanY /= m
  let num = 0
  let den = 0
  for (let i = 0; i < m; i++) {
    num += (i - meanX) * (vals[i] - meanY)
    den += (i - meanX) * (i - meanX)
  }
  return den === 0 ? 0 : num / den
}

/**
 * Difference between odd-numbered and even-numbered reps, as an absolute gap.
 *
 * For an alternating movement, consecutive reps *are* the two sides, so this is the only
 * left/right comparison available from a single-camera side view: whichever leg is forward
 * is the one being measured, and it swaps every rep. Fewer than `n` reps returns 0.
 */
export function alternatingGap(history: RepKinematics[] | undefined, pick: (k: RepKinematics) => number, n = 4): number {
  if (!history || history.length < n) return 0
  const vals: number[] = []
  for (const k of history.slice(-n)) {
    const v = pick(k)
    if (!Number.isFinite(v)) return 0
    vals.push(v)
  }
  // Which group holds which leg flips as the window slides forward a rep at a time, but the
  // answer is the size of the difference, so the labelling never matters.
  let evenSum = 0
  let evenCount = 0
  let oddSum = 0
  let oddCount = 0
  for (let i = 0; i < vals.length; i++) {
    if (i % 2 === 0) {
      evenSum += vals[i]
      evenCount += 1
    } else {
      oddSum += vals[i]
      oddCount += 1
    }
  }
  if (!evenCount || !oddCount) return 0
  return Math.abs(evenSum / evenCount - oddSum / oddCount)
}
