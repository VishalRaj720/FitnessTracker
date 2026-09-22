import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { Button, Spinner } from '@/components/ui'
import { useAuthStore } from '@/features/auth/authStore'
import { useSessionStore } from '@/features/workout/store/sessionStore'
import { useWorkoutRunner } from '@/features/workout/hooks/useWorkoutRunner'
import { useManualCounter } from '@/features/workout/hooks/useManualCounter'
import { submitOrQueue } from '@/features/workout/sync/offlineQueue'
import { CueBanner, FormScoreRing, FpsBadge, GatedOverlay, HoldTimerDisplay, PhaseRing, RepCounter } from '@/features/workout/components/LiveWidgets'
import { SetupChecklist, SilhouetteGuide } from '@/features/workout/components/SetupChecklist'
import { errorMessage } from '@/lib/apiClient'
import { fmtClock } from '@/lib/format'
import { getDefinition } from '@/cv/exercises'

export function ActiveSessionPage() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const prefs = (user?.profile?.preferences ?? {}) as { voice?: boolean; language?: 'en' | 'hi'; mirror?: boolean }

  const status = useSessionStore((s) => s.status)
  const items = useSessionStore((s) => s.items)
  const currentIndex = useSessionStore((s) => s.currentIndex)
  const currentSet = useSessionStore((s) => s.currentSet)
  const restEndsAt = useSessionStore((s) => s.restEndsAt)
  const start = useSessionStore((s) => s.start)
  const completeSet = useSessionStore((s) => s.completeSet)
  const skipItem = useSessionStore((s) => s.skipItem)
  const endRest = useSessionStore((s) => s.endRest)
  const finish = useSessionStore((s) => s.finish)
  const setLastSubmission = useSessionStore((s) => s.setLastSubmission)

  const item = items[currentIndex] ?? null
  const useCamera = !!item?.useCamera
  const def = item ? getDefinition(item.exercise.slug) : null
  const orientation = def?.orientation ?? item?.exercise.orientation ?? 'any'
  const anyCamera = useMemo(() => items.some((i) => i.useCamera), [items])

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [manualFallback, setManualFallback] = useState(false)
  const [restLeft, setRestLeft] = useState(0)

  useEffect(() => {
    if (status === 'idle') nav('/home', { replace: true })
    if (status === 'ready') start()
  }, [status, start, nav])

  const demoVideo = params.get('source') === 'video' ? '/demo/squat_demo.mp4' : null
  const runner = useWorkoutRunner({
    videoRef,
    canvasRef,
    item: useCamera && !manualFallback ? item : null,
    enabled: status === 'active' && useCamera && !manualFallback,
    voice: prefs.voice !== false,
    lang: prefs.language === 'hi' ? 'hi' : 'en',
    mirror: prefs.mirror !== false,
    demoVideoUrl: anyCamera ? demoVideo : null,
  })

  const manual = useManualCounter(item?.exercise.mode ?? 'reps', status === 'active' && (!useCamera || manualFallback))

  // Rest countdown
  useEffect(() => {
    if (status !== 'rest' || !restEndsAt) return
    const tick = () => {
      const left = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000))
      setRestLeft(left)
      if (left === 0) endRest()
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [status, restEndsAt, endRest])

  const onCompleteSet = useCallback(() => {
    if (!item) return
    if (useCamera && !manualFallback) {
      const h = runner.harvest()
      completeSet({
        repsCompleted: h.reps,
        secondsHeld: h.secondsHeld,
        formScore: h.formScore,
        meanVisibility: h.meanVisibility,
        formFlags: h.formFlags,
        repEvents: h.repEvents,
      })
    } else {
      completeSet({ repsCompleted: manual.reps, secondsHeld: Math.round(manual.heldMs / 1000), formScore: null, meanVisibility: null })
    }
  }, [item, useCamera, manualFallback, runner, completeSet, manual.reps, manual.heldMs])

  // Auto-complete a set when the target is reached (camera mode).
  const liveReps = useSessionStore((s) => s.live.reps)
  const liveHeld = useSessionStore((s) => s.live.heldMs)
  useEffect(() => {
    if (status !== 'active' || !item || !useCamera || manualFallback || runner.stage !== 'tracking') return
    const done = item.exercise.mode === 'reps' ? liveReps >= item.targetReps && item.targetReps > 0 : liveHeld >= item.targetSeconds * 1000 && item.targetSeconds > 0
    if (done) {
      const id = setTimeout(onCompleteSet, 700)
      return () => clearTimeout(id)
    }
  }, [status, item, useCamera, manualFallback, runner.stage, liveReps, liveHeld, onCompleteSet])

  // Submit when finished
  useEffect(() => {
    if (status !== 'finished' || submitting) return
    const payload = finish()
    if (!payload) {
      nav('/home', { replace: true })
      return
    }
    setSubmitting(true)
    submitOrQueue(payload)
      .then(({ result, queued }) => {
        setLastSubmission({ payload, serverId: result?.id ?? null, queued })
        qc.invalidateQueries({ queryKey: ['plan'] })
        qc.invalidateQueries({ queryKey: ['progress'] })
        qc.invalidateQueries({ queryKey: ['sessions'] })
        qc.invalidateQueries({ queryKey: ['squad'] })
        qc.invalidateQueries({ queryKey: ['me'] })
        nav(`/workout/summary/${result?.id ?? 'local'}`, { replace: true, state: { result, queued } })
      })
      .catch((e) => {
        setSubmitError(errorMessage(e))
        setSubmitting(false)
      })
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!item && status !== 'finished') return null

  const showCamera = anyCamera && !manualFallback
  const tracking = useCamera && !manualFallback

  return (
    <div className="relative mx-auto flex h-full max-w-md flex-col bg-black md:max-w-2xl">
      {/* Camera stage */}
      <div className={clsx('relative w-full overflow-hidden bg-slate-950', showCamera ? 'aspect-[3/4] max-h-[62vh] md:aspect-video' : 'h-0')}>
        <video ref={videoRef} className={clsx('absolute inset-0 h-full w-full object-cover', prefs.mirror !== false && !demoVideo && 'scale-x-[-1]')} playsInline muted />
        <canvas ref={canvasRef} className={clsx('absolute inset-0 h-full w-full object-cover', prefs.mirror !== false && !demoVideo && 'scale-x-[-1]')} />

        {tracking && runner.stage === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/70">
            <Spinner />
            <div className="text-sm text-slate-300">Starting camera & loading pose model ({runner.modelName})…</div>
          </div>
        )}

        {tracking && runner.stage === 'framing' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <SilhouetteGuide orientation={orientation} />
          </div>
        )}

        {tracking && runner.stage === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="pulse-ring flex h-32 w-32 items-center justify-center rounded-full border-4 border-brand-400 bg-slate-950/60 text-7xl font-black text-brand-300">{runner.countdown || 'GO'}</div>
          </div>
        )}

        {tracking && runner.stage === 'tracking' && (
          <>
            <GatedOverlay />
            <div className="absolute inset-x-0 top-3 flex justify-center px-4">
              <CueBanner />
            </div>
            <div className="absolute right-2 top-2">
              <FpsBadge />
            </div>
          </>
        )}

        {showCamera && runner.stage === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 px-6 text-center">
            <div className="text-sm text-rose-200">{runner.error}</div>
            <Button onClick={() => setManualFallback(true)}>Continue in manual mode</Button>
          </div>
        )}
        {showCamera && !tracking && runner.stage !== 'error' && (
          <div className="absolute inset-x-0 bottom-2 flex justify-center">
            <div className="rounded-md bg-slate-950/70 px-2 py-1 text-[11px] text-slate-300">
              {runner.stage === 'loading' ? 'Camera warming up for the next exercise…' : 'Camera ready — this exercise is timer-based'}
            </div>
          </div>
        )}
      </div>

      {/* Control panel */}
      <div className="flex flex-1 flex-col gap-3 px-4 pb-[calc(var(--safe-bottom)+16px)] pt-3">
        {status === 'rest' ? (
          <RestPanel seconds={restLeft} next={items[currentIndex]?.exercise.name} set={currentSet} onSkip={endRest} />
        ) : status === 'finished' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <Spinner />
            <div className="text-sm text-slate-300">Saving your workout…</div>
            {submitError && (
              <div className="text-center text-sm text-rose-300">
                {submitError}
                <div className="mt-2">
                  <Button size="sm" variant="secondary" onClick={() => setSubmitting(false)}>
                    Retry
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          item && (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    Exercise {currentIndex + 1} of {items.length} · Set {currentSet}/{item.targetSets}
                  </div>
                  <div className="text-xl font-bold">{item.exercise.name}</div>
                  {item.focusCue && <div className="text-xs text-brand-300">{item.focusCue}</div>}
                </div>
                {tracking && runner.stage === 'tracking' && (
                  <div className="flex items-center gap-2">
                    {item.exercise.mode === 'reps' && <PhaseRing />}
                    <FormScoreRing />
                  </div>
                )}
              </div>

              {tracking && (runner.stage === 'framing' || runner.stage === 'countdown') ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                  <div className="mb-2 text-sm font-semibold">{orientation === 'side' ? 'Stand side-on, whole body visible' : orientation === 'front' ? 'Face the camera, whole body visible' : 'Get into position'}</div>
                  <SetupChecklist framing={runner.framing} orientation={orientation} />
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={runner.switchCamera}>
                      Switch camera
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setManualFallback(true)}>
                      Use manual mode
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  {item.exercise.mode === 'reps' ? <RepCounter target={item.targetReps} /> : <HoldTimerDisplay targetSeconds={item.targetSeconds} />}
                  {!tracking && (
                    <div className="flex flex-col gap-2">
                      {item.exercise.mode === 'reps' ? (
                        <>
                          <Button size="lg" onClick={manual.tap} className="min-w-28">
                            +1 rep
                          </Button>
                          <Button size="sm" variant="ghost" onClick={manual.undo}>
                            undo
                          </Button>
                        </>
                      ) : (
                        <Button size="lg" onClick={manual.toggle} className="min-w-28">
                          {manual.running ? 'Pause' : 'Start'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!tracking && <div className="text-xs text-slate-500">{item.exercise.instructions}</div>}

              <div className="mt-auto flex gap-2">
                <Button variant="ghost" onClick={skipItem}>
                  Skip
                </Button>
                <Button variant="secondary" className="flex-1" onClick={onCompleteSet} disabled={tracking && runner.stage !== 'tracking'}>
                  {currentSet < item.targetSets ? 'Finish set' : currentIndex + 1 < items.length ? 'Next exercise' : 'Finish workout'}
                </Button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}

function RestPanel({ seconds, next, set, onSkip }: { seconds: number; next?: string; set: number; onSkip: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <div className="text-xs uppercase tracking-wide text-slate-400">Rest</div>
      <div className="text-6xl font-black tabular-nums">{fmtClock(seconds)}</div>
      <div className="text-sm text-slate-300">
        Next: <span className="font-semibold text-white">{next}</span> · set {set}
      </div>
      <Button variant="secondary" size="sm" onClick={onSkip} className="mt-2">
        Skip rest
      </Button>
    </div>
  )
}
