import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CoachDirector } from '@/features/companion/CoachDirector'
import { companionApi, type CueReply } from '@/features/companion/api'
import { EXERCISE_DEFINITIONS } from '@/cv/exercises'
import type { RepKinematics } from '@/cv/engine/FeatureTrace'

function rep(knee: number[]): RepKinematics {
  return { series: { kneeAngle: knee }, descentMs: 800, bottomMs: 200, ascentMs: 700, totalMs: 1700 }
}

const input = (n = 1) => ({
  recent: [rep([170, 120, 95, 130, 170])],
  repCount: n,
  setNumber: 1,
  violations: {},
})

function stubCue(reply: CueReply | Error, delayMs = 0) {
  return vi.spyOn(companionApi, 'cue').mockImplementation(
    () =>
      new Promise((resolve, reject) => {
        const finish = () => (reply instanceof Error ? reject(reply) : resolve(reply))
        if (delayMs) setTimeout(finish, delayMs)
        else finish()
      }),
  )
}

const OK: CueReply = { observation: 'lean is creeping up', cue: 'Chest up', urgency: 2 }

describe('CoachDirector, per-rep trigger', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('navigator', { onLine: true })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('calls the coach when a rep completes and reports the cue', async () => {
    const spy = stubCue(OK)
    const cues: string[] = []
    const d = new CoachDirector({ def: EXERCISE_DEFINITIONS.squat, onCue: (c) => cues.push(c.text), trigger: 'per-rep' })
    d.onRep(input())
    await vi.waitFor(() => expect(cues).toEqual(['Chest up']))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('sends the joint-angle series and the exercise coaching knowledge', async () => {
    const spy = stubCue(OK)
    const d = new CoachDirector({ def: EXERCISE_DEFINITIONS.squat, onCue: () => {}, trigger: 'per-rep' })
    d.onRep(input())
    const payload = spy.mock.calls[0][0]
    expect(payload.reps[0].series.kneeAngle).toEqual([170, 120, 95, 130, 170])
    expect(payload.glossary.kneeAngle).toContain('hip-knee-ankle')
    expect(payload.notes.length).toBeGreaterThan(100)
  })

  it('sends exactly the agreed fields and nothing else', async () => {
    const spy = stubCue(OK)
    const d = new CoachDirector({ def: EXERCISE_DEFINITIONS.squat, onCue: () => {}, trigger: 'per-rep' })
    d.onRep(input())
    const payload = spy.mock.calls[0][0]
    // Pinning the whole shape is the real privacy guarantee: adding an image, a frame or a
    // landmark array to this request would have to break this test first.
    expect(Object.keys(payload).sort()).toEqual([
      'already_said',
      'exercise_slug',
      'glossary',
      'mode',
      'notes',
      'recent_violations',
      'reference',
      'rep_count',
      'reps',
      'set_number',
    ])
    expect(Object.keys(payload.reps[0]).sort()).toEqual([
      'ascent_ms',
      'bottom_ms',
      'descent_ms',
      'index',
      'series',
      'total_ms',
    ])
    const body = JSON.stringify(payload).toLowerCase()
    for (const forbidden of ['base64', 'data:image', 'landmark', 'jpeg', '.png']) {
      expect(body, `${forbidden} leaked`).not.toContain(forbidden)
    }
  })

  it('tells the coach what it has already said so it does not repeat itself', async () => {
    const spy = stubCue(OK)
    const d = new CoachDirector({ def: EXERCISE_DEFINITIONS.squat, onCue: () => {}, trigger: 'per-rep' })
    d.onRep(input(1))
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    d.onRep(input(2))
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    expect(spy.mock.calls[1][0].already_said).toContain('Chest up')
  })

  it('drops an in-flight request when a newer rep arrives', async () => {
    const spy = stubCue(OK, 50)
    const d = new CoachDirector({ def: EXERCISE_DEFINITIONS.squat, onCue: () => {}, trigger: 'per-rep' })
    d.onRep(input(1))
    d.onRep(input(2))
    // The freshest rep is the one worth answering, so the older call is aborted.
    const firstSignal = spy.mock.calls[0][1]
    expect(firstSignal?.aborted).toBe(true)
  })

  it('emits nothing when the coach has nothing to add', async () => {
    stubCue({ observation: null, cue: null, urgency: 0 })
    const cues: string[] = []
    const d = new CoachDirector({ def: EXERCISE_DEFINITIONS.squat, onCue: (c) => cues.push(c.text), trigger: 'per-rep' })
    d.onRep(input())
    await new Promise((r) => setTimeout(r, 10))
    expect(cues).toEqual([])
  })

  it('stays silent when the request fails', async () => {
    stubCue(new Error('network down'))
    const cues: string[] = []
    const d = new CoachDirector({ def: EXERCISE_DEFINITIONS.squat, onCue: (c) => cues.push(c.text), trigger: 'per-rep' })
    d.onRep(input())
    await new Promise((r) => setTimeout(r, 10))
    expect(cues).toEqual([])
  })

  it('does not call out at all while offline', () => {
    const spy = stubCue(OK)
    vi.stubGlobal('navigator', { onLine: false })
    const d = new CoachDirector({ def: EXERCISE_DEFINITIONS.squat, onCue: () => {}, trigger: 'per-rep' })
    d.onRep(input())
    expect(spy).not.toHaveBeenCalled()
  })

  it('stops spending once the session budget is gone', async () => {
    const spy = stubCue(OK)
    const d = new CoachDirector({ def: EXERCISE_DEFINITIONS.squat, onCue: () => {}, budget: 4, trigger: 'per-rep' })
    for (let i = 1; i <= 20; i++) {
      d.onRep(input(i))
      await new Promise((r) => setTimeout(r, 1))
    }
    expect(spy.mock.calls.length).toBeLessThanOrEqual(4)
  })

  it('thins out to every other rep as the budget runs low', async () => {
    const spy = stubCue(OK)
    const d = new CoachDirector({ def: EXERCISE_DEFINITIONS.squat, onCue: () => {}, budget: 10, trigger: 'per-rep' })
    for (let i = 1; i <= 12; i++) {
      d.onRep(input(i))
      await new Promise((r) => setTimeout(r, 1))
    }
    // The first 8 reps each get a call; past 80% of budget it halves.
    expect(spy.mock.calls.length).toBe(10)
    expect(d.callsSpent).toBe(10)
  })

  it('forgets what it said when a new set starts', async () => {
    const spy = stubCue(OK)
    const d = new CoachDirector({ def: EXERCISE_DEFINITIONS.squat, onCue: () => {}, trigger: 'per-rep' })
    d.onRep(input(1))
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    d.onSetEnd()
    d.onRep(input(1))
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    expect(spy.mock.calls[1][0].already_said).toEqual([])
  })

  it('goes quiet once disposed', async () => {
    const spy = stubCue(OK)
    const d = new CoachDirector({ def: EXERCISE_DEFINITIONS.squat, onCue: () => {}, trigger: 'per-rep' })
    d.dispose()
    d.onRep(input())
    expect(spy).not.toHaveBeenCalled()
  })

  it('does nothing for an exercise with no coaching knowledge', () => {
    const spy = stubCue(OK)
    const def = { ...EXERCISE_DEFINITIONS.squat, coaching: undefined }
    const d = new CoachDirector({ def, onCue: () => {}, trigger: 'per-rep' })
    d.onRep(input())
    expect(spy).not.toHaveBeenCalled()
  })
})

/**
 * The shipped default. Gemini's flash models reason before answering and measured round
 * trips run 4-100 s, so one call per set — answered while the user rests — is the only
 * cadence that actually delivers anything. See the class docstring.
 */
describe('CoachDirector, set-end trigger (the default)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('navigator', { onLine: true })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('spends nothing while the set is still running', () => {
    const spy = stubCue(OK)
    const d = new CoachDirector({ def: EXERCISE_DEFINITIONS.squat, onCue: () => {} })
    for (let i = 1; i <= 10; i++) d.onRep(input(i))
    expect(spy).not.toHaveBeenCalled()
  })

  it('makes exactly one call when the set ends', async () => {
    const spy = stubCue(OK)
    const cues: string[] = []
    const d = new CoachDirector({ def: EXERCISE_DEFINITIONS.squat, onCue: (c) => cues.push(c.text) })
    for (let i = 1; i <= 10; i++) d.onRep(input(i))
    d.onSetEnd()
    await vi.waitFor(() => expect(cues).toEqual(['Chest up']))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('sends the last reps of the set, so the advice is about what just happened', async () => {
    const spy = stubCue(OK)
    const d = new CoachDirector({ def: EXERCISE_DEFINITIONS.squat, onCue: () => {} })
    d.onRep(input(9))
    d.onRep(input(10))
    d.onSetEnd()
    expect(spy.mock.calls[0][0].rep_count).toBe(10)
  })

  it('does not fire for a set in which nothing was counted', () => {
    const spy = stubCue(OK)
    const d = new CoachDirector({ def: EXERCISE_DEFINITIONS.squat, onCue: () => {} })
    d.onSetEnd()
    expect(spy).not.toHaveBeenCalled()
  })

  it('lets the request outlive the set that produced it', async () => {
    // The answer arrives during the rest period; aborting at set end would mean the
    // in-workout coach never says anything at all at these latencies.
    const spy = stubCue(OK, 30)
    const cues: string[] = []
    const d = new CoachDirector({ def: EXERCISE_DEFINITIONS.squat, onCue: (c) => cues.push(c.text) })
    d.onRep(input(5))
    d.onSetEnd()
    expect(spy.mock.calls[0][1]?.aborted).toBe(false)
    await vi.waitFor(() => expect(cues).toEqual(['Chest up']))
  })

  it('still respects the session budget', async () => {
    const spy = stubCue(OK)
    const d = new CoachDirector({ def: EXERCISE_DEFINITIONS.squat, onCue: () => {}, budget: 2 })
    for (let set = 0; set < 6; set++) {
      d.onRep(input(5))
      d.onSetEnd()
      await new Promise((r) => setTimeout(r, 1))
    }
    expect(spy.mock.calls.length).toBe(2)
  })
})
