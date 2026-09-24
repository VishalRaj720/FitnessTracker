import { describe, expect, it } from 'vitest'
import { FeatureTrace } from '@/cv/engine/FeatureTrace'
import { ExerciseAnalyzer } from '@/cv/engine/ExerciseAnalyzer'
import { EXERCISE_DEFINITIONS } from '@/cv/exercises'
import { DEMO_CLIPS, sampleClipWorld } from '@/cv/demo/clips'
import { projectToPose } from '@/cv/demo/project'

describe('FeatureTrace', () => {
  it('returns evenly spaced samples across the requested window', () => {
    const t = new FeatureTrace(64)
    for (let i = 0; i < 20; i++) t.push({ a: i, b: i * 2 }, i * 100)
    const s = t.sample(0, 1900, 5)
    expect(s.a).toHaveLength(5)
    expect(s.a[0]).toBe(0)
    expect(s.a[4]).toBe(19)
    expect(s.b[4]).toBe(38)
  })

  it('only returns frames inside the window', () => {
    const t = new FeatureTrace(64)
    for (let i = 0; i < 20; i++) t.push({ a: i }, i * 100)
    const s = t.sample(500, 900, 8)
    expect(Math.min(...s.a)).toBeGreaterThanOrEqual(5)
    expect(Math.max(...s.a)).toBeLessThanOrEqual(9)
  })

  it('returns fewer points than asked for rather than inventing them', () => {
    const t = new FeatureTrace(64)
    for (let i = 0; i < 3; i++) t.push({ a: i }, i * 100)
    expect(t.sample(0, 500, 8).a).toHaveLength(3)
  })

  it('keeps only the most recent frames once capacity is reached', () => {
    const t = new FeatureTrace(10)
    for (let i = 0; i < 50; i++) t.push({ a: i }, i * 100)
    const s = t.sample(0, 100_000, 10)
    expect(s.a[0]).toBe(40)
    expect(s.a[9]).toBe(49)
  })

  it('survives a window with no frames in it', () => {
    const t = new FeatureTrace(16)
    t.push({ a: 1 }, 100)
    expect(t.sample(5000, 6000, 8)).toEqual({})
  })

  it('reuses its buffers instead of growing with each frame', () => {
    const t = new FeatureTrace(8)
    for (let i = 0; i < 1000; i++) t.push({ a: i, b: i }, i)
    // Capacity is fixed, so a long session cannot leak: only the last 8 rows survive.
    expect(t.sample(0, 1e9, 100).a).toHaveLength(8)
  })

  it('substitutes a finite value for a NaN feature', () => {
    const t = new FeatureTrace(8)
    t.push({ a: Number.NaN }, 0)
    t.push({ a: 5 }, 100)
    expect(t.sample(0, 200, 2).a.every(Number.isFinite)).toBe(true)
  })
})

/**
 * Drive the analyzer with the Phase 2 demo rig, which is a known-good movement, and check
 * the kinematics that come out actually describe it. This is the whole premise of the
 * coach: if the series is wrong, every cue built on it is wrong too.
 */
describe('rep kinematics from a known movement', () => {
  function runSquats(reps: number, msPerRep = 3000, fps = 30) {
    const clip = DEMO_CLIPS.squat
    const def = EXERCISE_DEFINITIONS.squat
    const an = new ExerciseAnalyzer(def)
    const events: ReturnType<ExerciseAnalyzer['update']> = []
    const step = 1000 / fps
    const total = reps * msPerRep
    for (let t = 0; t <= total; t += step) {
      const u = (t % msPerRep) / msPerRep
      const pose = projectToPose(sampleClipWorld(clip, u), clip.view)
      events.push(...an.update(pose, t))
    }
    return { an, events }
  }

  it('counts the demo movement as reps', () => {
    const { events } = runSquats(3)
    const reps = events.filter((e) => e.type === 'rep')
    expect(reps.length).toBeGreaterThanOrEqual(2)
  })

  it('reports a descent, a bottom and an ascent that add up to the rep', () => {
    const { events } = runSquats(3)
    const rep = events.find((e) => e.type === 'rep')
    expect(rep).toBeTruthy()
    if (rep?.type !== 'rep') return
    const k = rep.kinematics
    expect(k.descentMs).toBeGreaterThan(0)
    expect(k.ascentMs).toBeGreaterThan(0)
    expect(k.descentMs + k.bottomMs + k.ascentMs).toBeLessThanOrEqual(k.totalMs + 2)
  })

  it('captures the knee angle actually travelling down and back up', () => {
    const { events } = runSquats(3)
    const rep = events.find((e) => e.type === 'rep')
    if (rep?.type !== 'rep') throw new Error('no rep')
    const knee = rep.kinematics.series.kneeAngle
    expect(knee.length).toBeGreaterThan(3)
    // Starts high (standing), dips, and finishes high again.
    expect(Math.min(...knee)).toBeLessThan(110)
    expect(knee[0]).toBeGreaterThan(140)
    expect(knee[knee.length - 1]).toBeGreaterThan(140)
  })

  it('carries every feature the exercise defines, not just the primary one', () => {
    const { events } = runSquats(3)
    const rep = events.find((e) => e.type === 'rep')
    if (rep?.type !== 'rep') throw new Error('no rep')
    // The secondary features are where the interesting observations live: a coach that only
    // sees kneeAngle can talk about depth and nothing else. Compared against what the
    // definition actually produces, so adding a feature cannot silently stop being traced.
    const squatClip = DEMO_CLIPS.squat
    const standing = projectToPose(sampleClipWorld(squatClip, 0), squatClip.view)
    const produced = Object.keys(EXERCISE_DEFINITIONS.squat.features(standing)).sort()
    expect(produced.length).toBeGreaterThan(3)
    expect(Object.keys(rep.kinematics.series).sort()).toEqual(produced)
  })

  it('keeps a rolling window of recent reps for trend, not just the last one', () => {
    const { an } = runSquats(4)
    const recent = an.recentKinematics(3)
    expect(recent.length).toBeGreaterThanOrEqual(2)
    expect(recent.length).toBeLessThanOrEqual(3)
  })
})
