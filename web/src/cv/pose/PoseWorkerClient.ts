import { poseFromFloats } from '@/cv/pose/landmarks'
import type { PoseEngine, PoseResult } from '@/cv/pose/PoseEngine'
import type { Delegate, FromWorker, ToWorker } from '@/cv/pose/workerProtocol'

export interface PoseWorkerOptions {
  modelPath: string
  delegate?: Delegate
  /** Reject if the worker has not reported `ready` within this window. */
  initTimeoutMs?: number
}

/**
 * Main-thread facade over the pose worker.
 *
 * The only work left on the main thread is `createImageBitmap`, which is ~1-2 ms and
 * hands the pixels to the worker by transfer (no copy). Everything else — WASM, the
 * GPU delegate, inference — happens off-thread, which is what lets the overlay run its
 * own 60 Hz loop while inference plods along at 15-30 Hz.
 */
export class PoseWorkerClient implements PoseEngine {
  readonly kind = 'worker' as const
  delegate: Delegate = 'GPU'
  onPose: ((r: PoseResult) => void) | null = null

  private worker: Worker
  private inFlight = false
  private capturing = false
  private inputWidth = 0
  private disposed = false

  private constructor(worker: Worker, delegate: Delegate) {
    this.worker = worker
    this.delegate = delegate
    this.worker.onmessage = (ev: MessageEvent<FromWorker>) => this.handle(ev.data)
  }

  get busy(): boolean {
    return this.inFlight || this.capturing
  }

  static async create(opts: PoseWorkerOptions): Promise<PoseWorkerClient> {
    // A module worker. The WASM glue is imported via ?url inside poseWorker.ts rather than
    // resolved from /public, because MediaPipe loads it with dynamic import() when there is
    // no DOM, and Vite refuses to serve public assets through the module pipeline. A classic
    // worker would avoid that too, but Vite only bundles those at build time, not in dev.
    const worker = new Worker(new URL('./poseWorker.ts', import.meta.url), { type: 'module' })
    const delegate = await new Promise<Delegate>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup()
        worker.terminate()
        reject(new Error('pose worker init timed out'))
      }, opts.initTimeoutMs ?? 15000)
      const onMessage = (ev: MessageEvent<FromWorker>) => {
        if (ev.data.type === 'ready') {
          cleanup()
          resolve(ev.data.delegate)
        } else if (ev.data.type === 'initError') {
          cleanup()
          worker.terminate()
          reject(new Error(ev.data.message))
        }
      }
      const onError = (e: ErrorEvent) => {
        cleanup()
        worker.terminate()
        reject(new Error(e.message || 'pose worker failed to load'))
      }
      const cleanup = () => {
        clearTimeout(timer)
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)
      }
      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onError)
      const init: ToWorker = { type: 'init', modelPath: opts.modelPath, delegate: opts.delegate ?? 'GPU' }
      worker.postMessage(init)
    })
    return new PoseWorkerClient(worker, delegate)
  }

  private handle(msg: FromWorker): void {
    if (msg.type === 'pose') {
      this.inFlight = false
      if (this.disposed) return
      this.onPose?.({
        pose: msg.landmarks ? poseFromFloats(msg.landmarks) : null,
        world: msg.world,
        ts: msg.ts,
        inferenceMs: msg.inferenceMs,
      })
    } else if (msg.type === 'error') {
      this.inFlight = false
      console.warn('[poseWorker]', msg.message)
    }
  }

  setInputWidth(width: number): void {
    this.inputWidth = width
  }

  submit(video: HTMLVideoElement, ts: number): void {
    if (this.busy || this.disposed) return
    if (!video.videoWidth) return
    this.capturing = true
    const opts: ImageBitmapOptions | undefined =
      this.inputWidth > 0 && video.videoWidth > this.inputWidth
        ? {
            resizeWidth: this.inputWidth,
            resizeHeight: Math.round((video.videoHeight / video.videoWidth) * this.inputWidth),
            resizeQuality: 'low',
          }
        : undefined
    createImageBitmap(video, opts)
      .then((bitmap) => {
        this.capturing = false
        if (this.disposed) {
          bitmap.close()
          return
        }
        this.inFlight = true
        const msg: ToWorker = { type: 'frame', bitmap, ts }
        this.worker.postMessage(msg, [bitmap])
      })
      .catch(() => {
        this.capturing = false
      })
  }

  setModel(modelPath: string): void {
    if (this.disposed) return
    const msg: ToWorker = { type: 'setModel', modelPath }
    this.worker.postMessage(msg)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.onPose = null
    try {
      const msg: ToWorker = { type: 'close' }
      this.worker.postMessage(msg)
    } catch {
      /* ignore */
    }
    setTimeout(() => this.worker.terminate(), 100)
  }
}
