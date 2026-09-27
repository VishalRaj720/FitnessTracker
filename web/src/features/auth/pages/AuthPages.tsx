import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Field, Icon, Input } from '@/components/ui'
import { Backdrop } from '@/components/layout/Backdrop'
import { FlowHeader } from '@/components/layout/FlowHeader'
import { useLogin, useRegister } from '@/features/auth/api'
import { errorMessage } from '@/lib/apiClient'

export { WelcomePage } from '@/features/auth/pages/WelcomePage'

/** Shared frame for sign-in and sign-up: the campus step's command card on the welcome grid. */
function AuthFrame({
  process,
  status,
  title,
  subtitle,
  children,
  footer,
}: {
  process: string
  status: string
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="relative flex min-h-full flex-col">
      <Backdrop variant="tech" />
      <FlowHeader
        logoTo="/"
        width="max-w-5xl"
        right={
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-white">
            <Icon name="arrow-left" size={14} /> Back
          </Link>
        }
      />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:py-16">
        <div className="mb-8 space-y-3 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-brand-400/30 bg-brand-950/40 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-400">
            <Icon name="shield-check" size={12} /> Secure session
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{title}</h1>
          <p className="text-sm leading-relaxed text-slate-400">{subtitle}</p>
        </div>
        <section className="overflow-hidden rounded-xl border border-white/10 bg-ink-900/90 shadow-[0_8px_32px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-line bg-ink-850/60 px-5 py-3 font-mono text-[11px] text-slate-400">
            <span className="font-medium tracking-wider text-slate-300">{process}</span>
            <span className="text-brand-400">{status}</span>
          </div>
          <div className="p-6 sm:p-7">{children}</div>
        </section>
        <div className="mt-6 text-center text-sm text-slate-400">{footer}</div>
      </main>
    </div>
  )
}

export function LoginPage() {
  const nav = useNavigate()
  const loc = useLocation()
  const login = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const from = (loc.state as { from?: string } | null)?.from

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const d = await login.mutateAsync({ email, password })
    nav(d.user.onboarding_completed ? (from && from !== '/login' ? from : '/home') : '/onboarding', { replace: true })
  }

  return (
    <AuthFrame
      process="AUTH.SESSION // SIGN_IN"
      status="BEARER · JWT"
      title="Welcome back"
      subtitle="Pick up your streak where you left it."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-semibold text-brand-400 transition hover:text-white">
            Create an account
          </Link>
          <p className="mt-6 font-mono text-[11px] text-slate-600">Demo: demo@fitsathi.app / demo12345</p>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label="Email">
          {(id) => <Input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@college.edu" />}
        </Field>
        <Field label="Password">
          {(id) => <Input id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />}
        </Field>
        {login.isError && <Alert>{errorMessage(login.error)}</Alert>}
        <Button type="submit" variant="signal" size="lg" block loading={login.isPending} iconRight="arrow-right">
          Log in
        </Button>
      </form>
    </AuthFrame>
  )
}

export function RegisterPage() {
  const nav = useNavigate()
  const register = useRegister()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    await register.mutateAsync({ name, email, password })
    nav('/onboarding', { replace: true })
  }

  return (
    <AuthFrame
      process="AUTH.SESSION // NEW_ATHLETE"
      status="STEP 0 OF 3"
      title="Create your account"
      subtitle="Thirty seconds here, then three quick steps to build your first plan."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-400 transition hover:text-white">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label="Name" hint="What should the coach call you?">
          {(id) => <Input id={id} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="Asha" />}
        </Field>
        <Field label="Email">
          {(id) => <Input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@college.edu" />}
        </Field>
        <Field label="Password" meta={<span className={password.length >= 8 ? 'font-mono text-[10px] text-brand-400' : 'font-mono text-[10px] text-slate-500'}>{password.length >= 8 ? '✓ LONG ENOUGH' : 'MIN 8 CHARS'}</span>}>
          {(id) => (
            <Input id={id} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" />
          )}
        </Field>
        {register.isError && <Alert>{errorMessage(register.error)}</Alert>}
        <Button type="submit" variant="signal" size="lg" block loading={register.isPending} iconRight="arrow-right">
          Continue
        </Button>
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
          <Icon name="lock" size={13} className="mt-0.5 shrink-0" />
          Your camera never uploads video. Only reps, timings and scores are stored with your account.
        </p>
      </form>
    </AuthFrame>
  )
}
