import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { Alert, Badge, Button, Card, Icon, MonoLabel, SegmentBar, Spinner } from '@/components/ui'
import { Backdrop } from '@/components/layout/Backdrop'
import { FlowHeader } from '@/components/layout/FlowHeader'
import { useAuthStore } from '@/features/auth/authStore'
import { useExercises } from '@/features/exercises/api'
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

  if (exercises.isPending)
    return (
      <Centered>
        <Spinner className="h-6 w-6 text-pulse" />
      </Centered>
    )
  if (exercises.isError)
    return (
      <Centered>
        <Alert>{errorMessage(exercises.error)}</Alert>
      </Centered>
    )
  if (!exercise || !def || !clip || !tutorial) {
    return (
      <Centered>
        <Alert tone="info">No camera tutorial is available for this exercise yet.</Alert>
        <Button className="mt-4" variant="secondary" icon="arrow-left" onClick={() => nav('/exercises')}>
          Back to exercises
        </Button>
      </Centered>
    )
  }

  const t = (v: { en: string; hi: string }) => (lang === 'hi' ? v.hi : v.en)
  const step = tutorial.steps[stepIndex]
  const stageLabel = stage === 'watch' ? 'Learn the movement' : stage === 'position' ? 'Get into position' : stage === 'shadow' ? 'Follow the ghost' : 'Nice work'
  const mirror = prefs.mirror !== false

  return (
    <div className="relative flex min-h-full flex-col">
      <Backdrop variant="dots" />
      <FlowHeader
        tag="tutorial"
        width="max-w-5xl"
        right={
          <button type="button" aria-label="Close tutorial" onClick={() => nav('/exercises')} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.05] hover:text-white">
            <Icon name="x" size={20} />
          </button>
        }
      />
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 pb-[calc(var(--safe-bottom)+24px)] sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <MonoLabel dot="pulse">Tutorial // {stageLabel}</MonoLabel>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{exercise.name}</h1>
          </div>
          <Badge tone="volt" mono icon="scan">
            {clip.view === 'side' ? 'Side view' : 'Front view'}
          </Badge>
        </div>

        <StageBar stage={stage} />

        {stage === 'watch' && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-ink-950 shadow-card">
              <div className="absolute inset-0 bg-dot-signal opacity-40" />
              <div className="absolute inset-0">
                <DemoFigure clip={clip} />
              </div>
              <span className="pointer-events-none absolute left-3 top-3 font-mono text-[10px] text-slate-600">┏ [DEMO_FEED]</span>
              <span className="pointer-events-none absolute right-3 top-3 font-mono text-[10px] text-pulse">{clip.view === 'side' ? 'SIDE' : 'FRONT'} ┓</span>
              <span className="pointer-events-none absolute bottom-3 left-3 font-mono text-[10px] text-slate-500">┗ drag to rotate</span>
            </div>

            <div className="space-y-4">
              <Card radius="xl" pad="md" brackets>
                <MonoLabel>
                  Step {stepIndex + 1} of {tutorial.steps.length}
                </MonoLabel>
                <div className="mt-2 text-lg font-bold text-white">{t(step.title)}</div>
                <p className="mt-1 text-sm leading-relaxed text-slate-300">{t(step.body)}</p>
                <SegmentBar total={tutorial.steps.length} filled={stepIndex + 1} tone="pulse" height="h-1" className="mt-4" />
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="ghost" icon="arrow-left" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => i - 1)}>
                    Back
                  </Button>
                  {stepIndex < tutorial.steps.length - 1 ? (
                    <Button size="sm" variant="secondary" block iconRight="arrow-right" onClick={() => setStepIndex((i) => i + 1)}>
                      Next
                    </Button>
                  ) : (
                    <Button size="sm" variant="primary" block icon="camera" onClick={() => setStage('position')}>
                      Try it on camera
                    </Button>
                  )}
                </div>
              </Card>

              <Card radius="xl" pad="md">
                <div className="mb-3 text-sm font-semibold text-white">What matters</div>
                <ul className="space-y-2">
                  {tutorial.keyPoints.map((k, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-slate-300">
                      <Icon name="check" size={15} className="mt-0.5 shrink-0 text-brand-400" />
                      {t(k)}
                    </li>
                  ))}
                </ul>
              </Card>

              <Card radius="xl" pad="md">
                <div className="mb-3 text-sm font-semibold text-white">What usually goes wrong</div>
                <ul className="space-y-2">
                  {Object.entries(tutorial.commonMistakes).map(([id, m]) => (
                    <li key={id} className="flex gap-2.5 text-sm text-slate-400">
                      <Icon name="alert" size={15} className="mt-0.5 shrink-0 text-flame" />
                      {t(m)}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        )}

        {(stage === 'position' || stage === 'shadow') && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-line bg-ink-950 shadow-card md:aspect-video">
              <video ref={videoRef} className={clsx('absolute inset-0 h-full w-full object-cover', mirror && 'scale-x-[-1]')} playsInline muted />
              <canvas ref={ghostCanvasRef} className={clsx('absolute inset-0 h-full w-full', mirror && 'scale-x-[-1]')} />
              <canvas ref={canvasRef} className={clsx('absolute inset-0 h-full w-full', mirror && 'scale-x-[-1]')} />
              <span className="pointer-events-none absolute left-3 top-3 font-mono text-[10px] text-slate-300/80">┏ [LIVE_FEED] PRACTICE</span>
              <span className="pointer-events-none absolute bottom-3 left-3 font-mono text-[10px] text-brand-300/80">┗ NOTHING IS RECORDED</span>

              {runner.stage === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-950/75">
                  <Spinner className="h-6 w-6 text-pulse" />
                  <div className="font-mono text-xs text-slate-300">Starting camera…</div>
                </div>
              )}
              {runner.stage === 'countdown' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="pulse-ring flex h-28 w-28 items-center justify-center rounded-full border-4 border-brand-400 bg-ink-950/60 font-mono text-6xl font-black text-brand-300 shadow-glow-signal">
                    {runner.countdown || 'GO'}
                  </div>
                </div>
              )}
              {stage === 'shadow' && cue && cue.tone !== 'count' && (
                <div className="absolute inset-x-0 top-10 flex justify-center px-4">
                  <div
                    className={clsx(
                      'rounded-2xl px-4 py-2 text-center text-xl font-extrabold shadow-lg',
                      cue.tone === 'correction' && 'bg-rose-500 text-white',
                      cue.tone === 'praise' && 'bg-brand-400 text-ink-950',
                      cue.tone === 'info' && 'border border-line bg-ink-800/90 text-slate-100',
                    )}
                  >
                    {cue.text}
                  </div>
                </div>
              )}
              {runner.stage === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-950/90 px-6 text-center">
                  <div className="text-sm text-rose-200">{runner.error}</div>
                  <Button size="sm" variant="secondary" icon="arrow-left" onClick={() => setStage('watch')}>
                    Back to the demo
                  </Button>
                </div>
              )}
            </div>

            {stage === 'position' ? (
              <Card radius="xl" pad="md" className="self-start">
                <div className="mb-3 text-sm font-semibold text-white">{clip.view === 'side' ? 'Stand side-on, whole body visible' : 'Face the camera, whole body visible'}</div>
                <SetupChecklist framing={runner.framing} orientation={def.orientation} />
                <p className="mt-3 text-xs leading-relaxed text-slate-400">Line yourself up with the glowing figure. Tracking starts on its own.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" icon="refresh" onClick={runner.switchCamera}>
                    Switch camera
                  </Button>
                  <Button size="sm" variant="ghost" icon="arrow-left" onClick={() => setStage('watch')}>
                    Back to the demo
                  </Button>
                </div>
              </Card>
            ) : (
              <Card radius="xl" pad="md" className="self-start">
                <MonoLabel tone="pulse">{t(tutorial.shadowCue)}</MonoLabel>
                <div className="mt-2 font-mono text-2xl font-bold text-white">
                  {isHold ? `${Math.floor(heldMs / 1000)}s / ${HOLD_TARGET_MS / 1000}s` : `${cleanStreak} / ${CLEAN_REPS_TARGET}`}
                </div>
                <div className="font-mono text-[11px] text-slate-400">{isHold ? 'held steady' : `clean reps in a row · ${reps} total`}</div>
                {!isHold && (
                  <div className="mt-3 flex gap-1.5">
                    {Array.from({ length: CLEAN_REPS_TARGET }, (_, i) => (
                      <span key={i} className={clsx('h-2 flex-1 rounded-full', i < cleanStreak ? 'bg-brand-400 shadow-[0_0_8px_rgba(0,229,153,0.5)]' : 'bg-ink-700')} />
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" icon="refresh" onClick={() => setStage('watch')}>
                    Watch again
                  </Button>
                  <Button size="sm" variant="secondary" onClick={finish}>
                    I'm done practising
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}

        {stage === 'done' && outcome && (
          <div className="mx-auto w-full max-w-2xl space-y-4">
            <Card radius="xl" pad="lg" brackets className="text-center">
              <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-brand-400/40 bg-brand-400/10 text-brand-400 shadow-glow-signal">
                <Icon name="check" size={26} strokeWidth={2.5} />
              </span>
              <div className="text-xl font-bold text-white">You've got the shape of it</div>
              <div className="mt-1 font-mono text-xs text-slate-400">
                {outcome.reps} rep{outcome.reps === 1 ? '' : 's'} practised · form score {outcome.formScore}
              </div>
            </Card>

            <Card radius="xl" pad="md">
              <div className="mb-3 text-sm font-semibold text-white">{Object.keys(outcome.flags).length ? 'Watch these next time' : 'Nothing to correct — that was clean'}</div>
              <ul className="space-y-2">
                {Object.keys(outcome.flags).length
                  ? Object.entries(outcome.flags)
                      .sort((a, b) => b[1] - a[1])
                      .map(([id, count]) => {
                        const m = tutorial.commonMistakes[id]
                        const rule = def.rules.find((r) => r.id === id)
                        return (
                          <li key={id} className="flex gap-2.5 text-sm text-slate-300">
                            <Icon name="alert" size={15} className="mt-0.5 shrink-0 text-flame" />
                            <span>
                              {m ? t(m) : rule ? t(rule.cue) : id}
                              <span className="font-mono text-slate-500"> · {count}×</span>
                            </span>
                          </li>
                        )
                      })
                  : tutorial.keyPoints.map((k, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-slate-300">
                        <Icon name="check" size={15} className="mt-0.5 shrink-0 text-brand-400" />
                        {t(k)}
                      </li>
                    ))}
              </ul>
            </Card>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                icon="refresh"
                onClick={() => {
                  finishedRef.current = false
                  setOutcome(null)
                  setStepIndex(0)
                  setStage('watch')
                }}
              >
                Practise again
              </Button>
              <Button variant="primary" block iconRight="arrow-right" onClick={() => nav('/exercises')}>
                Done
              </Button>
            </div>
          </div>
        )}
      </main>
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
    <div className="grid grid-cols-4 gap-2">
      {stages.map((s, i) => (
        <div key={s.id}>
          <div className={clsx('h-1 rounded-full transition-colors', i <= current ? 'bg-pulse' : 'bg-white/[0.08]', i === current && 'shadow-[0_0_10px_rgba(0,242,254,0.55)]')} />
          <div className={clsx('mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em]', i <= current ? 'text-pulse' : 'text-slate-600')}>
            0{i + 1} {s.label}
          </div>
        </div>
      ))}
    </div>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">{children}</div>
}
