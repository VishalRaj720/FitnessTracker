import { describe, expect, it } from 'vitest'
import {
  alternatingGap,
  ascentWindow,
  bottomWindow,
  changeOver,
  descentWindow,
  maxIn,
  minIn,
  peakAt,
  slopeOver,
  trendAcross,
  troughAt,
} from '@/cv/engine/traceMath'
import type { RepKinematics } from '@/cv/engine/FeatureTrace'

/** A rep-shaped curve: starts high, dips in the middle, comes back. */
const dip = [170, 140, 110, 92, 92, 120, 155, 172]

function rep(series: Record<string, number[]>, phases?: Partial<RepKinematics>): RepKinematics {
  return { series, descentMs: 1200, bottomMs: 400, ascentMs: 1000, totalMs: 2600, ...phases }
}

describe('traceMath reads a series', () => {
  it('measures change and rate across a window', () => {
    expect(changeOver([0, 10], 0, 1)).toBe(10)
    expect(changeOver([0, 5, 10], 0, 0.5)).toBe(5)
    expect(slopeOver([0, 5, 10], 0, 0.5)).toBe(10)
    // Interpolates between samples rather than snapping to one.
    expect(changeOver([0, 10], 0.25, 0.75)).toBeCloseTo(5)
  })

  it('finds extremes inside a window, including its interpolated edges', () => {
    expect(minIn(dip)).toBe(92)
    expect(maxIn(dip)).toBe(172)
    // The descent has not bottomed out by 0.3, so the minimum there is the interpolated
    // value at the window's edge (samples sit at multiples of 1/7), not the rep's minimum.
    expect(minIn(dip, 0, 0.3)).toBeCloseTo(108.2, 1)
    expect(minIn(dip, 0.7, 1)).toBeCloseTo(117.2, 1)
  })

  it('locates when a feature peaked, as a fraction of the rep', () => {
    expect(peakAt([1, 5, 2])).toBeCloseTo(0.5)
    expect(peakAt([5, 2, 1])).toBe(0)
    expect(troughAt([5, 2, 1])).toBe(1)
    expect(troughAt(dip)).toBeCloseTo(3 / 7)
  })

  it('turns the FSM phase durations into windows over the series', () => {
    const k = rep({ a: dip })
    expect(descentWindow(k)).toEqual([0, 1200 / 2600])
    expect(bottomWindow(k)).toEqual([1200 / 2600, 1600 / 2600])
    expect(ascentWindow(k)).toEqual([1600 / 2600, 1])
    // Windows stay inside 0..1 even when the phases do not add up to the total.
    const odd = rep({ a: dip }, { descentMs: 5000, bottomMs: 5000, ascentMs: 0, totalMs: 1000 })
    const [u0, u1] = ascentWindow(odd)
    expect(u0).toBe(1)
    expect(u1).toBe(1)
  })

  it('reads a slope across reps, not within one', () => {
    const history = [92, 98, 104].map((v) => rep({ knee: [v, v, v] }))
    expect(trendAcross(history, (k) => minIn(k.series.knee))).toBeCloseTo(6)
    const steady = [92, 92, 92].map((v) => rep({ knee: [v, v, v] }))
    expect(trendAcross(steady, (k) => minIn(k.series.knee))).toBe(0)
  })

  it('compares alternating reps as the two sides they are', () => {
    const history = [92, 118, 93, 119].map((v) => rep({ knee: [v, v, v] }))
    expect(alternatingGap(history, (k) => minIn(k.series.knee))).toBeCloseTo(26)
    const even = [95, 96, 95, 96].map((v) => rep({ knee: [v, v, v] }))
    expect(alternatingGap(even, (k) => minIn(k.series.knee))).toBeCloseTo(1)
  })
})

describe('traceMath fails safe rather than guessing', () => {
  it('returns NaN for a series it does not have, so no comparison is ever true', () => {
    for (const v of [
      changeOver(undefined, 0, 1),
      slopeOver(undefined, 0, 1),
      minIn(undefined),
      maxIn(undefined),
      peakAt(undefined),
      troughAt(undefined),
      minIn([]),
      changeOver([1, 2], 0.5, 0.5), // a window with no width
    ]) {
      expect(Number.isNaN(v)).toBe(true)
      // The point of NaN: a rule written either way stays silent.
      expect(v > 0).toBe(false)
      expect(v < 0).toBe(false)
    }
  })

  it('reports no trend until it has the reps to support one', () => {
    const one = [rep({ knee: [92, 92, 92] })]
    expect(trendAcross(one, (k) => minIn(k.series.knee))).toBe(0)
    expect(alternatingGap([...one, ...one], (k) => minIn(k.series.knee))).toBe(0)
  })

  it('reports no trend when any rep in the window is unreadable', () => {
    const history = [rep({ knee: [92, 92] }), rep({}), rep({ knee: [104, 104] })]
    expect(trendAcross(history, (k) => minIn(k.series.knee))).toBe(0)
  })
})
