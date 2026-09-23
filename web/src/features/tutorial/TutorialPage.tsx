import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { Alert, Badge, Button, Card, PageTitle, Spinner } from '@/components/ui'
import { useAuthStore } from '@/features/auth/authStore'
import { useExercises } from '@/features/exercises/ExercisesPage'
import { useSessionStore, type RunnerItem } from '@/features/workout/store/sessionStore'
import { useWorkoutRunner } from '@/features/workout/hooks/useWorkoutRunner'
import { SetupChecklist } from '@/features/workout/components/SetupChecklist'
import { DemoFigure } from '@/features/tutorial/DemoFigure'
import { markTutorialCompleted } from '@/features/tutorial/completion'
import { GhostRenderer } from '@/cv/render/GhostRenderer'
import { getClip, sampleClipWorld } from '@/cv/demo/clips'
import { getDefinition } from '@/cv/exercises'
import type { Pose } from '@/cv/pose/landmarks'
import { errorMessage } from '@/lib/apiClient'

type Stage = 'watch' | 'position' | 'shadow' | 'done'

/** Clean reps in a row that count as "you have got it". Holds use seconds instead. */
const CLEAN_REPS_TARGET = 3
const HOLD_TARGET_MS = 10_000

/**
 * Guided, camera-based tutorial for one exercise.
 *
 * Nothing here is recorded: no session is submitted and `harvest()` is used only to report
 * which mistakes showed up, so a user can practise as badly as they like without it landing
 * on their streak or their form trend.
 */
export function TutorialPage() {
  const { slug = '' } = useParams()
  const nav = useNavigate()
  const exercises = useExercises()
  const user = useAuthStore((s) => s.user)
  const prefs = (user?.profile?.preferences ?? {}) as { voice?: boolean; language?: 'en' | 'hi'; mirror?: boolean }
  const lang = prefs.language === 'hi' ? 'hi' : 'en'

  const [stage, setStage] = useState<Stage>('watch')
  const [stepIndex, setStepIndex] = useState(0)
  const [outcome, setOutcome] = useState<{ reps: number; formScore: number; flags: Record<string, number> } | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ghostCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const userPoseRef = useRef<Pose | null>(null)
  const ghostRef = useRef<GhostRenderer | null>(null)

  const exercise = useMemo(() => (exercises.data ?? []).find((e) => e.slug === slug) ?? null, [exercises.data, slug])
  const def = getDefinition(slug)
  const clip = getClip(slug)
  const tutorial = def?.tutorial ?? null
  const isHold = def?.mode === 'hold'

  const item: RunnerItem | null = useMemo(
    () =>
      exercise
        ? {
            key: `tutorial-${slug}`,
            planItemId: null,
            exercise,
            // Targets the user will never reach, so nothing auto-completes underneath them.
            targetSets: 1,
            targetReps: 999,
            targetSeconds: 9999,
            restSeconds: 0,
            focusCue: null,
            useCamera: true,
          }
        : null,
    [exercise, slug],
  )

  const cameraOn = stage === 'position' || stage === 'shadow'

  const handlePose = useCallback((pose: Pose | null) => {
    if (pose) userPoseRef.current = pose
  }, [])

  const runner = useWorkoutRunner({
    videoRef,
    canvasRef,
    item: cameraOn ? item : null,
    enabled: cameraOn,
    // The <video> only exists in the camera stages, so the runner must be told when to boot.
    active: cameraOn,
    voice: prefs.voice !== false,
    lang,
    mirror: prefs.mirror !== false,
    onPose: handlePose,
  })

  const reps = useSessionStore((s) => s.live.reps)
  const heldMs = useSessionStore((s) => s.live.heldMs)
  const cleanStreak = useSessionStore((s) => s.live.cleanStreak)
  const cue = useSessionStore((s) => s.live.cue)

  // Ghost overlay lifecycle — its own loop, like the pose overlay.
  useEffect(() => {
    const canvas = ghostCanvasRef.current
    if (!canvas || !clip || !cameraOn) return
    const ghost = new GhostRenderer(canvas, {
      videoSize: () => ({ width: videoRef.current?.videoWidth ?? 0, height: videoRef.current?.videoHeight ?? 0 }),
      sampler: (tMs) => sampleClipWorld(clip, (tMs % clip.loopMs) / clip.loopMs),
      view: clip.view,
      userPose: () => userPoseRef.current,
    })
    ghostRef.current = ghost
    ghost.start()
    return () => {
      ghost.dispose()
      ghostRef.current = null
    }
  }, [clip, cameraOn])

  // While positioning, hold the ghost at the start of the movement so the user can copy it.
  useEffect(() => {
    ghostRef.current?.freezeAt(stage === 'position' ? 0 : null)
  }, [stage])

  // Tracking started means framing passed, so the user is in position.
  useEffect(() => {
    if (stage === 'position' && runner.stage === 'tracking') setStage('shadow')
  }, [stage, runner.stage])

  // harvest() clears the analyzer, so a second call would return zeros and wipe the result.
  const finishedRef = useRef(false)
  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    const h = runner.harvest()
    setOutcome({ reps: h.reps, formScore: h.formScore, flags: h.formFlags })
    setStage('done')
    void markTutorialCompleted(slug)
  }, [runner, slug])

  // Checkpoint: a few clean reps in a row, or a steady hold.
  const passed = isHold ? heldMs >= HOLD_TARGET_MS : cleanStreak >= CLEAN_REPS_TARGET
  useEffect(() => {
    if (stage === 'shadow' && passed) finish()
  }, [stage, passed, finish])

  if (exercises.isPending) return <Centered><Spinner /></Centered>
  if (exercises.isError) return <Centered><Alert>{errorMessage(exercises.error)}</Alert></Centered>
  if (!exercise || !def || !clip || !tutorial) {
    return (
      <Centered>
        <Alert>No camera tutorial is available for this exercise yet.</Alert>
        <Button className="mt-3" variant="secondary" onClick={() => nav('/exercises')}>
          Back to exercises
        </Button>
      </Centered>
    )
  }

  const t = (v: { en: string; hi: string }) => (lang === 'hi' ? v.hi : v.en)
  const step = tutorial.steps[stepIndex]

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-3 p-4 pb-[calc(var(--safe-bottom)+16px)] md:max-w-2xl">
      <PageTitle
        title={exercise.name}
        subtitle={stage === 'watch' ? 'Learn the movement' : stage === 'position' ? 'Get into position' : stage === 'shadow' ? 'Follow the ghost' : 'Nice work'}
        right={<Badge tone="brand">{clip.view === 'side' ? 'Side view' : 'Front view'}</Badge>}
      />

      <StageBar stage={stage} />

      {stage === 'watch' && (
        <>
          <Card className="relative aspect-square overflow-hidden p-0">
            <DemoFigure clip={clip} />
            <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] text-slate-400">drag to rotate</div>
          </Card>

          <Card>
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">
              Step {stepIndex + 1} of {tutorial.steps.length}
            </div>
            <div className="text-lg font-bold">{t(step.title)}</div>
            <p className="mt-1 text-sm text-slate-300">{t(step.body)}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="ghost" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => i - 1)}>
                Back
              </Button>
              {stepIndex < tutorial.steps.length - 1 ? (
                <Button size="sm" className="flex-1" onClick={() => setStepIndex((i) => i + 1)}>
                  Next
                </Button>
              ) : (
                <Button size="sm" className="flex-1" onClick={() => setStage('position')}>
                  Try it on camera
                </Button>
              )}
            </div>
          </Card>

          <Card>
            <div className="mb-2 text-sm font-semibold">What matters</div>
            <ul className="space-y-1.5">
              {tutorial.keyPoints.map((k, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-300">
                  <span className="text-brand-400">✓</span>
                  {t(k)}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <div className="mb-2 text-sm font-semibold">What usually goes wrong</div>
            <ul className="space-y-1.5">
              {Object.entries(tutorial.commonMistakes).map(([id, m]) => (
                <li key={id} className="flex gap-2 text-sm text-slate-400">
                  <span className="text-amber-400">!</span>
                  {t(m)}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {(stage === 'position' || stage === 'shadow') && (
        <>
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-slate-950 md:aspect-video">
            <video ref={videoRef} className={clsx('absolute inset-0 h-full w-full object-cover', prefs.mirror !== false && 'scale-x-[-1]')} playsInline muted />
            <canvas ref={ghostCanvasRef} className={clsx('absolute inset-0 h-full w-full', prefs.mirror !== false && 'scale-x-[-1]')} />
            <canvas ref={canvasRef} className={clsx('absolute inset-0 h-full w-full', prefs.mirror !== false && 'scale-x-[-1]')} />

            {runner.stage === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/70">
                <Spinner />
                <div className="text-sm text-slate-300">Starting camera…</div>
              </div>
            )}
            {runner.stage === 'countdown' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="pulse-ring flex h-28 w-28 items-center justify-center rounded-full border-4 border-brand-400 bg-slate-950/60 text-6xl font-black text-brand-300">
                  {runner.countdown || 'GO'}
                </div>
              </div>
            )}
            {stage === 'shadow' && cue && cue.tone !== 'count' && (
              <div className="absolute inset-x-0 top-3 flex justify-center px-4">
                <div
                  className={clsx(
                    'rounded-2xl px-4 py-2 text-center text-xl font-extrabold shadow-lg',
                    cue.tone === 'correction' && 'bg-rose-500 text-white',
                    cue.tone === 'praise' && 'bg-brand-500 text-slate-950',
                    cue.tone === 'info' && 'bg-slate-800/90 text-slate-100',
                  )}
                >
                  {cue.text}
                </div>
              </div>
            )}
            {runner.stage === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 px-6 text-center">
                <div className="text-sm text-rose-200">{runner.error}</div>
                <Button size="sm" variant="secondary" onClick={() => setStage('watch')}>
                  Back to the demo
                </Button>
              </div>
            )}
          </div>

          {stage === 'position' ? (
            <Card>
              <div className="mb-2 text-sm font-semibold">
                {clip.view === 'side' ? 'Stand side-on, whole body visible' : 'Face the camera, whole body visible'}
              </div>
              <SetupChecklist framing={runner.framing} orientation={def.orientation} />
              <p className="mt-2 text-xs text-slate-400">Line yourself up with the glowing figure. Tracking starts on its own.</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={runner.switchCamera}>
                  Switch camera
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setStage('watch')}>
                  Back to the demo
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">{t(tutorial.shadowCue)}</div>
                  <div className="text-lg font-bold">
                    {isHold ? `${Math.floor(heldMs / 1000)}s / ${HOLD_TARGET_MS / 1000}s held` : `${cleanStreak} / ${CLEAN_REPS_TARGET} clean in a row`}
                  </div>
                  {!isHold && <div className="text-xs text-slate-500">{reps} total reps</div>}
                </div>
                <div className="flex gap-1.5">
                  {!isHold &&
                    Array.from({ length: CLEAN_REPS_TARGET }, (_, i) => (
                      <span key={i} className={clsx('h-3 w-3 rounded-full', i < cleanStreak ? 'bg-brand-400' : 'bg-slate-700')} />
                    ))}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setStage('watch')}>
                  Watch again
                </Button>
                <Button size="sm" variant="secondary" className="flex-1" onClick={finish}>
                  I am done practising
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      {stage === 'done' && outcome && (
        <>
          <Card className="text-center">
            <div className="text-5xl">💪</div>
            <div className="mt-2 text-xl font-bold">You have got the shape of it</div>
            <div className="mt-1 text-sm text-slate-300">
              {outcome.reps} rep{outcome.reps === 1 ? '' : 's'} practised · form score {outcome.formScore}
            </div>
          </Card>

          <Card>
            <div className="mb-2 text-sm font-semibold">
              {Object.keys(outcome.flags).length ? 'Watch these next time' : 'Nothing to correct — that was clean'}
            </div>
            {Object.keys(outcome.flags).length ? (
              <ul className="space-y-1.5">
                {Object.entries(outcome.flags)
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, count]) => {
                    const m = tutorial.commonMistakes[id]
                    const rule = def.rules.find((r) => r.id === id)
                    return (
                      <li key={id} className="flex gap-2 text-sm text-slate-300">
                        <span className="text-amber-400">!</span>
                        <span>
                          {m ? t(m) : rule ? t(rule.cue) : id}
                          <span className="text-slate-500"> · {count}×</span>
                        </span>
                      </li>
                    )
                  })}
              </ul>
            ) : (
              <ul className="space-y-1.5">
                {tutorial.keyPoints.map((k, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="text-brand-400">✓</span>
                    {t(k)}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="mt-auto flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                finishedRef.current = false
                setOutcome(null)
                setStepIndex(0)
                setStage('watch')
              }}
            >
              Practise again
            </Button>
            <Button className="flex-1" onClick={() => nav('/exercises')}>
              Done
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function StageBar({ stage }: { stage: Stage }) {
  const stages: { id: Stage; label: string }[] = [
    { id: 'watch', label: 'Watch' },
    { id: 'position', label: 'Position' },
    { id: 'shadow', label: 'Practise' },
    { id: 'done', label: 'Done' },
  ]
  const current = stages.findIndex((s) => s.id === stage)
  return (
    <div className="flex gap-1.5">
      {stages.map((s, i) => (
        <div key={s.id} className="flex-1">
          <div className={clsx('h-1 rounded-full', i <= current ? 'bg-brand-400' : 'bg-slate-800')} />
          <div className={clsx('mt-1 text-[10px]', i <= current ? 'text-brand-300' : 'text-slate-600')}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">{children}</div>
}
