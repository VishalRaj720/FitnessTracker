import { describe, expect, it, vi } from 'vitest'
import { PerformanceGovernor, TIER_PROFILES, type Tier } from '@/cv/perf/PerformanceGovernor'

/**
 * The thresholds themselves matter less than the anti-flapping behaviour: a device sitting
 * near a boundary must not oscillate between models, and a tier change must never land
 * mid-set, because swapping the model resets tracking and would corrupt the rep FSM.
 */

/** Feed `seconds` worth of samples at a steady inference cost, one eval per second. */
function feed(gov: PerformanceGovernor, inferenceMs: number, seconds: number, startAt = 1000): number {
  let now = startAt
  for (let s = 0; s < seconds; s++) {
    // a handful of samples, then cross the 1 s evaluation boundary
    for (let i = 0; i < 5; i++) gov.sample(inferenceMs, now + i)
    now += 1001
    gov.sample(inferenceMs, now)
  }
  return now
}

describe('PerformanceGovernor', () => {
  it('starts at the probed tier and exposes its profile', () => {
    const gov = new PerformanceGovernor({ initial: 'medium' })
    expect(gov.tier).toBe('medium')
    expect(gov.profile).toEqual(TIER_PROFILES.medium)
  })

  it('steps down when inference is consistently over budget', () => {
    const changes: Tier[] = []
    const gov = new PerformanceGovernor({ initial: 'high', onChange: (t) => changes.push(t) })
    feed(gov, 120, 6)
    expect(gov.tier).toBe('medium')
    expect(changes).toEqual(['medium'])
  })

  it('does not step down on a brief spike', () => {
    const gov = new PerformanceGovernor({ initial: 'high' })
    feed(gov, 120, 2) // two evals over budget - below the 3-vote threshold
    expect(gov.tier).toBe('high')
  })

  it('needs sustained headroom before climbing back up', () => {
    const gov = new PerformanceGovernor({ initial: 'low', maxTier: 'high' })
    let now = feed(gov, 10, 3)
    expect(gov.tier).toBe('low') // 3 votes is not enough to go up
    now = feed(gov, 10, 3, now)
    expect(gov.tier).toBe('medium')
  })

  it('does not flap when inference sits right on a boundary', () => {
    const changes: Tier[] = []
    const gov = new PerformanceGovernor({ initial: 'medium', maxTier: 'high', onChange: (t) => changes.push(t) })
    let now = 1000
    // alternate either side of the medium band for a long time
    for (let i = 0; i < 40; i++) now = feed(gov, i % 2 === 0 ? 90 : 15, 1, now)
    expect(changes.length).toBeLessThanOrEqual(1)
  })

  it('never exceeds the probe ceiling', () => {
    const gov = new PerformanceGovernor({ initial: 'medium', maxTier: 'medium' })
    feed(gov, 5, 20)
    expect(gov.tier).toBe('medium')
  })

  it('defers a change while locked, then applies it once the set ends', () => {
    const gov = new PerformanceGovernor({ initial: 'high' })
    gov.setLocked(true)
    feed(gov, 150, 8)
    expect(gov.tier).toBe('high') // mid-set: a model swap would reset tracking

    vi.spyOn(performance, 'now').mockReturnValue(60_000)
    gov.setLocked(false)
    expect(gov.tier).toBe('medium')
    vi.restoreAllMocks()
  })

  it('honours the cooldown between consecutive changes', () => {
    const changes: Tier[] = []
    const gov = new PerformanceGovernor({ initial: 'high', onChange: (t) => changes.push(t) })
    // Enough sustained overload to justify two steps down, but inside one cooldown window.
    feed(gov, 500, 8)
    expect(changes).toEqual(['medium'])
    expect(gov.tier).toBe('medium')
  })

  it('reports p75 rather than the mean, so occasional slow frames still register', () => {
    const gov = new PerformanceGovernor({ initial: 'medium' })
    for (let i = 0; i < 10; i++) gov.sample(i < 7 ? 10 : 200, 1000 + i)
    gov.sample(200, 2100)
    expect(gov.stats().p75).toBeGreaterThan(100)
  })
})
