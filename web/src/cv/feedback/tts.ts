/** Web Speech API wrapper. Silent no-op when unsupported or disabled. */
export class Speaker {
  enabled = true
  private lang: string
  private voice: SpeechSynthesisVoice | null = null

  constructor(lang: 'en' | 'hi' = 'en') {
    this.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
    this.pickVoice()
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.addEventListener?.('voiceschanged', () => this.pickVoice())
    }
  }

  setLang(lang: 'en' | 'hi'): void {
    this.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
    this.pickVoice()
  }

  private pickVoice(): void {
    if (typeof speechSynthesis === 'undefined') return
    const voices = speechSynthesis.getVoices()
    const exact = voices.find((v) => v.lang.toLowerCase() === this.lang.toLowerCase())
    const base = voices.find((v) => v.lang.toLowerCase().startsWith(this.lang.slice(0, 2)))
    this.voice = exact ?? base ?? null
  }

  speak(text: string, opts: { interrupt?: boolean; rate?: number } = {}): void {
    if (!this.enabled || typeof speechSynthesis === 'undefined') return
    try {
      if (opts.interrupt !== false) speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = this.lang
      if (this.voice) u.voice = this.voice
      u.rate = opts.rate ?? 1.05
      u.pitch = 1
      u.volume = 1
      speechSynthesis.speak(u)
    } catch {
      /* ignore */
    }
  }

  stop(): void {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
  }
}
