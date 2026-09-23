/// <reference lib="webworker" />
import { PoseLandmarker, type NormalizedLandmark, type Landmark as MpLandmark } from '@mediapipe/tasks-vision'
// The ES-module WASM build, resolved through Vite rather than from /public.
//
// FilesetResolver is deliberately not used here. It points at /public/wasm, and inside a
// module worker MediaPipe loads that glue with a dynamic import() — which Vite rewrites and
// then refuses, because public assets may not enter the module pipeline. Importing the
// package's own module build with ?url gives a URL Vite serves happily in dev and emits as
// a hashed asset in the build, and the fileset it needs is just these two paths.
import wasmLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_module_internal.js?url'
import wasmBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_module_internal.wasm?url'
import { LANDMARK_STRIDE, POSE_LANDMARK_COUNT } from '@/cv/pose/landmarks'
import type { Delegate, FromWorker, ToWorker } from '@/cv/pose/workerProtocol'

/**
 * Runs MediaPipe inference off the main thread, so a ~30 ms detect() never blocks React,
 * layout or the overlay's animation frame. Frames arrive as transferred ImageBitmaps and
 * are closed immediately after inference; one frame is processed at a time and the client
 * is responsible for not sending another until this one comes back (drop, never queue).
 *
 * Deliberately does NOT smooth: One-Euro lives inside ExerciseAnalyzer, after the
 * visibility gate, and moving it here would change analyzer output.
 */

let landmarker: PoseLandmarker | null = null
let lastTs = -1
/** The delegate that actually came up. A later model swap must not silently retry GPU. */
let activeDelegate: Delegate = 'GPU'

const fileset = { wasmLoaderPath: wasmLoaderUrl, wasmBinaryPath: wasmBinaryUrl }

const post = (msg: FromWorker, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(msg, transfer)

async function build(modelPath: string, delegate: Delegate): Promise<PoseLandmarker> {
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelPath, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  })
}

async function init(modelPath: string, delegate: Delegate): Promise<void> {
  try {
    landmarker = await build(modelPath, delegate)
    activeDelegate = delegate
    post({ type: 'ready', delegate })
  } catch (e) {
    // WebGL2 may be unavailable in this worker; CPU still beats blocking the main thread.
    try {
      landmarker = await build(modelPath, 'CPU')
      activeDelegate = 'CPU'
      post({ type: 'ready', delegate: 'CPU' })
    } catch (e2) {
      post({ type: 'initError', message: (e2 as Error).message || (e as Error).message })
    }
  }
}

function packNormalized(lms: NormalizedLandmark[]): Float32Array {
  const out = new Float32Array(POSE_LANDMARK_COUNT * LANDMARK_STRIDE)
  for (let i = 0; i < POSE_LANDMARK_COUNT; i++) {
    const l = lms[i]
    const o = i * LANDMARK_STRIDE
    out[o] = l.x
    out[o + 1] = l.y
    out[o + 2] = l.z ?? 0
    out[o + 3] = l.visibility ?? 0
  }
  return out
}

/** World landmarks are metric 3D (metres, hip-centred) — used by the demo stickman. */
function packWorld(lms: MpLandmark[]): Float32Array {
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

function detect(bitmap: ImageBitmap, ts: number): void {
  if (!landmarker) {
    bitmap.close()
    return
  }
  // MediaPipe requires strictly increasing timestamps.
  const t = ts <= lastTs ? lastTs + 1 : ts
  lastTs = t
  const t0 = performance.now()
  let landmarks: Float32Array | null = null
  let world: Float32Array | null = null
  try {
    const result = landmarker.detectForVideo(bitmap, t)
    const first = result.landmarks?.[0]
    if (first && first.length >= POSE_LANDMARK_COUNT) {
      landmarks = packNormalized(first)
      const w = result.worldLandmarks?.[0]
      if (w && w.length >= POSE_LANDMARK_COUNT) world = packWorld(w)
    }
  } catch (e) {
    post({ type: 'error', message: (e as Error).message })
  } finally {
    bitmap.close()
  }
  const inferenceMs = performance.now() - t0
  const transfer: Transferable[] = []
  if (landmarks) transfer.push(landmarks.buffer)
  if (world) transfer.push(world.buffer)
  post({ type: 'pose', ts, inferenceMs, landmarks, world }, transfer)
}

self.onmessage = (ev: MessageEvent<ToWorker>) => {
  const msg = ev.data
  switch (msg.type) {
    case 'init':
      void init(msg.modelPath, msg.delegate)
      break
    case 'frame':
      detect(msg.bitmap, msg.ts)
      break
    case 'setModel': {
      // Swap models without tearing down the WASM fileset.
      const prev = landmarker
      landmarker = null
      void build(msg.modelPath, activeDelegate)
        .then((lm) => {
          landmarker = lm
          prev?.close()
          lastTs = -1
          post({ type: 'modelChanged', modelPath: msg.modelPath })
        })
        .catch((e) => {
          landmarker = prev // keep running on the old model rather than dying
          post({ type: 'error', message: `model swap failed: ${(e as Error).message}` })
        })
      break
    }
    case 'close':
      landmarker?.close()
      landmarker = null
      self.close()
      break
  }
}
