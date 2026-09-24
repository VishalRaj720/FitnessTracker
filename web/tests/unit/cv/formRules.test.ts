import { describe, expect, it } from 'vitest'
import { DEMO_CLIPS, sampleClip, sampleClipWorld, type DemoClip } from '@/cv/demo/clips'
import { rigToWorld, type RigFrame } from '@/cv/demo/rig'
import { projectToPose, type DemoView } from '@/cv/demo/project'
import { EXERCISE_DEFINITIONS } from '@/cv/exercises'
import { ExerciseAnalyzer } from '@/cv/engine/ExerciseAnalyzer'
import type { RepKinematics } from '@/cv/engine/FeatureTrace'
import type { Features, FormRule, RepStats, Violation } from '@/cv/engine/types'

/**
 * The deterministic form rules are what speak between the reps, so they have to be right
 * twice over:
 *
 *  1. They must stay silent on correct form. The demo rig is provably correct — every angle
 *     in it is derived from the thresholds the analyzer itself enforces — so a rule that
 *     fires on the demo is a false positive that would nag a user doing nothing wrong.
 *  2. They must be able to fire at all. A rule with an unreachable threshold, or one reading
 *     a feature the exercise stopped producing, is dead weight that looks like coverage.
 *
 * Both halves are checked against every rule in every definition, and the fault table below
 * must name every rule — so adding a rule without proving it works fails the build.
 */

const SAMPLES = 8

interface Fixture {
  f: Features
  rep: RepStats
  history: RepKinematics[]
}

/** Feature series for one pass of a clip, sampled the way the analyzer samples a rep. */
function seriesOf(slug: string, view: DemoView): Record<string, number[]> {
  const clip = DEMO_CLIPS[slug]
  const def = EXERCISE_DEFINITIONS[slug]
  const series: Record<string, number[]> = {}
  for (let i = 0; i < SAMPLES; i++) {
    const u = i / (SAMPLES - 1)
    const f = def.features(projectToPose(sampleClipWorld(clip, u), view))
    for (const key of Object.keys(f)) {
      if (!series[key]) series[key] = []
      series[key].push(f[key])
    }
  }
  return series
}

/**
 * Phase durations taken from the clip's own keyframes: the bottom is the flat stretch that
 * starts at `holdAt`, so a retuned clip changes these rather than drifting away from them.
 */
function phasesOf(slug: string): { descentMs: number; bottomMs: number; ascentMs: number; totalMs: number } {
  const clip = DEMO_CLIPS[slug]
  const iHold = clip.keys.findIndex((k) => Math.abs(k.t - clip.holdAt) < 1e-6)
  const bottomEnd = iHold >= 0 && iHold + 1 < clip.keys.length - 1 ? clip.keys[iHold + 1].t : clip.holdAt
  const total = clip.loopMs
  return {
    descentMs: Math.round(clip.holdAt * total),
    bottomMs: Math.round((bottomEnd - clip.holdAt) * total),
    ascentMs: Math.round((1 - bottomEnd) * total),
    totalMs: total,
  }
}

/** One correct repetition of `slug` as the rules see it, seen from `view`. */
function cleanFixture(slug: string, view: DemoView): Fixture {
  const clip = DEMO_CLIPS[slug]
  const def = EXERCISE_DEFINITIONS[slug]
  const series = seriesOf(slug, view)
  const kinematics: RepKinematics = { series, ...phasesOf(slug) }
  const atTop = def.features(projectToPose(sampleClipWorld(clip, 0), view))
  const atBottom = def.features(projectToPose(sampleClipWorld(clip, clip.holdAt), view))
  const primary = def.fsm ? series[def.fsm.feature] : undefined
  const extreme = !primary ? 0 : def.fsm!.restIs === 'high' ? Math.min(...primary) : Math.max(...primary)
  return {
    f: atBottom,
    rep: {
      extreme,
      durationMs: kinematics.totalMs,
      startTs: 0,
      endTs: kinematics.totalMs,
      atBottom,
      atTop,
      kinematics,
    },
    // Four identical clean reps: enough history for every trend rule to have an opinion,
    // and a flat trend is the correct opinion when nothing is changing.
    history: [0, 1, 2, 3].map(() => ({ series: clone(series), ...phasesOf(slug) })),
  }
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function cloneFixture(fx: Fixture): Fixture {
  return clone(fx)
}

/** The view a rule is judged from: its own, or the one the exercise is filmed from. */
function viewFor(slug: string, rule: FormRule): DemoView {
  return rule.orientation ?? (DEMO_CLIPS[slug].view as DemoView)
}

function check(rule: FormRule, fx: Fixture): boolean {
  return rule.check(fx.f, rule.phase === 'any' ? null : fx.rep, fx.history)
}

/** Replace a whole series, keeping the sample count the rules expect. */
function setSeries(fx: Fixture, key: string, values: number[]): void {
  fx.rep.kinematics!.series[key] = values
}

/** Give each rep in the history its own value of a per-rep measure, oldest first. */
function trend(fx: Fixture, key: string, values: number[]): void {
  fx.history = values.map((v, i) => {
    const k = clone(fx.history[Math.min(i, fx.history.length - 1)])
    k.series[key] = k.series[key].map(() => v)
    return k
  })
}

/**
 * How each rule is provoked, keyed by `slug.ruleId`.
 *
 * Every mutation starts from correct form and changes the one thing the rule is about, so a
 * rule that needs two faults at once to fire shows up here as two edits — which is a useful
 * signal in itself.
 */
const FAULTS: Record<string, (fx: Fixture) => void> = {
  // ---- squat -------------------------------------------------------------------------
  'squat.depth': () => {}, // any partial is too shallow by definition
  'squat.depth_shallow': (fx) => {
    fx.rep.extreme = 105
  },
  'squat.torso_lean': (fx) => {
    fx.rep.atBottom.torsoLean = 62
  },
  'squat.tempo': (fx) => {
    fx.rep.durationMs = 820
  },
  'squat.knee_valgus': (fx) => {
    fx.rep.atBottom.kneeAnkleRatio = 0.62
  },
  'squat.hips_before_chest': (fx) => {
    // Knees straighten out of the hole while the torso stays folded over.
    setSeries(fx, 'kneeAngle', [172, 140, 104, 92, 92, 142, 166, 176])
    setSeries(fx, 'torsoLean', [5, 28, 38, 42, 42, 42, 40, 22])
  },
  'squat.lean_creep': (fx) => {
    trend(fx, 'torsoLean', [36, 42, 48])
  },
  'squat.depth_fade': (fx) => {
    trend(fx, 'kneeAngle', [90, 98, 106])
  },
  'squat.dropping': (fx) => {
    fx.rep.kinematics!.descentMs = 280
    fx.rep.kinematics!.ascentMs = 660
  },
  'squat.heel_lift': (fx) => {
    fx.rep.atBottom.heelLift = 0.16
  },
  'squat.shallow_with_lean': (fx) => {
    fx.rep.extreme = 108
    fx.rep.atBottom.torsoLean = 46
  },
  'squat.knee_cave_late': (fx) => {
    // Fine at the bottom, collapsing on the way up.
    fx.rep.atBottom.kneeAnkleRatio = 0.95
    setSeries(fx, 'kneeAnkleRatio', [1, 1, 0.97, 0.95, 0.95, 0.78, 0.74, 0.9])
  },

  // ---- push-up -----------------------------------------------------------------------
  'pushup.depth': () => {},
  'pushup.hip_sag': (fx) => {
    fx.rep.atBottom.bodyLine = 148
    fx.rep.atBottom.hipOffset = 0.3
  },
  'pushup.hip_pike': (fx) => {
    fx.rep.atBottom.bodyLine = 148
    fx.rep.atBottom.hipOffset = -0.3
  },
  'pushup.tempo': (fx) => {
    fx.rep.durationMs = 720
  },
  'pushup.sag_progressive': (fx) => {
    trend(fx, 'bodyLine', [178, 172, 166])
  },
  'pushup.range_fade': (fx) => {
    trend(fx, 'elbowAngle', [88, 96, 104])
  },
  'pushup.sag_to_reach': (fx) => {
    fx.rep.atBottom.hipOffset = 0.2
    fx.rep.atTop.hipOffset = 0.01
  },
  'pushup.dropping': (fx) => {
    fx.rep.kinematics!.descentMs = 250
    fx.rep.kinematics!.ascentMs = 460
  },

  // ---- lunge -------------------------------------------------------------------------
  'lunge.depth': () => {},
  'lunge.torso_lean': (fx) => {
    fx.rep.atBottom.torsoLean = 38
  },
  'lunge.tempo': (fx) => {
    fx.rep.durationMs = 900
  },
  'lunge.short_stance': (fx) => {
    fx.rep.atBottom.stance = 0.55
  },
  'lunge.knee_past_toes': (fx) => {
    fx.rep.atBottom.kneeOverToe = 0.14
  },
  'lunge.stance_collapse': (fx) => {
    // Travelling forward over the front foot instead of straight down.
    setSeries(fx, 'stance', [1.9, 1.85, 1.7, 1.55, 1.5, 1.5, 1.6, 1.8])
  },
  'lunge.side_asymmetry': (fx) => {
    trend(fx, 'minKnee', [92, 118, 93, 119])
  },
  'lunge.depth_fade': (fx) => {
    trend(fx, 'minKnee', [96, 104, 112])
  },
  'lunge.lean_creep': (fx) => {
    trend(fx, 'torsoLean', [10, 16, 22])
  },
  'lunge.dropping': (fx) => {
    fx.rep.kinematics!.descentMs = 250
    fx.rep.kinematics!.ascentMs = 620
  },

  // ---- jumping jack ------------------------------------------------------------------
  'jumping_jack.feet_wide': () => {},
  'jumping_jack.arms_up': (fx) => {
    setSeries(fx, 'armRaise', [-0.4, -0.2, 0, 0.2, 0.2, 0, -0.2, -0.4])
  },
  'jumping_jack.feet_narrow': (fx) => {
    fx.rep.extreme = 1.82
  },
  'jumping_jack.arms_stall': (fx) => {
    setSeries(fx, 'armRaise', [-0.4, 0, 0.3, 0.5, 0.5, 0.3, 0, -0.4])
  },
  'jumping_jack.arms_lagging': (fx) => {
    // Feet arrive at full spread well before the hands finish their sweep.
    setSeries(fx, 'feetSpread', [0.6, 1.4, 2.3, 2.4, 1.9, 1.2, 0.7, 0.6])
    setSeries(fx, 'armRaise', [-0.4, -0.1, 0.4, 0.8, 1.1, 0.7, 0.1, -0.4])
  },
  'jumping_jack.amplitude_fade': (fx) => {
    trend(fx, 'feetSpread', [2.4, 2.2, 2.0])
  },
  'jumping_jack.arms_fade': (fx) => {
    trend(fx, 'armRaise', [1.1, 0.95, 0.8])
  },

  // ---- plank (frame rules; only the feature vector matters) ---------------------------
  'plank.hip_sag': (fx) => {
    fx.f.bodyLine = 150
    fx.f.hipOffset = 0.2
  },
  'plank.hip_pike': (fx) => {
    fx.f.bodyLine = 150
    fx.f.hipOffset = -0.2
  },
  'plank.hip_sag_severe': (fx) => {
    fx.f.bodyLine = 132
    fx.f.hipOffset = 0.35
  },
  'plank.hip_pike_severe': (fx) => {
    fx.f.bodyLine = 132
    fx.f.hipOffset = -0.35
  },
  'plank.knee_bend': (fx) => {
    fx.f.kneeAngle = 140
  },
}

describe('form rules stay silent on correct form', () => {
  it('finds no fault anywhere in the demo rig, from the view each rule requires', () => {
    for (const [slug, def] of Object.entries(EXERCISE_DEFINITIONS)) {
      for (const rule of def.rules) {
        if (rule.phase === 'partial') continue // a partial is a fault by construction
        const fx = cleanFixture(slug, viewFor(slug, rule))
        expect(check(rule, fx), `${slug}.${rule.id} fires on correct form`).toBe(false)
      }
    }
  })

  it('scores a full set of demo reps at 100 through the real analyzer', () => {
    for (const slug of ['squat', 'pushup', 'lunge', 'jumping_jack']) {
      const clip = DEMO_CLIPS[slug]
      const def = EXERCISE_DEFINITIONS[slug]
      const an = new ExerciseAnalyzer(def)
      const violations: Violation[] = []
      let reps = 0
      const step = 1000 / 30
      // Six reps: long enough that the trend rules have history and would fire if they
      // misread a set of identical, correct repetitions as a decline.
      for (let t = 0; t <= clip.loopMs * 6; t += step) {
        const u = (t % clip.loopMs) / clip.loopMs
        for (const e of an.update(projectToPose(sampleClipWorld(clip, u), clip.view), t)) {
          if (e.type === 'rep') {
            reps += 1
            violations.push(...e.violations)
          } else if (e.type === 'partial') violations.push(...e.violations)
        }
      }
      expect(reps, `${slug} counted no reps`).toBeGreaterThanOrEqual(4)
      expect(violations.map((v) => v.ruleId), slug).toEqual([])
      expect(an.snapshot().formScore, slug).toBe(100)
    }
  })

  it('holds a plank for six seconds without a correction', () => {
    const clip = DEMO_CLIPS.plank
    const an = new ExerciseAnalyzer(EXERCISE_DEFINITIONS.plank)
    let ticks = 0
    for (let t = 0; t <= 6000; t += 1000 / 30) {
      const u = (t % clip.loopMs) / clip.loopMs
      for (const e of an.update(projectToPose(sampleClipWorld(clip, u), clip.view), t)) {
        if (e.type !== 'hold_tick') continue
        ticks += 1
        expect(e.inTolerance, `t=${t}`).toBe(true)
        expect(e.violations.map((v) => v.ruleId), `t=${t}`).toEqual([])
      }
    }
    expect(ticks).toBeGreaterThan(100)
  })
})

describe('every form rule can actually fire', () => {
  const allIds = Object.entries(EXERCISE_DEFINITIONS).flatMap(([slug, def]) => def.rules.map((r) => `${slug}.${r.id}`))

  it('has a provoking case for every rule, and no case for a rule that is gone', () => {
    expect(Object.keys(FAULTS).sort()).toEqual([...allIds].sort())
  })

  it('carries enough rules per exercise to coach with', () => {
    // The in-rep layer is the whole point of not going to a model mid-set, so a movement
    // with two or three rules is not coaching, it is rep counting with a warning.
    for (const [slug, def] of Object.entries(EXERCISE_DEFINITIONS)) {
      const min = def.mode === 'hold' ? 5 : 7
      expect(def.rules.length, `${slug} has only ${def.rules.length} rules`).toBeGreaterThanOrEqual(min)
    }
  })

  for (const [slug, def] of Object.entries(EXERCISE_DEFINITIONS)) {
    for (const rule of def.rules) {
      const key = `${slug}.${rule.id}`
      it(`${key} fires on the fault it describes`, () => {
        const fault = FAULTS[key]
        expect(fault, `no fault case for ${key}`).toBeTruthy()
        const fx = cloneFixture(cleanFixture(slug, viewFor(slug, rule)))
        fault(fx)
        expect(check(rule, fx)).toBe(true)
      })
    }
  }

  it('gives every rule a cue in both languages and a sane penalty', () => {
    for (const [slug, def] of Object.entries(EXERCISE_DEFINITIONS)) {
      for (const rule of def.rules) {
        expect(rule.cue.en.length, `${slug}.${rule.id} en`).toBeGreaterThan(3)
        expect(rule.cue.hi.length, `${slug}.${rule.id} hi`).toBeGreaterThan(3)
        // Holds score on time in tolerance, so their rules must not carry a penalty.
        if (def.mode === 'hold') expect(rule.penalty, `${slug}.${rule.id}`).toBe(0)
        else expect(rule.penalty, `${slug}.${rule.id}`).toBeGreaterThan(0)
      }
    }
  })

  it('keeps rule ids unique within an exercise', () => {
    for (const [slug, def] of Object.entries(EXERCISE_DEFINITIONS)) {
      const ids = def.rules.map((r) => r.id)
      expect(new Set(ids).size, slug).toBe(ids.length)
    }
  })
})

describe('trend rules wait for evidence', () => {
  it('says nothing about a declining trend until there are enough reps', () => {
    // The first reps of a set have no history, and a rule that guesses from one rep would
    // accuse a user of fading before they have had the chance to.
    for (const [slug, def] of Object.entries(EXERCISE_DEFINITIONS)) {
      for (const rule of def.rules) {
        if (rule.phase === 'partial') continue
        const fx = cleanFixture(slug, viewFor(slug, rule))
        for (const n of [0, 1, 2]) {
          const short: Fixture = { ...cloneFixture(fx), history: fx.history.slice(0, n) }
          expect(check(rule, short), `${slug}.${rule.id} with ${n} reps of history`).toBe(false)
        }
      }
    }
  })
})

/**
 * The fixtures above prove each rule reacts to the numbers it claims to read. These prove the
 * numbers arrive: a faulty movement is built on the same rig as the demo, played through the
 * real analyzer at a real frame rate, and has to come back as the right correction.
 *
 * This is the half that catches thresholds calibrated against imagined data. One rule for
 * bouncing out of the bottom was removed after this harness showed the signal it relied on —
 * the FSM's `bottomMs` — barely moves between a paused rep and a bounced one.
 */
describe('faulty movements come back as the right correction', () => {
  /** Play a sequence of one-rep clips through a single analyzer on a continuous clock. */
  function runSequence(slug: string, clips: DemoClip[], fps = 24): { reps: number; fired: Set<string> } {
    const an = new ExerciseAnalyzer(EXERCISE_DEFINITIONS[slug])
    const fired = new Set<string>()
    const step = 1000 / fps
    let reps = 0
    let t = 0
    for (const clip of clips) {
      for (let dt = 0; dt < clip.loopMs; dt += step, t += step) {
        const pose = projectToPose(rigToWorld(sampleClip(clip, dt / clip.loopMs)), clip.view)
        for (const e of an.update(pose, t)) {
          if (e.type === 'rep') {
            reps += 1
            for (const v of e.violations) fired.add(v.ruleId)
          } else if (e.type === 'partial') for (const v of e.violations) fired.add(v.ruleId)
        }
      }
    }
    return { reps, fired }
  }

  const squatClip = DEMO_CLIPS.squat
  const squatTop = squatClip.keys[0].frame
  const squatBottom = squatClip.keys[1].frame

  /** A squat clip whose bottom pose is overridden, keeping the top and the timing. */
  function squatVariant(bottom: RigFrame, loopMs = squatClip.loopMs): DemoClip {
    return { ...squatClip, loopMs, keys: [{ t: 0, frame: squatTop }, { t: 0.45, frame: bottom }, { t: 0.6, frame: bottom }, { t: 1, frame: squatTop }] }
  }

  /** Knee angle is 180 - |shank.flex - thigh.flex|, so the shank sets the depth. */
  function squatToDepth(shankFlex: number, torsoLean = squatBottom.torsoLean): RigFrame {
    return { ...squatBottom, torsoLean, shankL: { flex: shankFlex }, shankR: { flex: shankFlex } }
  }

  it('calls out a dropped descent', () => {
    // Same pose, but most of the loop is spent coming back up.
    const dropped: DemoClip = { ...squatClip, loopMs: 2400, holdAt: 0.25, keys: [{ t: 0, frame: squatTop }, { t: 0.25, frame: squatBottom }, { t: 1, frame: squatTop }] }
    const { reps, fired } = runSequence('squat', [dropped, dropped, dropped])
    expect(reps).toBeGreaterThanOrEqual(2)
    expect(fired.has('dropping')).toBe(true)
  })

  it('calls out standing up hips-first', () => {
    // Out of the bottom the knees straighten to 166 while the torso stays folded at 40.
    const goodMorning: RigFrame = { ...squatBottom, torsoLean: 40, thighL: { flex: 8 }, thighR: { flex: 8 }, shankL: { flex: -6 }, shankR: { flex: -6 } }
    const clip: DemoClip = {
      ...squatClip,
      loopMs: 2600,
      keys: [
        { t: 0, frame: squatTop },
        { t: 0.4, frame: squatBottom },
        { t: 0.5, frame: squatBottom },
        { t: 0.62, frame: goodMorning },
        { t: 1, frame: squatTop },
      ],
    }
    const { reps, fired } = runSequence('squat', [clip, clip, clip])
    expect(reps).toBeGreaterThanOrEqual(2)
    expect(fired.has('hips_before_chest')).toBe(true)
  })

  it('notices depth fading across a set before the reps stop counting', () => {
    // Every rep still passes the FSM's depth gate, so nothing else would complain.
    const fading = [-20, -20, -14, -8].map((shank) => squatVariant(squatToDepth(shank)))
    const { reps, fired } = runSequence('squat', fading)
    expect(reps).toBeGreaterThanOrEqual(3)
    expect(fired.has('depth_fade')).toBe(true)
    expect(fired.has('depth'), 'no rep should have been rejected as a partial').toBe(false)
  })

  it('notices the chest dropping across a set before the lean rule would', () => {
    const leaning = [38, 38, 43, 48].map((lean) => squatVariant(squatToDepth(-20, lean)))
    const { reps, fired } = runSequence('squat', leaning)
    expect(reps).toBeGreaterThanOrEqual(3)
    expect(fired.has('lean_creep')).toBe(true)
    // Still under the 50 degrees that trips `torso_lean`: the creep rule is the early warning.
    expect(fired.has('torso_lean')).toBe(false)
  })

  it('calls out arms trailing behind the jump', () => {
    const jack = DEMO_CLIPS.jumping_jack
    const closed = jack.keys[0].frame
    const open = jack.keys[1].frame
    const legsOpenArmsLow: RigFrame = { ...open, upperArmL: { flex: 0, abduct: 95 }, upperArmR: { flex: 0, abduct: 95 }, forearmL: { flex: 0, abduct: 95 }, forearmR: { flex: 0, abduct: 95 } }
    const legsClosingArmsUp: RigFrame = { ...open, thighL: { flex: 0, abduct: 10 }, thighR: { flex: 0, abduct: 10 }, shankL: { flex: 0, abduct: 10 }, shankR: { flex: 0, abduct: 10 } }
    const lagging: DemoClip = {
      ...jack,
      loopMs: 1600,
      keys: [
        { t: 0, frame: closed },
        { t: 0.5, frame: legsOpenArmsLow },
        { t: 0.7, frame: legsClosingArmsUp },
        { t: 1, frame: closed },
      ],
    }
    const { reps, fired } = runSequence('jumping_jack', [lagging, lagging, lagging])
    expect(reps).toBeGreaterThanOrEqual(2)
    expect(fired.has('arms_lagging')).toBe(true)
  })

  it('calls out a lunge stepped too short', () => {
    const lungeClip = DEMO_CLIPS.lunge
    const bottom = lungeClip.keys[1].frame
    // Feet nearly level front-to-back, and the front knee still bent to 90 — which it can
    // only manage by travelling out over the toes. That pairing is the fault, not two faults.
    const short: RigFrame = {
      ...bottom,
      thighL: { flex: 40 },
      shankL: { flex: -50 },
      thighR: { flex: -10 },
      shankR: { flex: -30 },
    }
    const clip: DemoClip = { ...lungeClip, keys: [lungeClip.keys[0], { t: 0.45, frame: short }, { t: 0.6, frame: short }, lungeClip.keys[3]] }
    const { reps, fired } = runSequence('lunge', [clip, clip, clip])
    expect(reps).toBeGreaterThanOrEqual(2)
    expect(fired.has('short_stance') || fired.has('knee_past_toes')).toBe(true)
  })
})
