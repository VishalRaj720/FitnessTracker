const raw = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

export const env = {
  apiBase: raw.replace(/\/$/, '') + '/api/v1',
  wasmPath: '/wasm',
  modelLite: '/models/pose_landmarker_lite.task',
  modelFull: '/models/pose_landmarker_full.task',
  isDev: import.meta.env.DEV,
} as const
