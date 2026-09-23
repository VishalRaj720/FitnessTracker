import { PoseDetector, type PoseDetectorOptions } from '@/cv/pose/PoseDetector'
import type { PoseEngine, PoseResult } from '@/cv/pose/PoseEngine'
import type { Delegate } from '@/cv/pose/workerProtocol'

/**
 * Fallback for browsers where the worker (or WebGL2 inside it) is unavailable.
 * Identical semantics to PoseWorkerClient, but inference blocks the main thread, so the
 * overlay's render loop will stutter to roughly the inference rate. The governor reacts
 * to the measured inference time either way, so a slow device still lands on a low tier.
 */
export class MainThreadPoseEngine implements PoseEngine {
  readonly kind = 'main' as const
  readonly delegate: Delegate
  onPose: ((r: PoseResult) => void) | null = null

  private detector: PoseDetector
  private disposed = false

  private constructor(detector: PoseDetector, delegate: Delegate) {
    this.detector = detector
    this.delegate = delegate
  }

  static async create(opts: PoseDetectorOptions): Promise<MainThreadPoseEngine> {
    const detector = await PoseDetector.create(opts)
    return new MainThreadPoseEngine(detector, detector.delegate)
  }

  /** Always false: detection is synchronous here, so a frame is never left in flight. */
  get busy(): boolean {
    return false
  }

  setInputWidth(): void {
    /* no downscale lever on this path — the detector reads the video element directly */
  }

  submit(video: HTMLVideoElement, ts: number): void {
    if (this.disposed || !video.videoWidth) return
    const r = this.detector.detectFull(video, ts)
    this.onPose?.({ pose: r.pose, world: r.world, ts, inferenceMs: this.detector.inferenceMs })
  }

  setModel(): void {
    /* model swaps are not supported on the fallback path; the tier keeps its initial model */
  }

  dispose(): void {
    this.disposed = true
    this.onPose = null
    this.detector.dispose()
  }
}
