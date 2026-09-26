import { useEffect, useRef, useState } from 'react'
import { DrawingUtils } from '@mediapipe/tasks-vision'
import { Button, Card, Chip, PageTitle } from '@/components/ui'
import { PoseDetector, POSE_CONNECTIONS } from '@/cv/pose/PoseDetector'
import { CameraSource } from '@/cv/sources/FrameSource'
import { ExerciseAnalyzer } from '@/cv/engine/ExerciseAnalyzer'
import { EXERCISE_DEFINITIONS } from '@/cv/exercises'
import { toIsotropic, type Pose } from '@/cv/pose/landmarks'
import { env } from '@/lib/env'

/**
 * Developer tool (/dev/record): records landmark sequences to JSON so the CV engine can be
 * unit-tested deterministically without a camera. Also shows the live analyzer so thresholds
 * can be calibrated on real people. Not linked from the app UI.
 *
 * Fixture format: { exercise, expectedReps, fps, aspect, frames: [{ t: ms, pose: [{x,y,z,visibility} x33] }] }
 * Poses are stored raw (MediaPipe-normalized); `aspect` is the frame's width / height, which
 * replay needs to measure them the way the live runner does.
 */
export function RecordFixturePage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [slug, setSlug] = useState('squat')
  const [status, setStatus] = useState('starting camera…')
  const [recording, setRecording] = useState(false)
  const [frameCount, setFrameCount] = useState(0)
  const [snap, setSnap] = useState({ reps: 0, partials: 0, phase: 'TOP', score: 100, heldMs: 0, features: '' })
  const framesRef = useRef<{ t: number; pose: Pose }[]>([])
  const aspectRef = useRef(1)
  const recordingRef = useRef(false)
  const analyzerRef = useRef<ExerciseAnalyzer | null>(null)
  const slugRef = useRef(slug)
  slugRef.current = slug

  useEffect(() => {
    analyzerRef.current = new ExerciseAnalyzer(EXERCISE_DEFINITIONS[slug])
  }, [slug])

  useEffect(() => {
    let cancelled = false
    let det: PoseDetector | null = null
    let src: CameraSource | null = null
    const t0 = performance.now()
    ;(async () => {
      try {
        src = new CameraSource(videoRef.current!, 'user')
        await src.start()
        det = await PoseDetector.create({ wasmPath: env.wasmPath, modelPath: env.modelLite })
        setStatus('ready')
        const loop = () => {
          if (cancelled || !det || !videoRef.current) return
          const now = performance.now()
          const pose = det.detect(videoRef.current, now)
          if (pose !== undefined) {
            const canvas = canvasRef.current!
            const v = videoRef.current
            if (canvas.width !== v.videoWidth) {
              canvas.width = v.videoWidth
              canvas.height = v.videoHeight
            }
            aspectRef.current = v.videoHeight ? v.videoWidth / v.videoHeight : 1
            const ctx = canvas.getContext('2d')!
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            if (pose) {
              const du = new DrawingUtils(ctx)
              du.drawConnectors(pose, POSE_CONNECTIONS, { color: '#34d399', lineWidth: 3 })
              du.drawLandmarks(pose, { color: '#fff', fillColor: '#34d399', radius: 3 })
            }
            if (recordingRef.current && pose) framesRef.current.push({ t: Math.round(now - t0), pose: pose.map((l) => ({ x: +l.x.toFixed(4), y: +l.y.toFixed(4), z: +l.z.toFixed(4), visibility: +l.visibility.toFixed(3) })) })
            const an = analyzerRef.current
            if (an) {
              an.setElapsed(now - t0)
              an.update(pose && toIsotropic(pose, aspectRef.current), now)
              const s = an.snapshot()
              const f = an.features
              setSnap({ reps: s.reps, partials: s.partials, phase: s.phase, score: s.formScore, heldMs: s.heldMs, features: Object.entries(f).map(([k, v]) => `${k}=${v.toFixed(1)}`).join('  ') })
              if (recordingRef.current) setFrameCount(framesRef.current.length)
            }
          }
          requestAnimationFrame(loop)
        }
        loop()
      } catch (e) {
        setStatus((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
      det?.dispose()
      src?.stop()
    }
  }, [])

  const toggle = () => {
    if (!recordingRef.current) {
      framesRef.current = []
      setFrameCount(0)
      analyzerRef.current = new ExerciseAnalyzer(EXERCISE_DEFINITIONS[slugRef.current])
    }
    recordingRef.current = !recordingRef.current
    setRecording(recordingRef.current)
  }

  const download = () => {
    const expected = Number(prompt('How many real reps did you do?', String(snap.reps)) ?? snap.reps)
    const frames = framesRef.current
    const fps = frames.length > 1 ? Math.round((1000 * frames.length) / (frames[frames.length - 1].t - frames[0].t)) : 0
    const blob = new Blob([JSON.stringify({ exercise: slug, expectedReps: expected, fps, aspect: aspectRef.current, recordedAt: new Date().toISOString(), frames })], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${slug}_${expected}reps_${Date.now()}.json`
    a.click()
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      <PageTitle title="Fixture recorder" subtitle={`dev tool · ${status}`} />
      <div className="relative mb-3 aspect-video overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} className="absolute inset-0 h-full w-full scale-x-[-1] object-cover" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full scale-x-[-1] object-cover" />
        <div className="absolute left-2 top-2 rounded-md bg-slate-950/70 px-2 py-1 font-mono text-xs">
          reps {snap.reps} · partials {snap.partials} · {snap.phase} · form {snap.score} · hold {(snap.heldMs / 1000).toFixed(1)}s
        </div>
        <div className="absolute bottom-2 left-2 rounded-md bg-slate-950/70 px-2 py-1 font-mono text-[10px] text-slate-300">{snap.features}</div>
      </div>
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
        {Object.keys(EXERCISE_DEFINITIONS).map((s) => (
          <Chip key={s} active={slug === s} onClick={() => setSlug(s)}>
            {s}
          </Chip>
        ))}
      </div>
      <Card className="flex items-center gap-3">
        <Button onClick={toggle} variant={recording ? 'danger' : 'primary'}>
          {recording ? `Stop (${frameCount} frames)` : 'Record'}
        </Button>
        <Button variant="secondary" onClick={download} disabled={recording || frameCount === 0}>
          Download JSON
        </Button>
        <div className="text-xs text-slate-400">Drop files into web/tests/fixtures/ — the fixture test asserts the rep count.</div>
      </Card>
    </div>
  )
}
