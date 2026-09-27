import { BODY_EDGES, LM, POSE_LANDMARK_COUNT } from '@/cv/pose/landmarks'

export interface StickFigure3DOptions {
  /** Returns world landmarks (33 x xyz, metres, y-down) for a given time. */
  sampler: (tMs: number) => Float32Array
  /** Starting camera angles in degrees. */
  yaw?: number
  pitch?: number
  /** Slowly orbit when the user is not dragging. */
  autoOrbit?: boolean
  maxDpr?: number
  /** Share of the tighter canvas axis the skeleton fills (the head circle sits outside it). */
  margin?: number
  /** Multiplier on bone and head stroke widths; below 1 draws a finer wireframe. */
  boneScale?: number
}

const FOCAL = 2.2
const CAMERA_DIST = 4.2
const BONE_NEAR = '#5eead4'
const BONE_FAR = '#0f766e'

/**
 * Draws the demo figure as a rotatable 3D stick figure on a plain 2D canvas.
 *
 * No three.js: this is a perspective projection plus a depth sort, which is all a
 * 33-point skeleton needs. That keeps the tutorial free of a WebGL dependency and leaves
 * the GPU budget to the pose model, which is the thing that actually needs it.
 */
export class StickFigure3D {
  yaw: number
  pitch: number
  autoOrbit: boolean

  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private sampler: StickFigure3DOptions['sampler']
  private maxDpr: number
  private margin: number
  private boneScale: number
  private raf = 0
  private running = false
  private t0 = 0
  private dragging = false
  private lastPointer = { x: 0, y: 0 }
  private cssW = 0
  private cssH = 0
  private resizeObserver: ResizeObserver | null = null
  private detach: (() => void) | null = null

  // Reused per frame so the loop allocates nothing.
  private cam = new Float32Array(POSE_LANDMARK_COUNT * 3)
  private sx = new Float32Array(POSE_LANDMARK_COUNT)
  private sy = new Float32Array(POSE_LANDMARK_COUNT)
  private order: number[] = []

  constructor(canvas: HTMLCanvasElement, opts: StickFigure3DOptions) {
    this.canvas = canvas
    this.sampler = opts.sampler
    this.yaw = opts.yaw ?? 0
    this.pitch = opts.pitch ?? 0
    this.autoOrbit = opts.autoOrbit ?? true
    this.maxDpr = opts.maxDpr ?? 2
    this.margin = opts.margin ?? 0.8
    this.boneScale = opts.boneScale ?? 1
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('2D canvas context unavailable')
    this.ctx = ctx
    for (let e = 0; e < BODY_EDGES.length; e += 2) this.order.push(e)
    this.observeSize()
    this.attachPointer()
  }

  setSampler(sampler: StickFigure3DOptions['sampler']): void {
    this.sampler = sampler
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
    this.detach?.()
    this.detach = null
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

  private attachPointer(): void {
    const el = this.canvas
    const down = (e: PointerEvent) => {
      this.dragging = true
      this.lastPointer = { x: e.clientX, y: e.clientY }
      el.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!this.dragging) return
      this.yaw += (e.clientX - this.lastPointer.x) * 0.5
      this.pitch = clamp(this.pitch + (e.clientY - this.lastPointer.y) * 0.3, -60, 60)
      this.lastPointer = { x: e.clientX, y: e.clientY }
    }
    const up = (e: PointerEvent) => {
      this.dragging = false
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* pointer already released */
      }
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.style.touchAction = 'none'
    this.detach = () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }

  private draw(tMs: number): void {
    if (!this.cssW || !this.cssH) return
    const dpr = Math.min(this.maxDpr, globalThis.devicePixelRatio || 1)
    const w = Math.round(this.cssW * dpr)
    const h = Math.round(this.cssH * dpr)
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    const ctx = this.ctx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, this.cssW, this.cssH)

    if (this.autoOrbit && !this.dragging) this.yaw += 0.18

    const world = this.sampler(tMs)
    if (!world || world.length < POSE_LANDMARK_COUNT * 3) return

    // Centre on the figure's centroid in every axis. Using the vertical extent alone to
    // scale would blow up a prone figure (push-up, plank), whose height is almost nothing.
    let cx = 0
    let cy = 0
    let cz = 0
    for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
      cx += world[i * 3]
      cy += world[i * 3 + 1]
      cz += world[i * 3 + 2]
    }
    cx /= POSE_LANDMARK_COUNT
    cy /= POSE_LANDMARK_COUNT
    cz /= POSE_LANDMARK_COUNT

    const cosY = Math.cos((this.yaw * Math.PI) / 180)
    const sinY = Math.sin((this.yaw * Math.PI) / 180)
    const cosP = Math.cos((this.pitch * Math.PI) / 180)
    const sinP = Math.sin((this.pitch * Math.PI) / 180)

    // Pass 1: project at unit scale and measure the screen-space bounding box.
    let minU = Infinity
    let maxU = -Infinity
    let minV = Infinity
    let maxV = -Infinity
    for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
      const o = i * 3
      const x0 = world[o] - cx
      const y0 = world[o + 1] - cy
      const z0 = world[o + 2] - cz
      // yaw about the vertical axis, then pitch about the lateral axis
      const x1 = x0 * cosY + z0 * sinY
      const z1 = -x0 * sinY + z0 * cosY
      const y2 = y0 * cosP - z1 * sinP
      const z2 = y0 * sinP + z1 * cosP
      this.cam[o] = x1
      this.cam[o + 1] = y2
      this.cam[o + 2] = z2
      const persp = (FOCAL * CAMERA_DIST) / Math.max(0.5, CAMERA_DIST - z2)
      const u = x1 * persp
      const v = y2 * persp
      this.sx[i] = u
      this.sy[i] = v
      if (u < minU) minU = u
      if (u > maxU) maxU = u
      if (v < minV) minV = v
      if (v > maxV) maxV = v
    }

    // Pass 2: scale to fit whichever axis is tighter, then centre the box in the canvas.
    const boxW = Math.max(0.2, maxU - minU)
    const boxH = Math.max(0.2, maxV - minV)
    const margin = this.margin
    const fit = Math.min((this.cssW * margin) / boxW, (this.cssH * margin) / boxH)
    const ox = this.cssW / 2 - ((minU + maxU) / 2) * fit
    const oy = this.cssH / 2 - ((minV + maxV) / 2) * fit
    for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
      this.sx[i] = ox + this.sx[i] * fit
      this.sy[i] = oy + this.sy[i] * fit
    }

    // Painter's algorithm: furthest bones first, so near limbs overlap far ones.
    this.order.sort((a, b) => edgeDepth(this.cam, a) - edgeDepth(this.cam, b))

    ctx.lineCap = 'round'
    for (const e of this.order) {
      const a = BODY_EDGES[e]
      const b = BODY_EDGES[e + 1]
      const depth = (this.cam[a * 3 + 2] + this.cam[b * 3 + 2]) / 2
      const k = clamp((depth + 0.9) / 1.8, 0, 1)
      ctx.strokeStyle = mixColor(BONE_FAR, BONE_NEAR, k)
      ctx.lineWidth = (7 + k * 5) * this.boneScale
      ctx.beginPath()
      ctx.moveTo(this.sx[a], this.sy[a])
      ctx.lineTo(this.sx[b], this.sy[b])
      ctx.stroke()
    }

    // Head sized from the torso, not the shoulder span: the span collapses to nothing in a
    // side view and stretches in a front view, which made the head pulse as the figure spun.
    const neckX = (this.sx[LM.L_SHOULDER] + this.sx[LM.R_SHOULDER]) / 2
    const neckY = (this.sy[LM.L_SHOULDER] + this.sy[LM.R_SHOULDER]) / 2
    const hipX = (this.sx[LM.L_HIP] + this.sx[LM.R_HIP]) / 2
    const hipY = (this.sy[LM.L_HIP] + this.sy[LM.R_HIP]) / 2
    const torsoPx = Math.hypot(neckX - hipX, neckY - hipY)
    const r = Math.max(8, torsoPx * 0.22)
    const hx = this.sx[LM.NOSE]
    const hy = this.sy[LM.NOSE]
    ctx.strokeStyle = BONE_NEAR
    ctx.lineWidth = 7 * this.boneScale
    ctx.beginPath()
    ctx.moveTo(neckX, neckY)
    ctx.lineTo(hx, hy)
    ctx.stroke()
    ctx.fillStyle = '#134e4a'
    ctx.beginPath()
    ctx.arc(hx, hy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // A floor line under the lowest contact point, so the rotation reads as rotation rather
    // than as the figure deforming.
    let floor = -Infinity
    for (let i = 0; i < POSE_LANDMARK_COUNT; i++) if (this.sy[i] > floor) floor = this.sy[i]
    ctx.strokeStyle = 'rgba(148,163,184,0.22)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(this.cssW * 0.08, floor + 6)
    ctx.lineTo(this.cssW * 0.92, floor + 6)
    ctx.stroke()
  }
}

function edgeDepth(cam: Float32Array, e: number): number {
  const a = BODY_EDGES[e]
  const b = BODY_EDGES[e + 1]
  return (cam[a * 3 + 2] + cam[b * 3 + 2]) / 2
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function mixColor(from: string, to: string, k: number): string {
  const f = hexToRgb(from)
  const t = hexToRgb(to)
  const r = Math.round(f[0] + (t[0] - f[0]) * k)
  const g = Math.round(f[1] + (t[1] - f[1]) * k)
  const b = Math.round(f[2] + (t[2] - f[2]) * k)
  return `rgb(${r},${g},${b})`
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
