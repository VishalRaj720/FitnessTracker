import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { Pose } from '@/cv/pose/landmarks'
import { POSE_LANDMARK_COUNT } from '@/cv/pose/landmarks'

export interface PoseDetectorOptions {
  wasmPath: string
  modelPath: string
  delegate?: 'GPU' | 'CPU'
  numPoses?: number
}

/** Thin wrapper over MediaPipe PoseLandmarker in VIDEO mode. All inference stays on-device. */
export class PoseDetector {
  private landmarker: PoseLandmarker
  private lastTs = -1
  private busy = false
  public inferenceMs = 0

  private constructor(landmarker: PoseLandmarker) {
    this.landmarker = landmarker
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
    try {
      lm = await make(opts.delegate ?? 'GPU')
    } catch (e) {
      console.warn('[PoseDetector] GPU delegate failed, falling back to CPU', e)
      lm = await make('CPU')
    }
    return new PoseDetector(lm)
  }

  /**
   * Run inference on the current video frame. Returns null when no person is detected
   * or when a previous inference is still running (frames are dropped, never queued).
   */
  detect(video: HTMLVideoElement, timestampMs: number): Pose | null | undefined {
    if (this.busy) return undefined
    // MediaPipe requires strictly increasing timestamps.
    const ts = timestampMs <= this.lastTs ? this.lastTs + 1 : timestampMs
    this.lastTs = ts
    this.busy = true
    const t0 = performance.now()
    try {
      const result = this.landmarker.detectForVideo(video, ts)
      this.inferenceMs = performance.now() - t0
      const first = result.landmarks?.[0]
      if (!first || first.length < POSE_LANDMARK_COUNT) return null
      return toPose(first)
    } finally {
      this.busy = false
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

export const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS
