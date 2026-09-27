import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { Logo } from '@/components/brand/Logo'
import { Backdrop } from '@/components/layout/Backdrop'
import { ButtonLink, Button, Icon, type IconName } from '@/components/ui'
import { useAuthStore } from '@/features/auth/authStore'
import { DemoFigure } from '@/features/tutorial/DemoFigure'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { getClip, sampleClipWorld } from '@/cv/demo/clips'
import { projectToPose } from '@/cv/demo/project'
import { getDefinition } from '@/cv/exercises'

const FEATURES: { fig: string; icon: IconName; title: string; body: ReactNode; tone: 'brand' | 'pulse' | 'volt' | 'iris' }[] = [
  {
    fig: 'FIG 0.1',
    icon: 'camera',
    title: 'Local vision rep counter',
    body: (
      <>
        Your phone camera counts reps and corrects your form — <span className="font-medium text-white">on-device, video never uploaded.</span>
      </>
    ),
    tone: 'brand',
  },
  {
    fig: 'FIG 0.2',
    icon: 'clock',
    title: 'Adaptive daily rhythm',
    body: (
      <>
        A <span className="font-medium text-white">10–30 minute plan</span> that adapts to what the camera saw yesterday.
      </>
    ),
    tone: 'pulse',
  },
  {
    fig: 'FIG 0.3',
    icon: 'trophy',
    title: 'Fraud-proof campus board',
    body: (
      <>
        Camera-verified minutes on squad and campus leaderboards <span className="font-medium text-white">nobody can fake</span>.
      </>
    ),
    tone: 'volt',
  },
  {
    fig: 'FIG 0.4',
    icon: 'apple',
    title: 'Fuel that fits your goal',
    body: (
      <>
        Daily calorie, protein and water targets from your goal and diet — <span className="font-medium text-white">veg, egg or non-veg</span>.
      </>
    ),
    tone: 'iris',
  },
]

const FEATURE_TONE = {
  brand: { box: 'border-brand-400/30 bg-brand-950/60 text-brand-400', hover: 'hover:border-brand-400/40' },
  pulse: { box: 'border-pulse/30 bg-sky-950/60 text-pulse', hover: 'hover:border-pulse/40' },
  volt: { box: 'border-volt/30 bg-lime-950/60 text-volt', hover: 'hover:border-volt/40' },
  iris: { box: 'border-iris-500/30 bg-indigo-950/60 text-iris-400', hover: 'hover:border-iris-500/40' },
}

export function WelcomePage() {
  const token = useAuthStore((s) => s.token)
  const install = useInstallPrompt()
  if (token) return <Navigate to="/home" replace />

  return (
    <div className="relative flex min-h-full flex-col">
      <Backdrop variant="tech" />
      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-[430px] flex-col border-x border-line/40 bg-ink-950/60 md:max-w-2xl lg:max-w-6xl lg:border-x-0 lg:bg-transparent">
        <header className="sticky top-0 z-50 flex items-center justify-between border-b border-line bg-ink-950/85 px-4 py-3 backdrop-blur-md lg:px-8" style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}>
          <Logo live />
          <div className="flex items-center gap-2 rounded-full border border-line bg-ink-900/90 px-2.5 py-1 font-mono text-[10px] text-slate-400">
            <span className="h-1.5 w-1.5 animate-pulse-slow rounded-full bg-brand-400" />
            <span className="font-medium text-slate-300">ON-DEVICE</span>
            <span className="text-slate-600">|</span>
            <span className="text-pulse">OFFLINE-READY</span>
          </div>
        </header>

        <main className="welcome-grid flex-1 px-4 pb-8 pt-6 lg:px-8 lg:pt-14">
          <section className="space-y-3 pt-1" style={{ gridArea: 'hero' }}>
            <div className="inline-flex items-center gap-1.5 rounded-md border border-brand-400/30 bg-brand-950/40 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-400">
              <Icon name="activity" size={12} strokeWidth={2.5} />
              Camera-first recognition
            </div>
            <h1 className="text-3xl font-extrabold leading-[1.18] tracking-tight text-white sm:text-4xl lg:text-6xl lg:leading-[1.05]">
              A coach that <span className="bg-gradient-to-r from-brand-400 via-emerald-400 to-pulse bg-clip-text text-transparent">sees</span> you.
              <br />A campus that notices.
            </h1>
            <p className="max-w-sm text-sm leading-relaxed text-slate-400 lg:max-w-md lg:text-base">
              Privacy-native computer vision designed for college hustlers. No wearables, no gym fees, zero footage leaks.
            </p>
          </section>

          <PoseHud />

          <section className="space-y-3" style={{ gridArea: 'features' }} aria-label="How it works">
            <div className="flex items-center justify-between px-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">// System architecture</span>
              <span className="font-mono text-[10px] text-slate-500">ON-DEVICE KINEMATICS</span>
            </div>
            {FEATURES.map((f) => (
              <div key={f.fig} className={clsx('rounded-xl border border-line bg-ink-850 p-4 transition-colors duration-200', FEATURE_TONE[f.tone].hover)}>
                <div className="flex items-start gap-3">
                  <span className={clsx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', FEATURE_TONE[f.tone].box)}>
                    <Icon name={f.icon} />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-white">{f.title}</h2>
                      <span className="shrink-0 rounded bg-ink-700 px-1.5 py-0.5 font-mono text-[9px] text-slate-300">{f.fig}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-300">{f.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section className="rounded-xl border border-line bg-ink-800/70 p-3.5 font-mono" style={{ gridArea: 'board' }} aria-label="Example campus leaderboard">
            <div className="flex items-center justify-between border-b border-line pb-2 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-volt" />
                HOSTEL CLUSTER LEADERBOARD
              </span>
              <span className="text-[10px] text-slate-500">EXAMPLE</span>
            </div>
            <div className="space-y-2 pt-2.5 text-xs">
              <BoardRow rank="01" name="Hostel 4 // Delta Squad" meta="1,420 verified min" score="Form 92" lead />
              <BoardRow rank="02" name="Tech Block B // NightOwls" meta="1,180 verified min" score="Form 89" />
            </div>
            <p className="mt-2.5 text-[10px] leading-relaxed text-slate-500">Only camera-counted minutes rank. Manual taps never do.</p>
          </section>

          <section className="space-y-3 pt-2" style={{ gridArea: 'cta' }}>
            <ButtonLink to="/register" variant="signal" size="xl" block iconRight="arrow-right">
              Get started
            </ButtonLink>
            <ButtonLink to="/login" variant="secondary" size="lg" block>
              I have an account
            </ButtonLink>
            {install.canInstall && (
              <Button variant="ghost" block icon="smartphone" onClick={install.install}>
                Install the app
              </Button>
            )}
            <p className="flex items-center justify-center gap-1.5 pt-2 text-center font-mono text-[11px] text-slate-400">
              <Icon name="shield-check" size={14} className="shrink-0 text-brand-400" />
              No equipment. No gym. Works offline in the hostel.
            </p>
          </section>
        </main>

        <footer className="mt-auto flex items-center justify-between border-t border-line/60 bg-ink-900/60 px-4 py-3.5 font-mono text-[10px] text-slate-500 backdrop-blur lg:px-8" style={{ paddingBottom: 'calc(var(--safe-bottom) + 14px)' }}>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            ENGINE: POSE_ON_DEVICE
          </div>
          <span>HOSTEL_READY // {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  )
}

function BoardRow({ rank, name, meta, score, lead }: { rank: string; name: string; meta: string; score: string; lead?: boolean }) {
  return (
    <div className={clsx('flex items-center justify-between rounded-lg border p-2', lead ? 'border-line bg-ink-850/90' : 'border-line/60 bg-ink-850/50 opacity-80')}>
      <div className="flex items-center gap-2.5">
        <span className={clsx('flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold', lead ? 'bg-volt text-ink-950' : 'bg-slate-800 text-slate-300')}>{rank}</span>
        <div>
          <span className={clsx('block font-sans text-xs', lead ? 'font-semibold text-white' : 'font-medium text-slate-200')}>{name}</span>
          <span className="text-[10px] text-slate-400">{meta}</span>
        </div>
      </div>
      <span className={clsx('text-[11px] font-bold', lead ? 'text-brand-400' : 'text-pulse')}>{score}</span>
    </div>
  )
}

/**
 * The hero telemetry panel, running the real thing: the tutorial's squat demo figure, with its
 * knee angle measured by the same `features()` the live analyzer uses on a camera frame.
 */
function PoseHud() {
  const clip = getClip('squat')
  const def = getDefinition('squat')
  const [t, setT] = useState(0)

  useEffect(() => {
    const start = performance.now()
    const id = window.setInterval(() => setT(performance.now() - start), 120)
    return () => window.clearInterval(id)
  }, [])

  const reading = useMemo(() => {
    if (!clip || !def) return null
    const u = (t % clip.loopMs) / clip.loopMs
    const f = def.features(projectToPose(sampleClipWorld(clip, u), clip.view)) as Record<string, number>
    return { reps: Math.floor(t / clip.loopMs), knee: Math.round(f.kneeAngle ?? 0), cadence: clip.loopMs / 1000 }
  }, [t, clip, def])

  const deep = reading ? reading.knee <= 97 : false

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-line bg-ink-850 p-3.5 shadow-2xl"
      style={{ gridArea: 'hud' }}
      aria-label="Live demo of on-device pose tracking"
    >
      <div className="flex items-center justify-between border-b border-line/70 pb-3 font-mono text-[11px]">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-ping rounded-full bg-pulse" />
          <span className="font-semibold tracking-wide text-slate-300">POSE_STREAM // DEMO</span>
        </div>
        <span className="rounded border border-brand-400/20 bg-brand-400/10 px-2 py-0.5 text-[10px] text-brand-400">ON-DEVICE • PRIVATE</span>
      </div>

      <div className="relative my-3 h-56 overflow-hidden rounded-xl border border-slate-800/80 bg-ink-950/90 lg:h-72">
        <div className="absolute inset-0 bg-dot-signal opacity-40" />
        <div className="pointer-events-none absolute inset-x-0 h-16 animate-scanline bg-gradient-to-b from-transparent via-brand-400/10 to-transparent" />
        <svg className="pointer-events-none absolute inset-0 h-full w-full p-4" viewBox="0 0 320 180" fill="none" aria-hidden>
          <path d="M 20,90 Q 70,20 140,85 T 260,80 T 300,100" opacity="0.4" stroke="#00f2fe" strokeDasharray="3 3" strokeWidth="1.5" />
          <path d="M 20,110 Q 90,160 160,95 T 300,60" opacity="0.7" stroke="#00e599" strokeWidth="1.8" />
        </svg>
        {clip && (
          <div className="absolute inset-0">
            <DemoFigure clip={clip} wire />
          </div>
        )}
        <span className="pointer-events-none absolute left-2 top-2 font-mono text-[9px] text-slate-600">┏ [DEMO_FEED]</span>
        <span className="pointer-events-none absolute right-2 top-2 font-mono text-[9px] text-pulse">SQUAT // SIDE ┓</span>
        <span className="pointer-events-none absolute bottom-2 left-2 font-mono text-[9px] text-slate-600">┗ VIDEO SENT: 0 B</span>
        <span className="pointer-events-none absolute bottom-2 right-2 font-mono text-[9px] text-brand-400">REP_COUNT: {reading?.reps ?? 0} ┛</span>
        {reading && (
          <div className="pointer-events-none absolute bottom-7 left-3 flex items-center gap-2 rounded-lg border border-line bg-ink-850/90 px-2.5 py-1.5 backdrop-blur">
            <span className={clsx('h-2 w-2 rounded-full', deep ? 'bg-brand-400' : 'animate-pulse bg-pulse')} />
            <div className="font-mono text-[10px] leading-tight">
              <span className="text-slate-400">KNEE ANGLE</span>
              <span className="block font-bold text-white">
                {reading.knee}° {deep ? 'DEPTH OK' : 'TRACKING'}
              </span>
            </div>
          </div>
        )}
        <span className="pointer-events-none absolute right-3 top-8 font-mono text-[9px] text-slate-500">drag to rotate</span>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-line/60 pt-2 text-center font-mono">
        <HudMetric label="Rep cadence" value={reading ? `${reading.cadence.toFixed(1)}s / rep` : '—'} />
        <HudMetric label="Video uploaded" value="0 bytes" tone="text-brand-400" />
        <HudMetric label="Privacy model" value="100% on-device" tone="text-pulse" />
      </div>
    </section>
  )
}

function HudMetric({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded border border-line/60 bg-ink-800 p-1.5">
      <div className="text-[9px] uppercase text-slate-500">{label}</div>
      <div className={clsx('text-xs font-bold tracking-tight', tone)}>{value}</div>
    </div>
  )
}
