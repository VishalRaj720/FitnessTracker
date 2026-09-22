import { describe, expect, it } from 'vitest'
import { RepCounterFSM } from '@/cv/engine/RepCounterFSM'
import { ExerciseAnalyzer } from '@/cv/engine/ExerciseAnalyzer'
import { squat } from '@/cv/exercises/squat'
import { jumpingJack } from '@/cv/exercises/jumpingJack'
import { plank } from '@/cv/exercises/plank'
import type { Pose } from '@/cv/pose/landmarks'
import { LM, POSE_LANDMARK_COUNT } from '@/cv/pose/landmarks'

const SQUAT_CFG = squat.fsm!

/** Drive the FSM with a synthetic knee-angle trajectory at a given fps. */
function runSequence(fsm: RepCounterFSM, values: number[], fps = 20) {
  const reps: number[] = []
  let partials = 0
  values.forEach((v, i) => {
    const out = fsm.update({ kneeAngle: v }, (i * 1000) / fps)
    if (out.kind === 'rep') reps.push(out.stats.extreme)
    if (out.kind === 'partial') partials += 1
  })
  return { reps, partials }
}

/** Triangle wave from top -> bottom -> top over `frames` frames. */
function rep(top: number, bottom: number, frames: number): number[] {
  const half = Math.floor(frames / 2)
  const out: number[] = []
  for (let i = 0; i <= half; i++) out.push(top - ((top - bottom) * i) / half)
  for (let i = half - 1; i >= 0; i--) out.push(top - ((top - bottom) * i) / half)
  return out
}

function hold(v: number, frames: number): number[] {
  return Array.from({ length: frames }, () => v)
}

describe('RepCounterFSM (squat config)', () => {
  it('counts 5 clean squats and reports depth', () => {
    const fsm = new RepCounterFSM(SQUAT_CFG)
    const seq = [...hold(172, 10), ...rep(172, 88, 30), ...hold(172, 5), ...rep(172, 90, 30), ...hold(172, 5), ...rep(172, 85, 30), ...hold(172, 5), ...rep(172, 92, 30), ...hold(172, 5), ...rep(172, 89, 30), ...hold(172, 10)]
    const { reps, partials } = runSequence(fsm, seq)
    expect(reps.length).toBe(5)
    expect(partials).toBe(0)
    expect(Math.min(...reps)).toBeLessThan(100)
  })

  it('does not count a shallow rep, flags it as partial', () => {
    const fsm = new RepCounterFSM(SQUAT_CFG)
    const seq = [...hold(172, 10), ...rep(172, 125, 30), ...hold(172, 10)]
    const { reps, partials } = runSequence(fsm, seq)
    expect(reps.length).toBe(0)
    expect(partials).toBe(1)
  })

  it('ignores a tiny shuffle (does not even call it a partial)', () => {
    const fsm = new RepCounterFSM(SQUAT_CFG)
    const seq = [...hold(172, 10), ...rep(172, 145, 12), ...hold(172, 10)]
    const { reps, partials } = runSequence(fsm, seq)
    expect(reps.length).toBe(0)
    expect(partials).toBe(0)
  })

  it('is robust to +-3 degree jitter (no double counts)', () => {
    const fsm = new RepCounterFSM(SQUAT_CFG)
    let seed = 7
    const noise = () => {
      seed = (seed * 9301 + 49297) % 233280
      return (seed / 233280 - 0.5) * 6
    }
    const clean = [...hold(172, 10), ...rep(172, 88, 30), ...hold(172, 8), ...rep(172, 90, 30), ...hold(172, 8), ...rep(172, 86, 30), ...hold(172, 10)]
    const noisy = clean.map((v) => v + noise())
    const { reps } = runSequence(fsm, noisy)
    expect(reps.length).toBe(3)
  })

  it('rejects impossibly fast reps as jitter', () => {
    const fsm = new RepCounterFSM(SQUAT_CFG)
    // 6 frames at 20 fps = 300 ms, below minRepMs
    const seq = [...hold(172, 10), ...rep(172, 88, 6), ...hold(172, 10)]
    const { reps } = runSequence(fsm, seq)
    expect(reps.length).toBe(0)
  })

  it('handles a low-rest exercise (jumping jack) via restIs=low', () => {
    const fsm = new RepCounterFSM(jumpingJack.fsm!)
    const seq: number[] = []
    const open = (frames: number) => {
      const half = Math.floor(frames / 2)
      for (let i = 0; i <= half; i++) seq.push(0.8 + ((2.2 - 0.8) * i) / half)
      for (let i = half - 1; i >= 0; i--) seq.push(0.8 + ((2.2 - 0.8) * i) / half)
    }
    for (let i = 0; i < 4; i++) seq.push(0.8)
    for (let r = 0; r < 4; r++) {
      open(16)
      seq.push(0.8, 0.8)
    }
    let count = 0
    seq.forEach((v, i) => {
      if (fsm.update({ feetSpread: v }, i * 50).kind === 'rep') count++
    })
    expect(count).toBe(4)
  })
})

/** Build a synthetic side-view pose with the given knee angle (right side, facing left). */
function squatPose(kneeAngleDeg: number, lean = 10): Pose {
  const p: Pose = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 }))
  const ankle = { x: 0.5, y: 0.9 }
  const thigh = 0.2
  const shin = 0.2
  // knee above ankle; hip rotated by knee angle
  const knee = { x: ankle.x + 0.02, y: ankle.y - shin }
  const theta = ((180 - kneeAngleDeg) * Math.PI) / 180
  const hip = { x: knee.x - Math.sin(theta) * thigh, y: knee.y - Math.cos(theta) * thigh }
  const leanRad = (lean * Math.PI) / 180
  const shoulder = { x: hip.x - Math.sin(leanRad) * 0.25, y: hip.y - Math.cos(leanRad) * 0.25 }
  const set = (i: number, pt: { x: number; y: number }, dx = 0) => {
    p[i] = { x: pt.x + dx, y: pt.y, z: 0, visibility: 0.95 }
  }
  set(LM.L_ANKLE, ankle, 0.01)
  set(LM.R_ANKLE, ankle)
  set(LM.L_KNEE, knee, 0.01)
  set(LM.R_KNEE, knee)
  set(LM.L_HIP, hip, 0.01)
  set(LM.R_HIP, hip)
  set(LM.L_SHOULDER, shoulder, 0.01)
  set(LM.R_SHOULDER, shoulder)
  set(LM.NOSE, { x: shoulder.x, y: shoulder.y - 0.12 })
  return p
}

describe('ExerciseAnalyzer (squat definition)', () => {
  it('counts reps from poses and scores form', () => {
    const an = new ExerciseAnalyzer(squat, { smoothing: false })
    const angles = [...hold(172, 10), ...rep(172, 88, 40), ...hold(172, 8), ...rep(172, 90, 40), ...hold(172, 10)]
    let reps = 0
    angles.forEach((a, i) => {
      for (const e of an.update(squatPose(a), i * 50)) if (e.type === 'rep') reps = e.count
    })
    expect(reps).toBe(2)
    const snap = an.snapshot()
    expect(snap.reps).toBe(2)
    expect(snap.formScore).toBeGreaterThanOrEqual(75)
    expect(snap.repEvents.length).toBe(2)
  })

  it('flags "Chest up" when leaning at the bottom', () => {
    const an = new ExerciseAnalyzer(squat, { smoothing: false })
    const angles = [...hold(172, 10), ...rep(172, 88, 40), ...hold(172, 10)]
    const cues: string[] = []
    angles.forEach((a, i) => {
      const lean = a < 120 ? 60 : 10
      for (const e of an.update(squatPose(a, lean), i * 50)) if (e.type === 'rep') cues.push(...e.violations.map((v) => v.ruleId))
    })
    expect(cues).toContain('torso_lean')
  })

  it('freezes when landmarks disappear and resumes after', () => {
    const an = new ExerciseAnalyzer(squat, { smoothing: false })
    const angles = [...hold(172, 10), ...rep(172, 88, 40), ...hold(172, 8)]
    let t = 0
    const feed = (a: number) => an.update(squatPose(a), (t += 50))
    let reps = 0
    let gatedSeen = false
    for (const a of angles) for (const e of feed(a)) if (e.type === 'rep') reps = e.count
    for (let i = 0; i < 20; i++) for (const e of an.update(null, (t += 50))) if (e.type === 'gated') gatedSeen = true
    for (const a of [...hold(172, 10), ...rep(172, 88, 40), ...hold(172, 8)]) for (const e of feed(a)) if (e.type === 'rep') reps = e.count
    expect(gatedSeen).toBe(true)
    expect(reps).toBe(2)
  })
})

describe('ExerciseAnalyzer (plank hold)', () => {
  it('accumulates time only while the body line is within tolerance', () => {
    const an = new ExerciseAnalyzer(plank, { smoothing: false })
    // side-view straight body: shoulder, hip, ankle nearly collinear
    const straight: Pose = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 }))
    const set = (i: number, x: number, y: number) => {
      straight[i] = { x, y, z: 0, visibility: 0.95 }
    }
    set(LM.L_SHOULDER, 0.2, 0.5)
    set(LM.R_SHOULDER, 0.21, 0.5)
    set(LM.L_HIP, 0.5, 0.52)
    set(LM.R_HIP, 0.51, 0.52)
    set(LM.L_ANKLE, 0.8, 0.55)
    set(LM.R_ANKLE, 0.81, 0.55)
    const sag: Pose = straight.map((l) => ({ ...l }))
    sag[LM.L_HIP] = { x: 0.5, y: 0.66, z: 0, visibility: 0.95 }
    sag[LM.R_HIP] = { x: 0.51, y: 0.66, z: 0, visibility: 0.95 }

    let heldMs = 0
    let t = 0
    let sawSagCue = false
    for (let i = 0; i < 40; i++) heldMs = an.update(straight, (t += 50)).find((e) => e.type === 'hold_tick')!.heldMs as number
    const held1 = heldMs
    for (let i = 0; i < 40; i++) {
      const tick = an.update(sag, (t += 50)).find((e) => e.type === 'hold_tick')
      if (tick && tick.type === 'hold_tick') {
        heldMs = tick.heldMs
        if (!tick.inTolerance && tick.violations.some((v) => v.ruleId === 'hip_sag')) sawSagCue = true
      }
    }
    expect(held1).toBeGreaterThan(1500)
    expect(heldMs - held1).toBeLessThan(400) // paused (only grace frames counted)
    expect(sawSagCue).toBe(true)
  })
})
