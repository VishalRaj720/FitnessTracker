/** Message contract between the main thread and the pose worker. Types only — no runtime cost. */

export type Delegate = 'GPU' | 'CPU'

export type ToWorker =
  | { type: 'init'; modelPath: string; delegate: Delegate }
  | { type: 'frame'; bitmap: ImageBitmap; ts: number }
  | { type: 'setModel'; modelPath: string }
  | { type: 'close' }

export type FromWorker =
  | { type: 'ready'; delegate: Delegate }
  | { type: 'initError'; message: string }
  /** `landmarks` / `world` are null when no person was detected. Buffers are transferred. */
  | { type: 'pose'; ts: number; inferenceMs: number; landmarks: Float32Array | null; world: Float32Array | null }
  | { type: 'modelChanged'; modelPath: string }
  | { type: 'error'; message: string }
