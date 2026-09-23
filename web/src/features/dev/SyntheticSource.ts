import type { FrameSource } from '@/cv/sources/FrameSource'

/**
 * A camera-shaped frame source backed by a canvas, for environments with no camera
 * (the in-app browser pane, CI, a laptop with the lid shut). Produces a real MediaStream
 * via captureStream, so it exercises exactly the same path as CameraSource: video element,
 * createImageBitmap, transfer to the worker, inference.
 *
 * The figure it draws is crude and the model will usually find no pose in it. That is fine
 * — this verifies the plumbing and measures inference cost, not detection quality.
 */
export class SyntheticSource implements FrameSource {
  readonly kind = 'camera' as const

  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private stream: MediaStream | null = null
  private raf = 0
  private t0 = 0

  constructor(
    public readonly video: HTMLVideoElement,
    width = 640,
    height = 480,
  ) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = width
    this.canvas.height = height
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable')
    this.ctx = ctx
  }

  async start(): Promise<void> {
    this.t0 = performance.now()
    this.drawLoop()
    this.stream = this.canvas.captureStream(30)
    this.video.srcObject = this.stream
    this.video.muted = true
    this.video.playsInline = true
    await this.video.play()
  }

  stop(): void {
    cancelAnimationFrame(this.raf)
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.video.srcObject = null
  }

  now(): number {
    return performance.now()
  }

  /** A figure doing slow squats, so the frame content actually changes between samples. */
  private drawLoop = (): void => {
    const { ctx, canvas } = this
    const w = canvas.width
    const h = canvas.height
    const phase = ((performance.now() - this.t0) / 2000) % 1
    const dip = Math.sin(phase * Math.PI * 2) * 0.5 + 0.5 // 0..1
    const hipY = h * (0.5 + dip * 0.12)
    const kneeY = h * 0.72
    const cx = w / 2

    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 14
    ctx.lineCap = 'round'

    ctx.beginPath()
    ctx.arc(cx, h * 0.2 + dip * 40, 30, 0, Math.PI * 2)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(cx, h * 0.26 + dip * 40)
    ctx.lineTo(cx, hipY)
    ctx.moveTo(cx - 60, h * 0.34 + dip * 40)
    ctx.lineTo(cx + 60, h * 0.34 + dip * 40)
    ctx.moveTo(cx - 40, hipY)
    ctx.lineTo(cx - 50, kneeY)
    ctx.lineTo(cx - 45, h * 0.92)
    ctx.moveTo(cx + 40, hipY)
    ctx.lineTo(cx + 50, kneeY)
    ctx.lineTo(cx + 45, h * 0.92)
    ctx.stroke()

    this.raf = requestAnimationFrame(this.drawLoop)
  }
}
