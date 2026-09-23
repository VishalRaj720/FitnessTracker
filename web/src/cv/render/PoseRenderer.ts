import { BODY_EDGES, BODY_JOINTS, LM, makePoseBuffer, type Pose } from '@/cv/pose/landmarks'
import { lerpPose } from '@/cv/render/interpolate'
import { coverMap } from '@/cv/render/coverMap'

export type OverlayDetail = 'full' | 'skeleton'

export interface PoseRendererOptions {
  /** Intrinsic size of the source frames, used to map normalized landmarks under object-cover. */
  videoSize: () => { width: number; height: number }
  detail?: OverlayDetail
  maxDpr?: number
}

const MIN_VISIBILITY = 0.3
const COLOR_OK = '#34d399'
const COLOR_GATED = '#f59e0b'

/**
 * Draws the skeleton on its OWN requestAnimationFrame loop, independent of inference.
 *
 * This is the fix for the jitter: poses arrive at 15-30 Hz, but the overlay redraws at the
 * display refresh rate, interpolating between the last two poses at a render time held one
 * inference interval in the past. That ~33 ms of deliberate lag is imperceptible and is what
 * buys smooth motion — without it the overlay can only ever be as smooth as the model is fast.
 *
 * The loop allocates nothing: landmarks are lerped into a preallocated buffer and the edge
 * list is a flat typed array.
 */
export class PoseRenderer {
  renderFps = 0

  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private opts: PoseRendererOptions
  private raf = 0
  private running = false

  // Two-slot pose history, plus the buffer we interpolate into.
  private prev: Pose | null = null
  private prevTs = 0
  private next: Pose | null = null
  private nextTs = 0
  private buf: Pose = makePoseBuffer()

  private meanIntervalMs = 33
  private lagMs = 36
  private gated = false
  private detail: OverlayDetail
  private maxDpr: number
  private frames = 0
  private fpsWindowStart = 0
  private cssW = 0
  private cssH = 0
  private resizeObserver: ResizeObserver | null = null

  constructor(canvas: HTMLCanvasElement, opts: PoseRendererOptions) {
    this.canvas = canvas
    this.opts = opts
    this.detail = opts.detail ?? 'full'
    this.maxDpr = opts.maxDpr ?? 2
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })
    if (!ctx) throw new Error('2D canvas context unavailable')
    this.ctx = ctx
    this.observeSize()
  }

  /** Feed a new inference result. `null` means no person was detected in that frame. */
  push(pose: Pose | null, ts: number): void {
    if (this.nextTs) {
      const dt = ts - this.nextTs
      if (dt > 0 && dt < 500) this.meanIntervalMs = this.meanIntervalMs * 0.8 + dt * 0.2
    }
    this.prev = this.next
    this.prevTs = this.nextTs
    this.next = pose
    this.nextTs = ts
    // Hold the render clock one inference interval behind so there is always a
    // future sample to interpolate toward, rather than extrapolating past it.
    this.lagMs = Math.min(150, Math.max(16, this.meanIntervalMs * 1.1))
  }

  setGated(gated: boolean): void {
    this.gated = gated
  }

  setDetail(detail: OverlayDetail): void {
    this.detail = detail
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.fpsWindowStart = performance.now()
    const tick = () => {
      if (!this.running) return
      this.draw(performance.now())
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  dispose(): void {
    this.stop()
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
  }

  private observeSize(): void {
    const measure = () => {
      const r = this.canvas.getBoundingClientRect()
      this.cssW = r.width
      this.cssH = r.height
    }
    measure()
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(measure)
      this.resizeObserver.observe(this.canvas)
    }
  }

  private syncCanvasSize(): boolean {
    if (!this.cssW || !this.cssH) return false
    const dpr = Math.min(this.maxDpr, globalThis.devicePixelRatio || 1)
    const w = Math.round(this.cssW * dpr)
    const h = Math.round(this.cssH * dpr)
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    return true
  }

  private draw(now: number): void {
    this.frames += 1
    if (now - this.fpsWindowStart >= 1000) {
      this.renderFps = Math.round((this.frames * 1000) / (now - this.fpsWindowStart))
      this.frames = 0
      this.fpsWindowStart = now
    }

    if (!this.syncCanvasSize()) return
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.cssW, this.cssH)
    if (!this.next) return

    const pose = lerpPose(this.prev, this.next, this.prevTs, this.nextTs, now - this.lagMs, this.buf)
    const { width: vw, height: vh } = this.opts.videoSize()
    if (!vw || !vh) return

    const { scale, dx, dy } = coverMap(this.cssW, this.cssH, vw, vh)
    const px = (i: number) => dx + pose[i].x * vw * scale
    const py = (i: number) => dy + pose[i].y * vh * scale

    const color = this.gated ? COLOR_GATED : COLOR_OK
    const lineWidth = this.detail === 'skeleton' ? 6 : 4

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.beginPath()
    for (let e = 0; e < BODY_EDGES.length; e += 2) {
      const a = BODY_EDGES[e]
      const b = BODY_EDGES[e + 1]
      if (pose[a].visibility < MIN_VISIBILITY || pose[b].visibility < MIN_VISIBILITY) continue
      ctx.moveTo(px(a), py(a))
      ctx.lineTo(px(b), py(b))
    }
    ctx.stroke()

    // Head: a circle at the nose, sized from shoulder span so it scales with distance.
    const ls = pose[LM.L_SHOULDER]
    const rs = pose[LM.R_SHOULDER]
    const nose = pose[LM.NOSE]
    if (nose.visibility >= MIN_VISIBILITY && ls.visibility >= MIN_VISIBILITY && rs.visibility >= MIN_VISIBILITY) {
      const span = Math.hypot((ls.x - rs.x) * vw * scale, (ls.y - rs.y) * vh * scale)
      const r = Math.max(6, span * 0.38)
      ctx.beginPath()
      ctx.arc(px(LM.NOSE), py(LM.NOSE), r, 0, Math.PI * 2)
      ctx.stroke()
    }

    if (this.detail === 'full') {
      ctx.fillStyle = color
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      for (let j = 0; j < BODY_JOINTS.length; j++) {
        const i = BODY_JOINTS[j]
        if (pose[i].visibility < MIN_VISIBILITY) continue
        ctx.beginPath()
        ctx.arc(px(i), py(i), 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }
  }
}
