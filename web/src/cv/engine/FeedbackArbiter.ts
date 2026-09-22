import type { AnalyzerEvent, Violation } from '@/cv/engine/types'

export interface Cue {
  text: string
  tone: 'correction' | 'praise' | 'count' | 'info'
  speak: boolean
}

export interface ArbiterOptions {
  minGapMs?: number // min time between spoken cues
  countEvery?: number // announce every Nth rep
  praiseAfter?: number // clean reps in a row before praise
  praiseText?: string
  lang?: 'en' | 'hi'
}

const NUMBER_WORDS_HI = ['', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ', 'दस']

/**
 * Turns analyzer events into at most one user-facing cue per call, with debouncing
 * so the coach doesn't nag. Corrections beat counts; praise only when quiet.
 */
export class FeedbackArbiter {
  private lastSpokenAt = -Infinity
  private lastCorrection: string | null = null
  private lastCorrectionAt = -Infinity
  private opts: Required<ArbiterOptions>

  constructor(opts: ArbiterOptions = {}) {
    this.opts = {
      minGapMs: opts.minGapMs ?? 2500,
      countEvery: opts.countEvery ?? 5,
      praiseAfter: opts.praiseAfter ?? 3,
      praiseText: opts.praiseText ?? 'Good form',
      lang: opts.lang ?? 'en',
    }
  }

  decide(events: AnalyzerEvent[], tMs: number, cleanStreak: number): Cue | null {
    let correction: Violation | null = null
    let repCount: number | null = null
    let partial = false
    let gated: 'on' | 'off' | null = null
    let holdOut: Violation | null = null

    for (const e of events) {
      if (e.type === 'rep') {
        repCount = e.count
        if (e.violations.length) correction = e.violations[0]
      } else if (e.type === 'partial') {
        partial = true
        if (e.violations.length) correction = e.violations[0]
      } else if (e.type === 'gated') gated = 'on'
      else if (e.type === 'ungated') gated = 'off'
      else if (e.type === 'hold_tick' && !e.inTolerance && e.violations.length) holdOut = e.violations[0]
    }

    if (gated === 'on') return { text: this.t('Step back into view', 'कैमरे के सामने आएँ'), tone: 'info', speak: this.canSpeak(tMs) && this.mark(tMs) }

    if (correction) {
      const speak = this.canSpeak(tMs) || (correction.severity === 3 && tMs - this.lastSpokenAt > 1200)
      if (speak) this.mark(tMs)
      this.lastCorrection = correction.ruleId
      this.lastCorrectionAt = tMs
      return { text: correction.cue, tone: 'correction', speak }
    }

    if (holdOut) {
      // Only repeat a hold correction every ~3s
      if (this.lastCorrection === holdOut.ruleId && tMs - this.lastCorrectionAt < 3000) {
        return { text: holdOut.cue, tone: 'correction', speak: false }
      }
      this.lastCorrection = holdOut.ruleId
      this.lastCorrectionAt = tMs
      const speak = this.canSpeak(tMs) && this.mark(tMs)
      return { text: holdOut.cue, tone: 'correction', speak }
    }

    if (partial) return { text: this.t('Not counted', 'गिना नहीं'), tone: 'info', speak: false }

    if (repCount !== null) {
      if (cleanStreak > 0 && cleanStreak % this.opts.praiseAfter === 0 && this.canSpeak(tMs)) {
        this.mark(tMs)
        return { text: this.opts.praiseText, tone: 'praise', speak: true }
      }
      const speakCount = repCount % this.opts.countEvery === 0 && tMs - this.lastSpokenAt > 800
      if (speakCount) this.lastSpokenAt = tMs
      return { text: this.numberWord(repCount), tone: 'count', speak: speakCount }
    }
    return null
  }

  private numberWord(n: number): string {
    if (this.opts.lang === 'hi' && n <= 10) return NUMBER_WORDS_HI[n]
    return String(n)
  }

  private t(en: string, hi: string): string {
    return this.opts.lang === 'hi' ? hi : en
  }

  private canSpeak(tMs: number): boolean {
    return tMs - this.lastSpokenAt >= this.opts.minGapMs
  }

  private mark(tMs: number): true {
    this.lastSpokenAt = tMs
    return true
  }
}
