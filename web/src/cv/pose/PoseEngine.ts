import type { Pose } from '@/cv/pose/landmarks'
import type { Delegate } from '@/cv/pose/workerProtocol'

export interface PoseResult {
  /** null when no person was detected in this frame. */
  pose: Pose | null
  /** Metric 3D landmarks (33 x xyz), null when no person. Used by the demo stickman. */
  world: Float32Array | null
  ts: number
  inferenceMs: number
}

/**
 * A source of poses. Two implementations: the worker (preferred) and a main-thread
 * fallback with identical semantics, so the runner does not care which one it got.
 */
export interface PoseEngine {
  readonly kind: 'worker' | 'main'
  readonly delegate: Delegate
  /** True while a frame is in flight; the caller must not submit another. */
  readonly busy: boolean
  onPose: ((r: PoseResult) => void) | null
  /** Submit the current video frame. Silently ignored while busy — drop, never queue. */
  submit(video: HTMLVideoElement, ts: number): void
  /** Downscale the inference input without touching the camera stream. 0 = native size. */
  setInputWidth(width: number): void
  setModel(modelPath: string): void
  dispose(): void
}
