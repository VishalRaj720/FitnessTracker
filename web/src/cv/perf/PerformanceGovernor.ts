import type { OverlayDetail } from '@/cv/render/PoseRenderer'

export type Tier = 'high' | 'medium' | 'low'

export interface TierProfile {
  model: 'lite' | 'full'
  /** Requested camera constraints. Applied without restarting the stream. */
  capture: { width: number; height: number; frameRate: number }
  /** Ceiling on inference submissions per second. */
  targetHz: number
  /** Downscale the inference input to this width before handing it to the model. */
  inputWidth: number
  detail: OverlayDetail
}

export const TIER_PROFILES: Record<Tier, TierProfile> = {
  high: { model: 'full', capture: { width: 1280, height: 720, frameRate: 60 }, targetHz: 30, inputWidth: 0, detail: 'full' },
  medium: { model: 'lite', capture: { width: 640, height: 480, frameRate: 30 }, targetHz: 24, inputWidth: 0, detail: 'full' },
  low: { model: 'lite', capture: { width: 480, height: 360, frameRate: 30 }, targetHz: 15, inputWidth: 320, detail: 'skeleton' },
}

const ORDER: Tier[] = ['low', 'medium', 'high']

/** Inference-time budgets, in ms, that trigger a move. */
const DOWN_MS: Record<Tier, number> = { high: 45, medium: 80, low: Number.POSITIVE_INFINITY }
const UP_MS: Record<Tier, number> = { high: Number.NEGATIVE_INFINITY, medium: 22, low: 45 }

const EVAL_MS = 1000
const DOWN_VOTES = 3 // react to a struggling device within ~3 s
const UP_VOTES = 5 // but be slow to climb back, so we do not oscillate
const COOLDOWN_MS = 10_000

export interface GovernorOptions {
  initial?: Tier
  /** Cap imposed by the device probe; the governor never climbs above it. */
  maxTier?: Tier
  onChange?: (tier: Tier, profile: TierProfile, reason: string) => void
}

export interface GovernorStats {
  tier: Tier
  p75: number
  hz: number
  samples: number
}

/**
 * Watches real inference cost and moves the pipeline between quality tiers.
 *
 * The thresholds matter less than the anti-flapping rules: a device sitting near a
 * boundary must not oscillate between models, and a tier change must never land in the
 * middle of a set, because swapping the model resets tracking and would corrupt the FSM.
 */
export class PerformanceGovernor {
  private current: Tier
  private maxTier: Tier
  private onChange?: GovernorOptions['onChange']

  private samples: number[] = []
  private windowStart = 0
  private lastEval = 0
  private lastChange = -COOLDOWN_MS
  private downVotes = 0
  private upVotes = 0
  private locked = false
  private pending: { tier: Tier; reason: string } | null = null
  private lastP75 = 0
  private lastHz = 0

  constructor(opts: GovernorOptions = {}) {
    this.maxTier = opts.maxTier ?? 'high'
    this.current = clampTier(opts.initial ?? 'medium', this.maxTier)
    this.onChange = opts.onChange
  }

  get tier(): Tier {
    return this.current
  }

  get profile(): TierProfile {
    return TIER_PROFILES[this.current]
  }

  stats(): GovernorStats {
    return { tier: this.current, p75: Math.round(this.lastP75), hz: Math.round(this.lastHz), samples: this.samples.length }
  }

  /**
   * Lock during countdown and while a set is in progress. Votes keep accumulating so a
   * decision made mid-set is applied the moment it is safe.
   */
  setLocked(locked: boolean): void {
    this.locked = locked
    if (!locked) this.flushPending()
  }

  sample(inferenceMs: number, now: number): void {
    if (!this.windowStart) {
      this.windowStart = now
      this.lastEval = now
    }
    this.samples.push(inferenceMs)
    if (now - this.lastEval < EVAL_MS) return
    this.evaluate(now)
  }

  private evaluate(now: number): void {
    const elapsed = now - this.lastEval
    if (this.samples.length) {
      const sorted = [...this.samples].sort((a, b) => a - b)
      this.lastP75 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))]
      this.lastHz = (this.samples.length * 1000) / Math.max(1, elapsed)
    }
    this.samples.length = 0
    this.lastEval = now

    const p75 = this.lastP75
    if (!p75) return

    if (p75 > DOWN_MS[this.current]) {
      this.downVotes += 1
      this.upVotes = 0
    } else if (p75 < UP_MS[this.current]) {
      this.upVotes += 1
      this.downVotes = 0
    } else {
      this.downVotes = 0
      this.upVotes = 0
    }

    if (this.downVotes >= DOWN_VOTES) {
      this.downVotes = 0
      this.request(step(this.current, -1), `inference p75 ${Math.round(p75)}ms`, now)
    } else if (this.upVotes >= UP_VOTES) {
      this.upVotes = 0
      this.request(step(this.current, 1), `inference p75 ${Math.round(p75)}ms`, now)
    }
  }

  private request(tier: Tier, reason: string, now: number): void {
    const target = clampTier(tier, this.maxTier)
    if (target === this.current) return
    if (now - this.lastChange < COOLDOWN_MS) return
    if (this.locked) {
      this.pending = { tier: target, reason }
      return
    }
    this.apply(target, reason, now)
  }

  private flushPending(): void {
    const p = this.pending
    this.pending = null
    if (p && p.tier !== this.current) this.apply(p.tier, p.reason, performance.now())
  }

  private apply(tier: Tier, reason: string, now: number): void {
    this.current = tier
    this.lastChange = now
    this.samples.length = 0
    this.onChange?.(tier, TIER_PROFILES[tier], reason)
  }
}

function step(tier: Tier, delta: number): Tier {
  const i = ORDER.indexOf(tier)
  return ORDER[Math.min(ORDER.length - 1, Math.max(0, i + delta))]
}

function clampTier(tier: Tier, max: Tier): Tier {
  return ORDER.indexOf(tier) > ORDER.indexOf(max) ? max : tier
}

/**
 * Initial guess before any measurement, and the ceiling the governor may climb to.
 * Only a starting point — the framing stage measures the real cost within ~1.5 s.
 */
export function probeDevice(): { initial: Tier; maxTier: Tier } {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const cores = nav.hardwareConcurrency ?? 4
  const mem = nav.deviceMemory ?? 4
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  if (!mobile && cores >= 8 && mem >= 8) return { initial: 'high', maxTier: 'high' }
  if (mobile && (cores <= 4 || mem <= 3)) return { initial: 'low', maxTier: 'medium' }
  return { initial: 'medium', maxTier: mobile ? 'medium' : 'high' }
}
