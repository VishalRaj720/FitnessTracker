import { describe, expect, it } from 'vitest'
import { DEMO_CLIPS, sampleClipWorld } from '@/cv/demo/clips'
import { projectToPose } from '@/cv/demo/project'
import { EXERCISE_DEFINITIONS } from '@/cv/exercises'
import { estimateFacing } from '@/cv/geometry/orientation'

/**
 * The demo figure is what teaches the user what "deep enough" looks like, so it is only
 * honest if the pose it shows would actually satisfy the analyzer. These tests run the real
 * ExerciseDefinition.features() over the generated frames: if a threshold is retuned and the
 * demo is not, this fails rather than quietly teaching the old depth.
 */

function poseAt(slug: string, u: number) {
  const clip = DEMO_CLIPS[slug]
  return projectToPose(sampleClipWorld(clip, u), clip.view)
}

function featuresAt(slug: string, u: number) {
  return EXERCISE_DEFINITIONS[slug].features(poseAt(slug, u))
}

describe('demo clips satisfy their own exercise definitions', () => {
  it('covers every camera-tracked exercise', () => {
    expect(Object.keys(DEMO_CLIPS).sort()).toEqual(Object.keys(EXERCISE_DEFINITIONS).sort())
  })

  it('presents each exercise from the view its definition requires', () => {
    for (const [slug, clip] of Object.entries(DEMO_CLIPS)) {
      const want = EXERCISE_DEFINITIONS[slug].orientation
      if (want === 'any') continue
      expect(clip.view, slug).toBe(want)
      // The silhouette check must also agree, or the tutorial would nag about turning.
      expect(estimateFacing(poseAt(slug, clip.holdAt)), slug).toBe(want)
    }
  })

  describe('squat', () => {
    it('reaches a depth the FSM counts and the depth rules accept', () => {
      const { kneeAngle } = featuresAt('squat', DEMO_CLIPS.squat.holdAt)
      const fsm = EXERCISE_DEFINITIONS.squat.fsm!
      expect(kneeAngle).toBeLessThan(fsm.bottomEnter)
      expect(kneeAngle).toBeLessThanOrEqual(97) // else 'a bit lower next time' would fire
    })

    it('returns to a standing position the FSM accepts as the top', () => {
      const { kneeAngle } = featuresAt('squat', 0)
      expect(kneeAngle).toBeGreaterThan(EXERCISE_DEFINITIONS.squat.fsm!.topEnter)
    })

    it('keeps the chest up at the bottom', () => {
      const { torsoLean } = featuresAt('squat', DEMO_CLIPS.squat.holdAt)
      expect(torsoLean).toBeLessThan(50) // the 'chest up' rule
      expect(torsoLean).toBeGreaterThan(10) // but still a real hip hinge, not a knee bend
    })
  })

  describe('pushup', () => {
    it('reaches an elbow angle the FSM counts', () => {
      const { elbowAngle } = featuresAt('pushup', DEMO_CLIPS.pushup.holdAt)
      expect(elbowAngle).toBeLessThan(EXERCISE_DEFINITIONS.pushup.fsm!.bottomEnter)
    })

    it('holds a straight body line throughout', () => {
      for (const u of [0, 0.25, 0.45, 0.75]) {
        const { bodyLine } = featuresAt('pushup', u)
        expect(bodyLine, `u=${u}`).toBeGreaterThan(155) // the 'hip sag' rule
      }
    })
  })

  describe('lunge', () => {
    it('drops the front knee far enough to count', () => {
      const { minKnee } = featuresAt('lunge', DEMO_CLIPS.lunge.holdAt)
      expect(minKnee).toBeLessThan(EXERCISE_DEFINITIONS.lunge.fsm!.bottomEnter)
    })

    it('stays upright', () => {
      const { torsoLean } = featuresAt('lunge', DEMO_CLIPS.lunge.holdAt)
      expect(torsoLean).toBeLessThan(30) // the 'stay upright' rule
    })
  })

  describe('jumping jack', () => {
    it('opens wider than the FSM needs and closes tighter than it needs', () => {
      const fsm = EXERCISE_DEFINITIONS.jumping_jack.fsm!
      expect(featuresAt('jumping_jack', 0.5).feetSpread).toBeGreaterThan(fsm.bottomEnter)
      expect(featuresAt('jumping_jack', 0).feetSpread).toBeLessThan(fsm.topEnter)
    })

    it('takes the arms fully overhead', () => {
      const { armRaise } = featuresAt('jumping_jack', 0.5)
      expect(armRaise).toBeGreaterThan(0.35) // the 'arms all the way up' rule
    })
  })

  describe('plank', () => {
    it('holds inside the tolerance band the timer requires', () => {
      const hold = EXERCISE_DEFINITIONS.plank.hold!
      for (const u of [0, 0.5, 1]) {
        const { bodyLine } = featuresAt('plank', u)
        expect(bodyLine, `u=${u}`).toBeGreaterThanOrEqual(hold.min)
        expect(bodyLine, `u=${u}`).toBeLessThanOrEqual(hold.max)
      }
    })
  })

  it('never violates a rule that is evaluated every frame', () => {
    for (const slug of Object.keys(DEMO_CLIPS)) {
      const def = EXERCISE_DEFINITIONS[slug]
      for (let i = 0; i <= 10; i++) {
        const f = def.features(poseAt(slug, i / 10))
        for (const rule of def.rules) {
          if (rule.phase !== 'any') continue
          expect(rule.check(f, null), `${slug} @${i / 10} violates ${rule.id}`).toBe(false)
        }
      }
    }
  })

  it('only warns about mistakes the analyzer can actually detect', () => {
    // The tutorial's commonMistakes are keyed by FormRule id. If a rule is renamed or
    // dropped, the tutorial would silently keep teaching a correction nothing checks for.
    for (const [slug, def] of Object.entries(EXERCISE_DEFINITIONS)) {
      const tutorial = def.tutorial
      expect(tutorial, `${slug} has no tutorial`).toBeTruthy()
      const ruleIds = new Set(def.rules.map((r) => r.id))
      for (const key of Object.keys(tutorial!.commonMistakes)) {
        expect(ruleIds.has(key), `${slug}: commonMistakes."${key}" matches no rule`).toBe(true)
      }
      expect(tutorial!.steps.length).toBeGreaterThan(1)
      expect(tutorial!.keyPoints.length).toBeGreaterThan(1)
    }
  })

  it('produces finite landmarks that never sink below the floor', () => {
    for (const slug of Object.keys(DEMO_CLIPS)) {
      for (let i = 0; i <= 10; i++) {
        const world = sampleClipWorld(DEMO_CLIPS[slug], i / 10)
        expect(world.every(Number.isFinite), slug).toBe(true)
        // y is down-positive, so the lowest contact point is the largest y. Grounded poses
        // sit at 0; a jump lifts the whole figure to a negative y. Neither may go below 0.
        let lowest = -Infinity
        for (let k = 1; k < world.length; k += 3) lowest = Math.max(lowest, world[k])
        expect(lowest, `${slug} @${i / 10}`).toBeLessThanOrEqual(1e-5)
      }
    }
  })

  it('leaves the feet planted except mid-jump', () => {
    const grounded = (slug: string, u: number) => {
      const world = sampleClipWorld(DEMO_CLIPS[slug], u)
      let lowest = -Infinity
      for (let k = 1; k < world.length; k += 3) lowest = Math.max(lowest, world[k])
      return lowest
    }
    for (const slug of ['squat', 'pushup', 'lunge', 'plank']) {
      for (let i = 0; i <= 10; i++) expect(grounded(slug, i / 10), slug).toBeCloseTo(0, 5)
    }
    // The jumping jack is the one clip that leaves the ground, at full spread.
    expect(grounded('jumping_jack', 0.5)).toBeLessThan(-0.03)
    expect(grounded('jumping_jack', 0)).toBeCloseTo(0, 5)
  })
})

describe('coaching knowledge', () => {
  it('describes exactly the features the exercise actually produces', () => {
    // A glossary key that no longer exists would send the model a definition for a series
    // it never sees; a missing one leaves it guessing what a number means.
    for (const [slug, def] of Object.entries(EXERCISE_DEFINITIONS)) {
      const coaching = def.coaching
      expect(coaching, `${slug} has no coaching block`).toBeTruthy()
      const produced = Object.keys(def.features(poseAt(slug, 0))).sort()
      expect(Object.keys(coaching!.glossary).sort(), slug).toEqual(produced)
    }
  })

  it('only sets reference bands for real features', () => {
    for (const [slug, def] of Object.entries(EXERCISE_DEFINITIONS)) {
      const produced = new Set(Object.keys(def.features(poseAt(slug, 0))))
      for (const key of Object.keys(def.coaching!.reference.angles)) {
        expect(produced.has(key), `${slug}: reference band for unknown feature "${key}"`).toBe(true)
      }
    }
  })

  it('carries enough coaching notes to reason with', () => {
    for (const [slug, def] of Object.entries(EXERCISE_DEFINITIONS)) {
      expect(def.coaching!.notes.length, slug).toBeGreaterThan(200)
    }
  })
})
