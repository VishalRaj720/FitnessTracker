import { BODY_EDGES, LM, toIsotropic, type Pose } from '@/cv/pose/landmarks'
import { coverMap } from '@/cv/render/coverMap'
import { alignToUser, projectToPose, type DemoView } from '@/cv/demo/project'

export interface GhostRendererOptions {
  videoSize: () => { width: number; height: number }
  /** World landmarks for the demo at a given time. */
  sampler: (tMs: number) => Float32Array
  view: DemoView
  /** The user's latest pose, used to match the ghost's size and position to their body. */
  userPose: () => Pose | null
  maxDpr?: number
}

const GHOST_COLOR = 'rgba(94, 234, 212, 0.45)'
const GHOST_GLOW = 'rgba(94, 234, 212, 0.14)'

/**
 * Draws the demo figure translucently over the live camera, scaled to the user's own body.
 *
 * The alignment is the whole point: a ghost at a fixed size only lines up at one camera
 * distance. Matching torso length and hip centre to the tracked pose means the user can
 * stand wherever they like and still physically trace the target shape.
 */
export class GhostRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private opts: GhostRendererOptions
  private raf = 0
  private running = false
  private t0 = 0
  private frozenAt: number | null = null
  private cssW = 0
  private cssH = 0
  private resizeObserver: ResizeObserver | null = null

  constructor(canvas: HTMLCanvasElement, opts: GhostRendererOptions) {
    this.canvas = canvas
    this.opts = opts
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('2D canvas context unavailable')
    this.ctx = ctx
    this.observeSize()
  }

  /** Freeze the ghost at a fixed point in the clip (the start pose, or the deepest point). */
  freezeAt(u: number | null): void {
    this.frozenAt = u
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.t0 = performance.now()
    const tick = () => {
      if (!this.running) return
      this.draw(performance.now() - this.t0)
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

  private draw(tMs: number): void {
    if (!this.cssW || !this.cssH) return
    const dpr = Math.min(this.opts.maxDpr ?? 2, globalThis.devicePixelRatio || 1)
    const w = Math.round(this.cssW * dpr)
    const h = Math.round(this.cssH * dpr)
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    const ctx = this.ctx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, this.cssW, this.cssH)

    const { width: vw, height: vh } = this.opts.videoSize()
    if (!vw || !vh) return

    const world = this.opts.sampler(this.frozenAt === null ? tMs : this.frozenAt)
    const raw = projectToPose(world, this.opts.view)

    // The ghost is laid out in frame-height units, where the metre-space demo keeps its
    // proportions; the user's width-normalized pose is brought into the same units first.
    const aspect = vw / vh
    const user = this.opts.userPose()
    let pose: Pose
    if (user) {
      pose = alignToUser(raw, toIsotropic(user, aspect))
    } else {
      // No tracked body yet: park the ghost centre-frame at a sensible size so the user
      // has something to walk into.
      pose = fitToFrame(raw, aspect)
    }

    const { scale, dx, dy } = coverMap(this.cssW, this.cssH, vw, vh)
    const px = (i: number) => dx + pose[i].x * vh * scale
    const py = (i: number) => dy + pose[i].y * vh * scale

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // A soft wide pass under a crisp one reads as a glow without needing shadowBlur,
    // which is expensive enough to show up in the frame budget on low-end phones.
    for (const [color, width] of [
      [GHOST_GLOW, 18],
      [GHOST_COLOR, 7],
    ] as const) {
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.beginPath()
      for (let e = 0; e < BODY_EDGES.length; e += 2) {
        const a = BODY_EDGES[e]
        const b = BODY_EDGES[e + 1]
        ctx.moveTo(px(a), py(a))
        ctx.lineTo(px(b), py(b))
      }
      ctx.stroke()
    }

    const span = Math.hypot(px(LM.L_SHOULDER) - px(LM.R_SHOULDER), py(LM.L_SHOULDER) - py(LM.R_SHOULDER))
    const torso = Math.hypot(px(LM.L_SHOULDER) - px(LM.L_HIP), py(LM.L_SHOULDER) - py(LM.L_HIP))
    const r = Math.max(10, Math.max(span, torso * 0.5) * 0.42)
    ctx.strokeStyle = GHOST_COLOR
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.arc(px(LM.NOSE), py(LM.NOSE), r, 0, Math.PI * 2)
    ctx.stroke()
  }
}

/** Place a metre-space pose in the frame (height units, so x spans 0..aspect), centred. */
function fitToFrame(pose: Pose, aspect: number): Pose {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of pose) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const h = Math.max(1e-6, maxY - minY)
  const k = 0.78 / h
  const cx = (minX + maxX) / 2
  return pose.map((p) => ({
    x: 0.5 * aspect + (p.x - cx) * k,
    y: 0.5 + (p.y - (minY + maxY) / 2) * k,
    z: p.z * k,
    visibility: p.visibility,
  }))
}
