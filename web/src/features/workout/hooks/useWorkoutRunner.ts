import { useCallback, useEffect, useRef, useState } from 'react'
import { PoseWorkerClient } from '@/cv/pose/PoseWorkerClient'
import { MainThreadPoseEngine } from '@/cv/pose/MainThreadPoseEngine'
import type { PoseEngine, PoseResult } from '@/cv/pose/PoseEngine'
import { CameraSource, VideoFileSource, type FrameSource } from '@/cv/sources/FrameSource'
import { PoseRenderer } from '@/cv/render/PoseRenderer'
import { PerformanceGovernor, TIER_PROFILES, probeDevice, type Tier, type TierProfile } from '@/cv/perf/PerformanceGovernor'
import { ExerciseAnalyzer } from '@/cv/engine/ExerciseAnalyzer'
import { FeedbackArbiter } from '@/cv/engine/FeedbackArbiter'
import { getDefinition } from '@/cv/exercises'
import { checkFraming, type FramingCheck } from '@/cv/geometry/orientation'
import { Speaker } from '@/cv/feedback/tts'
import { CoachDirector } from '@/features/companion/CoachDirector'
import type { Pose } from '@/cv/pose/landmarks'
import { env } from '@/lib/env'
import { useSessionStore, type LiveState, type RunnerItem } from '@/features/workout/store/sessionStore'

export type RunnerStage = 'loading' | 'framing' | 'countdown' | 'tracking' | 'error'

export interface RunnerOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  item: RunnerItem | null
  enabled: boolean // false during rest / manual mode
  /**
   * Whether to hold the camera and pose engine open at all. Defaults to true.
   *
   * Callers that mount the <video> conditionally must drive this, because the boot effect
   * keys off stable refs: if it runs while videoRef.current is still null it bails, and
   * nothing would make it run again once the element appears.
   */
  active?: boolean
  voice: boolean
  lang: 'en' | 'hi'
  mirror: boolean
  demoVideoUrl?: string | null
  /**
   * Observe every inference result. Used by the tutorial to scale its ghost to the user's
   * body. Called at inference rate, so it must not allocate or touch React state.
   */
  onPose?: (pose: Pose | null) => void
  /** Enable the Gemini-backed per-rep coach. Off unless the backend reports it available. */
  coach?: boolean
  /** Which set of the current exercise this is, for the coach's context. */
  setNumber?: number
}

export interface RunnerApi {
  stage: RunnerStage
  framing: FramingCheck | null
  countdown: number
  error: string | null
  modelName: 'lite' | 'full'
  tier: Tier
  /** 'worker' when inference is off the main thread; 'main' on the fallback path. */
  engineKind: 'worker' | 'main'
  /** Collect the analyzer's results for the current set and reset for the next one. */
  harvest: () => { reps: number; secondsHeld: number; formScore: number; meanVisibility: number; formFlags: Record<string, number>; repEvents: number[][] }
  restartFraming: () => void
  switchCamera: () => Promise<void>
}

const FRAMING_STABLE_MS = 1500
const COUNTDOWN_S = 3
const LIVE_FLUSH_MS = 100
const FRAMING_UI_MS = 200

/**
 * Owns the camera, the pose engine, the overlay renderer and one ExerciseAnalyzer per set.
 *
 * Three loops run at different rates and must stay decoupled:
 *   capture   - up to the camera frame rate, throttled to the tier's target Hz
 *   inference - in the worker, one frame in flight, results arrive via onPose
 *   render    - PoseRenderer's own rAF loop at display refresh, interpolating between poses
 *
 * High-frequency state goes into a ref and is flushed to Zustand at ~10 Hz; only discrete
 * events (a rep, a phase change, a cue, the visibility gate) write through immediately.
 */
export function useWorkoutRunner(opts: RunnerOptions): RunnerApi {
  const { videoRef, canvasRef, item, enabled, voice, lang, mirror, demoVideoUrl, active = true, coach = false, setNumber = 1 } = opts
  // Kept in a ref so a changing callback identity never re-boots the camera.
  const onPoseCbRef = useRef(opts.onPose)
  onPoseCbRef.current = opts.onPose
  const [stage, setStage] = useState<RunnerStage>('loading')
  const [framing, setFraming] = useState<FramingCheck | null>(null)
  const [countdown, setCountdown] = useState(COUNTDOWN_S)
  const [error, setError] = useState<string | null>(null)
  const [probe] = useState(probeDevice)
  const [tier, setTier] = useState<Tier>(probe.initial)
  const [engineKind, setEngineKind] = useState<'worker' | 'main'>('worker')

  const engineRef = useRef<PoseEngine | null>(null)
  const sourceRef = useRef<FrameSource | null>(null)
  const rendererRef = useRef<PoseRenderer | null>(null)
  const governorRef = useRef<PerformanceGovernor | null>(null)
  const analyzerRef = useRef<ExerciseAnalyzer | null>(null)
  const arbiterRef = useRef<FeedbackArbiter | null>(null)
  const directorRef = useRef<CoachDirector | null>(null)
  const directorSlugRef = useRef<string | null>(null)
  const coachRef = useRef(coach)
  const setNumberRef = useRef(setNumber)
  const speakerRef = useRef<Speaker | null>(null)
  const stageRef = useRef<RunnerStage>('loading')
  const framingGoodSince = useRef<number | null>(null)
  const framingUiAt = useRef(0)
  const countdownStart = useRef<number | null>(null)
  const rafRef = useRef<number>(0)
  const lastPoseRef = useRef<Pose | null>(null)
  const lastWorldRef = useRef<Float32Array | null>(null)
  const fpsRef = useRef({ frames: 0, t: 0 })
  const lastSubmitRef = useRef(0)
  const minIntervalRef = useRef(1000 / TIER_PROFILES[probe.initial].targetHz)
  const itemRef = useRef<RunnerItem | null>(item)
  const enabledRef = useRef(enabled)
  const startedAtRef = useRef<number>(0)
  const liveRef = useRef<Partial<LiveState>>({})
  const lastSnapRef = useRef({ reps: -1, phase: '', gated: false })

  itemRef.current = item
  enabledRef.current = enabled
  coachRef.current = coach
  setNumberRef.current = setNumber

  const setStageBoth = useCallback((s: RunnerStage) => {
    stageRef.current = s
    setStage(s)
  }, [])

  // ---- throttled live state ------------------------------------------------
  const queueLive = useCallback((patch: Partial<LiveState>) => {
    Object.assign(liveRef.current, patch)
  }, [])

  const flushLive = useCallback(() => {
    const patch = liveRef.current
    if (Object.keys(patch).length === 0) return
    liveRef.current = {}
    useSessionStore.getState().updateLive(patch)
  }, [])

  useEffect(() => {
    const id = setInterval(flushLive, LIVE_FLUSH_MS)
    return () => {
      clearInterval(id)
      flushLive()
    }
  }, [flushLive])

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
    // The director outlives a single set: its set-end request is answered during the rest
    // period, and rebuilding it here would abort that request just as the answer arrives.
    // It is replaced only when the exercise itself changes.
    if (directorSlugRef.current !== def.id) {
      directorRef.current?.dispose()
      directorRef.current = null
      directorSlugRef.current = def.id
    }
    if (!directorRef.current && coachRef.current) {
      directorRef.current = new CoachDirector({
        def,
        onCue: (c) => {
          const arb = arbiterRef.current
          if (!arb) return
          const decided = arb.tryExternal(c.text, c.urgency, performance.now())
          if (!decided) return
          const store = useSessionStore.getState()
          store.setCue({ text: decided.text, tone: decided.tone, at: performance.now() })
          store.setCoachNote(c.observation ?? c.text)
          if (decided.speak) speakerRef.current?.speak(decided.text, { interrupt: false })
        },
      })
    }
    startedAtRef.current = performance.now()
    lastSnapRef.current = { reps: -1, phase: '', gated: false }
  }, [lang])

  const restartFraming = useCallback(() => {
    framingGoodSince.current = null
    countdownStart.current = null
    setCountdown(COUNTDOWN_S)
    if (engineRef.current) setStageBoth('framing')
  }, [setStageBoth])

  // When the item changes (next exercise), go back to framing for a new orientation check.
  useEffect(() => {
    if (!item) return
    analyzerRef.current = null
    if (engineRef.current) restartFraming()
  }, [item?.key, restartFraming]) // eslint-disable-line react-hooks/exhaustive-deps

  // Camera + engine + renderer lifecycle
  useEffect(() => {
    let cancelled = false
    if (!active) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const applyProfile = (t: Tier, profile: TierProfile, reason: string) => {
      if (cancelled) return
      console.info('[cv] tier -> ' + t + ' (' + reason + ')')
      setTier(t)
      minIntervalRef.current = 1000 / profile.targetHz
      rendererRef.current?.setDetail(profile.detail)
      engineRef.current?.setInputWidth(profile.inputWidth)
      engineRef.current?.setModel(profile.model === 'full' ? env.modelFull : env.modelLite)
      const src = sourceRef.current
      if (src instanceof CameraSource) void src.applyProfile(profile.capture)
    }

    // ---- inference results: analyzer + governor + renderer ----
    const onPose = ({ pose, world, ts, inferenceMs }: PoseResult) => {
      if (cancelled) return
      lastPoseRef.current = pose
      if (world) lastWorldRef.current = world
      onPoseCbRef.current?.(pose)
      rendererRef.current?.push(pose, ts)
      governorRef.current?.sample(inferenceMs, ts)

      const f = fpsRef.current
      f.frames += 1
      if (ts - f.t >= 1000) {
        queueLive({
          fps: Math.round((f.frames * 1000) / (ts - f.t)),
          inferenceMs: Math.round(inferenceMs),
          renderFps: rendererRef.current?.renderFps ?? 0,
          tier: governorRef.current?.tier ?? 'medium',
        })
        flushLive()
        f.frames = 0
        f.t = ts
      }

      step(pose, ts)
    }

    const step = (raw: Pose | null, now: number) => {
      const it = itemRef.current
      const st = stageRef.current
      if (!it || !enabledRef.current) return

      if (st === 'framing' || st === 'countdown') {
        governorRef.current?.setLocked(st === 'countdown')
        const def = getDefinition(it.exercise.slug)
        const fc = checkFraming(raw, def?.requiredLandmarks ?? [], def?.orientation ?? 'any')
        // The checklist is a human-readable hint; 5 Hz is plenty and keeps React out of the loop.
        if (now - framingUiAt.current >= FRAMING_UI_MS) {
          framingUiAt.current = now
          setFraming(fc)
        }
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
        rendererRef.current?.setGated(snap.gated)

        // Swapping the model resets tracking, so never do it once a set is under way.
        governorRef.current?.setLocked(snap.reps > 0 || snap.heldMs > 0)

        const last = lastSnapRef.current
        const discrete = snap.reps !== last.reps || snap.phase !== last.phase || snap.gated !== last.gated
        queueLive({
          reps: snap.reps,
          partials: snap.partials,
          heldMs: snap.heldMs,
          phase: snap.phase,
          inTolerance: snap.inTolerance,
          formScore: snap.formScore,
          visibility: snap.visibility,
          gated: snap.gated,
          cleanStreak: snap.cleanStreak,
        })
        if (discrete) {
          lastSnapRef.current = { reps: snap.reps, phase: snap.phase, gated: snap.gated }
          flushLive()
        }

        const repEvent = events.find((e) => e.type === 'rep')
        if (repEvent && directorRef.current) {
          directorRef.current.onRep({
            recent: an.recentKinematics(3),
            repCount: snap.reps,
            setNumber: setNumberRef.current,
            violations: snap.flags,
          })
        }

        if (events.length) {
          const cue = arb.decide(events, now, snap.cleanStreak)
          if (cue) {
            useSessionStore.getState().setCue({ text: cue.text, tone: cue.tone, at: now })
            if (cue.speak) speakerRef.current?.speak(cue.text, { interrupt: cue.tone === 'correction' })
          }
        }
      }
    }

    // ---- capture loop: hands frames to the engine, never blocks on inference ----
    const captureLoop = () => {
      const tick = () => {
        if (cancelled) return
        const v = videoRef.current
        const engine = engineRef.current
        if (v && engine && !engine.busy) {
          const now = performance.now()
          if (now - lastSubmitRef.current >= minIntervalRef.current) {
            lastSubmitRef.current = now
            engine.submit(v, now)
          }
        }
        schedule()
      }
      const schedule = () => {
        const vv = videoRef.current as (HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }) | null
        if (vv?.requestVideoFrameCallback) vv.requestVideoFrameCallback(tick)
        else rafRef.current = requestAnimationFrame(tick)
      }
      schedule()
    }

    const boot = async () => {
      try {
        setStageBoth('loading')
        const startProfile = TIER_PROFILES[probe.initial]
        const source: FrameSource = demoVideoUrl
          ? new VideoFileSource(video, demoVideoUrl)
          : new CameraSource(video, 'user', startProfile.capture)
        sourceRef.current = source
        await source.start()
        if (cancelled) return

        const modelPath = startProfile.model === 'full' ? env.modelFull : env.modelLite
        let engine: PoseEngine
        try {
          engine = await PoseWorkerClient.create({ modelPath, delegate: 'GPU' })
        } catch (e) {
          // Worker or WebGL2-in-worker unavailable: keep working, just on the main thread.
          console.warn('[cv] pose worker unavailable, falling back to main thread', e)
          engine = await MainThreadPoseEngine.create({ wasmPath: env.wasmPath, modelPath, delegate: 'GPU' })
        }
        if (cancelled) {
          engine.dispose()
          return
        }
        engineRef.current = engine
        setEngineKind(engine.kind)
        engine.setInputWidth(startProfile.inputWidth)
        engine.onPose = onPose

        const renderer = new PoseRenderer(canvas, {
          videoSize: () => ({ width: video.videoWidth, height: video.videoHeight }),
          detail: startProfile.detail,
        })
        rendererRef.current = renderer
        renderer.start()

        governorRef.current = new PerformanceGovernor({
          initial: probe.initial,
          maxTier: probe.maxTier,
          onChange: applyProfile,
        })

        fpsRef.current = { frames: 0, t: performance.now() }
        restartFraming()
        captureLoop()
      } catch (e) {
        if (cancelled) return
        const msg =
          (e as Error).name === 'NotAllowedError'
            ? 'Camera permission denied. You can still do this workout in manual mode.'
            : (e as Error).message || 'Could not start the camera'
        setError(msg)
        setStageBoth('error')
      }
    }

    boot()
    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      directorRef.current?.dispose()
      directorRef.current = null
      directorSlugRef.current = null
      rendererRef.current?.dispose()
      rendererRef.current = null
      engineRef.current?.dispose()
      engineRef.current = null
      governorRef.current = null
      sourceRef.current?.stop()
      sourceRef.current = null
      speakerRef.current?.stop()
    }
  }, [videoRef, canvasRef, demoVideoUrl, probe, active, setStageBoth, restartFraming, buildAnalyzer, lang, queueLive, flushLive])

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
    directorRef.current?.onSetEnd()
    governorRef.current?.setLocked(false)
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

  return {
    stage,
    framing,
    countdown,
    error,
    modelName: TIER_PROFILES[tier].model,
    tier,
    engineKind,
    harvest,
    restartFraming,
    switchCamera,
  }
}
