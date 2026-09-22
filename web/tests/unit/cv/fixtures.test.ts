import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ExerciseAnalyzer } from '@/cv/engine/ExerciseAnalyzer'
import { EXERCISE_DEFINITIONS } from '@/cv/exercises'
import type { Pose } from '@/cv/pose/landmarks'

interface Fixture {
  exercise: string
  expectedReps: number
  fps?: number
  frames: { t: number; pose: Pose }[]
}

/**
 * Recorded-landmark fixtures (from /dev/record) are the regression suite for the CV engine.
 * Each JSON in tests/fixtures asserts: counted reps == expectedReps (exact), no crashes,
 * and the run is deterministic. With no fixtures present the suite is skipped.
 */
const dir = join(__dirname, '../../fixtures')
let files: string[] = []
try {
  files = readdirSync(dir).filter((f) => f.endsWith('.json'))
} catch {
  files = []
}

describe('recorded landmark fixtures', () => {
  if (files.length === 0) {
    it.skip('no fixtures recorded yet (use /dev/record)', () => {})
    return
  }
  for (const file of files) {
    it(`${file}: counts exactly expectedReps`, () => {
      const fx = JSON.parse(readFileSync(join(dir, file), 'utf-8')) as Fixture
      const def = EXERCISE_DEFINITIONS[fx.exercise]
      expect(def, `unknown exercise ${fx.exercise}`).toBeTruthy()
      const run = () => {
        const an = new ExerciseAnalyzer(def)
        for (const fr of fx.frames) {
          an.setElapsed(fr.t)
          an.update(fr.pose, fr.t)
        }
        return an.snapshot()
      }
      const a = run()
      const b = run()
      expect(a.reps).toBe(fx.expectedReps)
      expect(b.reps).toBe(a.reps) // deterministic
    })
  }
})
