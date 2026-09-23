import { FilesetResolver, PoseLandmarker, type Landmark as MpLandmark, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { Pose } from '@/cv/pose/landmarks'
import { POSE_LANDMARK_COUNT } from '@/cv/pose/landmarks'

export interface PoseDetectorOptions {
  wasmPath: string
  modelPath: string
  delegate?: 'GPU' | 'CPU'
  numPoses?: number
}

/**
 * Thin wrapper over MediaPipe PoseLandmarker in VIDEO mode. All inference stays on-device.
 *
 * Note that `detectForVideo` is synchronous and blocks the caller for the duration of
 * inference, so on the main thread it blocks rendering too. Prefer PoseWorkerClient;
 * this remains as the fallback for browsers where the worker cannot start.
 */
export class PoseDetector {
  private landmarker: PoseLandmarker
  private lastTs = -1
  public inferenceMs = 0
  public readonly delegate: 'GPU' | 'CPU'

  private constructor(landmarker: PoseLandmarker, delegate: 'GPU' | 'CPU') {
    this.landmarker = landmarker
    this.delegate = delegate
  }

  static async create(opts: PoseDetectorOptions): Promise<PoseDetector> {
    const vision = await FilesetResolver.forVisionTasks(opts.wasmPath)
    const make = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: opts.modelPath, delegate },
        runningMode: 'VIDEO',
        numPoses: opts.numPoses ?? 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      })
    let lm: PoseLandmarker
    let delegate = opts.delegate ?? 'GPU'
    try {
      lm = await make(delegate)
    } catch (e) {
      console.warn('[PoseDetector] GPU delegate failed, falling back to CPU', e)
      delegate = 'CPU'
      lm = await make('CPU')
    }
    return new PoseDetector(lm, delegate)
  }

  /** Run inference on the current video frame. Returns null when no person is detected. */
  detect(video: HTMLVideoElement, timestampMs: number): Pose | null {
    return this.detectFull(video, timestampMs).pose
  }

  /** As `detect`, but also returns the metric 3D landmarks used by the demo stickman. */
  detectFull(video: HTMLVideoElement, timestampMs: number): { pose: Pose | null; world: Float32Array | null } {
    // MediaPipe requires strictly increasing timestamps.
    const ts = timestampMs <= this.lastTs ? this.lastTs + 1 : timestampMs
    this.lastTs = ts
    const t0 = performance.now()
    const result = this.landmarker.detectForVideo(video, ts)
    this.inferenceMs = performance.now() - t0
    const first = result.landmarks?.[0]
    if (!first || first.length < POSE_LANDMARK_COUNT) return { pose: null, world: null }
    const w = result.worldLandmarks?.[0]
    return {
      pose: toPose(first),
      world: w && w.length >= POSE_LANDMARK_COUNT ? toWorld(w) : null,
    }
  }

  dispose(): void {
    try {
      this.landmarker.close()
    } catch {
      /* ignore */
    }
  }
}

function toPose(lms: NormalizedLandmark[]): Pose {
  const out: Pose = new Array(POSE_LANDMARK_COUNT)
  for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
    const l = lms[i]
    out[i] = { x: l.x, y: l.y, z: l.z ?? 0, visibility: l.visibility ?? 0 }
  }
  return out
}

function toWorld(lms: MpLandmark[]): Float32Array {
  const out = new Float32Array(POSE_LANDMARK_COUNT * 3)
  for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
    const l = lms[i]
    const o = i * 3
    out[o] = l.x
    out[o + 1] = l.y
    out[o + 2] = l.z ?? 0
  }
  return out
}

export const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS
