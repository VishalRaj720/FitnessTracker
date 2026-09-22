import { useCallback, useEffect, useRef, useState } from 'react'
import { DrawingUtils } from '@mediapipe/tasks-vision'
import { PoseDetector, POSE_CONNECTIONS } from '@/cv/pose/PoseDetector'
import { CameraSource, VideoFileSource, type FrameSource } from '@/cv/sources/FrameSource'
import { ExerciseAnalyzer } from '@/cv/engine/ExerciseAnalyzer'
import { FeedbackArbiter } from '@/cv/engine/FeedbackArbiter'
import { getDefinition } from '@/cv/exercises'
import { checkFraming, type FramingCheck } from '@/cv/geometry/orientation'
import { Speaker } from '@/cv/feedback/tts'
import type { Pose } from '@/cv/pose/landmarks'
import { env } from '@/lib/env'
import { useSessionStore, type RunnerItem } from '@/features/workout/store/sessionStore'

export type RunnerStage = 'loading' | 'framing' | 'countdown' | 'tracking' | 'error'

export interface RunnerOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  item: RunnerItem | null
  enabled: boolean // false during rest / manual mode
  voice: boolean
  lang: 'en' | 'hi'
  mirror: boolean
  demoVideoUrl?: string | null
}

export interface RunnerApi {
  stage: RunnerStage
  framing: FramingCheck | null
  countdown: number
  error: string | null
  modelName: 'lite' | 'full'
  /** Collect the analyzer's results for the current set and reset for the next one. */
  harvest: () => { reps: number; secondsHeld: number; formScore: number; meanVisibility: number; formFlags: Record<string, number>; repEvents: number[][] }
  restartFraming: () => void
  switchCamera: () => Promise<void>
}

const FRAMING_STABLE_MS = 1500
const COUNTDOWN_S = 3

function pickModel(): 'lite' | 'full' {
  const cores = navigator.hardwareConcurrency ?? 4
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 4
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent)
  return !mobile && cores >= 8 && mem >= 8 ? 'full' : 'lite'
}

/**
 * Owns the camera, the pose detector and one ExerciseAnalyzer per set.
 * Writes high-frequency state into the Zustand session store; components subscribe to slices.
 */
export function useWorkoutRunner(opts: RunnerOptions): RunnerApi {
  const { videoRef, canvasRef, item, enabled, voice, lang, mirror, demoVideoUrl } = opts
  const [stage, setStage] = useState<RunnerStage>('loading')
  const [framing, setFraming] = useState<FramingCheck | null>(null)
  const [countdown, setCountdown] = useState(COUNTDOWN_S)
  const [error, setError] = useState<string | null>(null)
  const [modelName] = useState<'lite' | 'full'>(pickModel)

  const detectorRef = useRef<PoseDetector | null>(null)
  const sourceRef = useRef<FrameSource | null>(null)
  const analyzerRef = useRef<ExerciseAnalyzer | null>(null)
  const arbiterRef = useRef<FeedbackArbiter | null>(null)
  const speakerRef = useRef<Speaker | null>(null)
  const stageRef = useRef<RunnerStage>('loading')
  const framingGoodSince = useRef<number | null>(null)
  const countdownStart = useRef<number | null>(null)
  const rafRef = useRef<number>(0)
  const lastPoseRef = useRef<Pose | null>(null)
  const fpsRef = useRef({ frames: 0, t: performance.now() })
  const itemRef = useRef<RunnerItem | null>(item)
  const enabledRef = useRef(enabled)
  const startedAtRef = useRef<number>(0)
  const announcedRef = useRef(false)

  itemRef.current = item
  enabledRef.current = enabled

  const setStageBoth = useCallback((s: RunnerStage) => {
    stageRef.current = s
    setStage(s)
  }, [])

  // Speaker lifecycle
  useEffect(() => {
    speakerRef.current = new Speaker(lang)
    return () => speakerRef.current?.stop()
  }, [])
  useEffect(() => {
    if (speakerRef.current) {
      speakerRef.current.enabled = voice
      speakerRef.current.setLang(lang)
    }
  }, [voice, lang])

  // Build a fresh analyzer whenever the item changes or tracking (re)starts.
  const buildAnalyzer = useCallback(() => {
    const it = itemRef.current
    if (!it) return
    const def = getDefinition(it.exercise.slug)
    if (!def) return
    analyzerRef.current = new ExerciseAnalyzer(def, { lang })
    arbiterRef.current = new FeedbackArbiter({ lang, praiseText: def.praise ?? 'Good form' })
    startedAtRef.current = performance.now()
    announcedRef.current = false
  }, [lang])

  const restartFraming = useCallback(() => {
    framingGoodSince.current = null
    countdownStart.current = null
    setCountdown(COUNTDOWN_S)
    if (detectorRef.current) setStageBoth('framing')
  }, [setStageBoth])

  // When the item changes (next exercise), go back to framing for a new orientation check.
  useEffect(() => {
    if (!item) return
    analyzerRef.current = null
    if (detectorRef.current) restartFraming()
  }, [item?.key, restartFraming]) // eslint-disable-line react-hooks/exhaustive-deps

  // Camera + detector lifecycle
  useEffect(() => {
    let cancelled = false
    const video = videoRef.current
    if (!video) return

    const boot = async () => {
      try {
        setStageBoth('loading')
        const source: FrameSource = demoVideoUrl ? new VideoFileSource(video, demoVideoUrl) : new CameraSource(video, 'user')
        sourceRef.current = source
        await source.start()
        if (cancelled) return
        const detector = await PoseDetector.create({
          wasmPath: env.wasmPath,
          modelPath: modelName === 'full' ? env.modelFull : env.modelLite,
          delegate: 'GPU',
        })
        if (cancelled) {
          detector.dispose()
          return
        }
        detectorRef.current = detector
        restartFraming()
        loop()
      } catch (e) {
        if (cancelled) return
        const msg = (e as Error).name === 'NotAllowedError' ? 'Camera permission denied. You can still do this workout in manual mode.' : (e as Error).message || 'Could not start the camera'
        setError(msg)
        setStageBoth('error')
      }
    }

    const loop = () => {
      const v = videoRef.current
      const det = detectorRef.current
      if (!v || !det) return
      const tick = () => {
        if (cancelled) return
        step(v, det)
        schedule()
      }
      const schedule = () => {
        const vv = videoRef.current as (HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }) | null
        if (vv?.requestVideoFrameCallback) vv.requestVideoFrameCallback(tick)
        else rafRef.current = requestAnimationFrame(tick)
      }
      schedule()
    }

    const step = (v: HTMLVideoElement, det: PoseDetector) => {
      const now = performance.now()
      const raw = det.detect(v, now)
      if (raw === undefined) return // dropped frame, inference busy
      lastPoseRef.current = raw
      draw(raw)

      // fps
      const f = fpsRef.current
      f.frames += 1
      if (now - f.t >= 1000) {
        useSessionStore.getState().updateLive({ fps: f.frames, inferenceMs: Math.round(det.inferenceMs) })
        f.frames = 0
        f.t = now
      }

      const it = itemRef.current
      const st = stageRef.current
      if (!it || !enabledRef.current) return

      if (st === 'framing' || st === 'countdown') {
        const def = getDefinition(it.exercise.slug)
        const fc = checkFraming(raw, def?.requiredLandmarks ?? [], def?.orientation ?? 'any')
        setFraming(fc)
        const good = fc.visible && fc.inFrame && fc.facingOk
        if (st === 'framing') {
          if (good) {
            if (framingGoodSince.current === null) framingGoodSince.current = now
            else if (now - framingGoodSince.current >= FRAMING_STABLE_MS) {
              countdownStart.current = now
              setStageBoth('countdown')
              speakerRef.current?.speak(lang === 'hi' ? 'तैयार' : 'Get ready')
            }
          } else {
            framingGoodSince.current = null
          }
        } else if (st === 'countdown') {
          const elapsed = (now - (countdownStart.current ?? now)) / 1000
          const remaining = Math.max(0, COUNTDOWN_S - Math.floor(elapsed))
          setCountdown(remaining)
          if (!good) {
            // lost framing during countdown -> back to framing
            restartFraming()
            return
          }
          if (elapsed >= COUNTDOWN_S) {
            buildAnalyzer()
            setStageBoth('tracking')
            speakerRef.current?.speak(lang === 'hi' ? 'शुरू' : 'Go')
          }
        }
        return
      }

      if (st === 'tracking') {
        const an = analyzerRef.current
        const arb = arbiterRef.current
        if (!an || !arb) return
        an.setElapsed(now - startedAtRef.current)
        const events = an.update(raw, now)
        const snap = an.snapshot()
        const store = useSessionStore.getState()
        store.updateLive({
          reps: snap.reps,
          partials: snap.partials,
          heldMs: snap.heldMs,
          phase: snap.phase,
          inTolerance: snap.inTolerance,
          formScore: snap.formScore,
          visibility: snap.visibility,
          gated: snap.gated,
        })
        if (events.length) {
          const cue = arb.decide(events, now, snap.cleanStreak)
          if (cue) {
            store.setCue({ text: cue.text, tone: cue.tone, at: now })
            if (cue.speak) speakerRef.current?.speak(cue.text, { interrupt: cue.tone === 'correction' })
          }
        }
      }
    }

    const draw = (pose: Pose | null) => {
      const canvas = canvasRef.current
      const v = videoRef.current
      if (!canvas || !v) return
      if (canvas.width !== v.videoWidth || canvas.height !== v.videoHeight) {
        canvas.width = v.videoWidth
        canvas.height = v.videoHeight
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (!pose) return
      const du = new DrawingUtils(ctx)
      const gated = useSessionStore.getState().live.gated
      const color = gated ? '#f59e0b' : '#34d399'
      du.drawConnectors(pose, POSE_CONNECTIONS, { color, lineWidth: 3 })
      du.drawLandmarks(pose, { color: '#ffffff', fillColor: color, lineWidth: 1, radius: 3 })
    }

    boot()
    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      detectorRef.current?.dispose()
      detectorRef.current = null
      sourceRef.current?.stop()
      sourceRef.current = null
      speakerRef.current?.stop()
    }
  }, [videoRef, canvasRef, demoVideoUrl, modelName, setStageBoth, restartFraming, buildAnalyzer, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const harvest = useCallback(() => {
    const an = analyzerRef.current
    if (!an) return { reps: 0, secondsHeld: 0, formScore: 100, meanVisibility: 0, formFlags: {}, repEvents: [] }
    const snap = an.snapshot()
    const out = {
      reps: snap.reps,
      secondsHeld: Math.round(snap.heldMs / 1000),
      formScore: snap.formScore,
      meanVisibility: Math.round(an.meanVisibility() * 100) / 100,
      formFlags: snap.flags,
      repEvents: snap.repEvents,
    }
    analyzerRef.current = null
    return out
  }, [])

  const switchCamera = useCallback(async () => {
    const src = sourceRef.current
    if (src instanceof CameraSource) {
      try {
        await src.switchFacing()
      } catch (e) {
        setError((e as Error).message)
      }
    }
  }, [])

  // Mirror handled by CSS on the video/canvas; nothing to do here.
  void mirror

  return { stage, framing, countdown, error, modelName, harvest, restartFraming, switchCamera }
}
