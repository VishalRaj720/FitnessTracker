import { useEffect, useRef, useState } from 'react'
import { Button, Card, Chip, PageTitle } from '@/components/ui'
import { PoseWorkerClient } from '@/cv/pose/PoseWorkerClient'
import { MainThreadPoseEngine } from '@/cv/pose/MainThreadPoseEngine'
import type { PoseEngine } from '@/cv/pose/PoseEngine'
import { PoseRenderer } from '@/cv/render/PoseRenderer'
import { PerformanceGovernor, TIER_PROFILES, probeDevice, type Tier } from '@/cv/perf/PerformanceGovernor'
import { CameraSource, type FrameSource } from '@/cv/sources/FrameSource'
import { SyntheticSource } from '@/features/dev/SyntheticSource'
import { env } from '@/lib/env'

/**
 * Developer tool (/dev/pipeline): boots the real pose pipeline and reports what it got.
 *
 * Exists because the interesting properties of Phase 1 are invisible in the UI — whether
 * inference actually landed in a worker, whether the GPU delegate came up there, and
 * whether the overlay's render rate is genuinely decoupled from the inference rate. The
 * synthetic source lets all of that be checked without camera permission (and in CI).
 * Not linked from the app UI.
 */
export function PipelineDiagnosticsPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [source, setSource] = useState<'synthetic' | 'camera'>('synthetic')
  const [status, setStatus] = useState('booting…')
  const [info, setInfo] = useState({ engine: '—', delegate: '—', tier: 'medium' as Tier })
  const [live, setLive] = useState({ renderFps: 0, cvFps: 0, inferenceMs: 0, detections: 0 })

  useEffect(() => {
    let cancelled = false
    let engine: PoseEngine | null = null
    let renderer: PoseRenderer | null = null
    let src: FrameSource | null = null
    let raf = 0
    let timer = 0
    let lastSubmit = 0
    let minInterval = 1000 / TIER_PROFILES.medium.targetHz
    const fps = { frames: 0, t: performance.now(), detections: 0 }

    const boot = async () => {
      try {
        const probe = probeDevice()
        const profile = TIER_PROFILES[probe.initial]
        minInterval = 1000 / profile.targetHz

        setStatus('starting source…')
        src = source === 'camera' ? new CameraSource(videoRef.current!, 'user', profile.capture) : new SyntheticSource(videoRef.current!)
        await src.start()
        if (cancelled) return

        setStatus('loading model…')
        const modelPath = profile.model === 'full' ? env.modelFull : env.modelLite
        try {
          engine = await PoseWorkerClient.create({ modelPath, delegate: 'GPU' })
        } catch (e) {
          console.warn('[cv] pose worker unavailable, falling back to main thread', e)
          engine = await MainThreadPoseEngine.create({ wasmPath: env.wasmPath, modelPath, delegate: 'GPU' })
        }
        if (cancelled) {
          engine.dispose()
          return
        }
        engine.setInputWidth(profile.inputWidth)
        setInfo({ engine: engine.kind, delegate: engine.delegate, tier: probe.initial })

        const governor = new PerformanceGovernor({
          initial: probe.initial,
          maxTier: probe.maxTier,
          onChange: (tier, p, reason) => {
            console.info('[cv] tier -> ' + tier + ' (' + reason + ')')
            minInterval = 1000 / p.targetHz
            renderer?.setDetail(p.detail)
            engine?.setInputWidth(p.inputWidth)
            engine?.setModel(p.model === 'full' ? env.modelFull : env.modelLite)
            setInfo((i) => ({ ...i, tier }))
          },
        })

        renderer = new PoseRenderer(canvasRef.current!, {
          videoSize: () => ({ width: videoRef.current?.videoWidth ?? 0, height: videoRef.current?.videoHeight ?? 0 }),
          detail: profile.detail,
        })
        renderer.start()

        engine.onPose = ({ pose, ts, inferenceMs }) => {
          if (cancelled) return
          renderer?.push(pose, ts)
          governor.sample(inferenceMs, ts)
          fps.frames += 1
          if (pose) fps.detections += 1
          const now = performance.now()
          if (now - fps.t >= 1000) {
            setLive({
              renderFps: renderer?.renderFps ?? 0,
              cvFps: Math.round((fps.frames * 1000) / (now - fps.t)),
              inferenceMs: Math.round(inferenceMs),
              detections: fps.detections,
            })
            fps.frames = 0
            fps.t = now
          }
        }

        setStatus('running')
        const tick = () => {
          if (cancelled) return
          const v = videoRef.current
          if (v && engine && !engine.busy) {
            const now = performance.now()
            if (now - lastSubmit >= minInterval) {
              lastSubmit = now
              engine.submit(v, now)
            }
          }
          schedule()
        }
        // The real runner drives capture from rAF/requestVideoFrameCallback. Browsers freeze
        // rAF entirely while the document is hidden, which is right for a workout but leaves
        // this tool measuring nothing in a background tab or an embedded pane — so fall back
        // to a timer there. Render fps still reads 0 when hidden, because the renderer
        // deliberately stays on rAF.
        const schedule = () => {
          if (document.visibilityState === 'hidden') timer = window.setTimeout(tick, 8)
          else raf = requestAnimationFrame(tick)
        }
        schedule()
      } catch (e) {
        if (!cancelled) setStatus('failed: ' + (e as Error).message)
      }
    }

    boot()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      renderer?.dispose()
      engine?.dispose()
      src?.stop()
    }
  }, [source])

  const decoupled = live.renderFps > live.cvFps + 5

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <PageTitle title="Pipeline diagnostics" subtitle="dev tool · verifies the worker, the governor and the decoupled render loop" />

      <div className="flex gap-2">
        <Chip active={source === 'synthetic'} onClick={() => setSource('synthetic')}>
          Synthetic
        </Chip>
        <Chip active={source === 'camera'} onClick={() => setSource('camera')}>
          Camera
        </Chip>
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-ink-950">
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>

      <Card pad="sm" radius="xl" className="space-y-2 text-sm">
        <Row label="status" value={status} />
        <Row label="engine" value={info.engine === 'worker' ? 'Web Worker (off main thread)' : info.engine === 'main' ? 'main thread (fallback)' : '—'} />
        <Row label="delegate" value={info.delegate} />
        <Row label="tier" value={info.tier} />
        <Row label="render fps" value={live.renderFps ? String(live.renderFps) : '0 (rAF frozen — document hidden)'} />
        <Row label="inference fps" value={String(live.cvFps)} />
        <Row label="inference ms" value={String(live.inferenceMs)} />
        <Row label="frames with a pose" value={String(live.detections)} />
        <Row
          label="decoupled?"
          value={decoupled ? 'yes — render is outrunning inference' : 'not yet (render fps must exceed inference fps)'}
        />
      </Card>

      <Button variant="secondary" onClick={() => setSource((s) => (s === 'camera' ? 'synthetic' : 'camera'))}>
        Restart with the other source
      </Button>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono text-slate-100">{value}</span>
    </div>
  )
}
