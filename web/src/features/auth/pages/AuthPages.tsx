import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Input, Label } from '@/components/ui'
import { useAuthStore } from '@/features/auth/authStore'
import { useLogin, useRegister } from '@/features/auth/api'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { errorMessage } from '@/lib/apiClient'

function Logo() {
  return (
    <div className="mb-6 flex items-center gap-2">
      <img src="/icons/icon.svg" alt="" className="h-9 w-9 rounded-lg" />
      <div className="text-2xl font-black tracking-tight">FitSathi</div>
    </div>
  )
}

export function WelcomePage() {
  const token = useAuthStore((s) => s.token)
  const install = useInstallPrompt()
  if (token) return <Navigate to="/home" replace />
  return (
    <div className="mx-auto flex h-full max-w-md flex-col px-6 pb-8 pt-[calc(var(--safe-top)+40px)]">
      <Logo />
      <h1 className="text-3xl font-black leading-tight">
        A coach that <span className="text-brand-400">sees</span> you.
        <br />A campus that notices.
      </h1>
      <ul className="mt-6 space-y-3 text-slate-300">
        <li className="flex gap-3">
          <span className="text-brand-400">●</span> Your phone camera counts reps and corrects your form — on-device, video never uploaded.
        </li>
        <li className="flex gap-3">
          <span className="text-brand-400">●</span> A 10–30 minute plan that adapts to what the camera saw yesterday.
        </li>
        <li className="flex gap-3">
          <span className="text-brand-400">●</span> Camera-verified minutes on squad and campus leaderboards nobody can fake.
        </li>
      </ul>
      <div className="mt-auto space-y-2 pt-8">
        <Link to="/register">
          <Button size="lg" className="w-full">
            Get started
          </Button>
        </Link>
        <Link to="/login">
          <Button size="lg" variant="secondary" className="w-full">
            I have an account
          </Button>
        </Link>
        {install.canInstall && (
          <Button variant="ghost" className="w-full" onClick={install.install}>
            Install app
          </Button>
        )}
        <div className="pt-2 text-center text-xs text-slate-500">No equipment. No gym. Works offline in the hostel.</div>
      </div>
    </div>
  )
}

export function LoginPage() {
  const nav = useNavigate()
  const login = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const d = await login.mutateAsync({ email, password })
    nav(d.user.onboarding_completed ? '/home' : '/onboarding', { replace: true })
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col px-6 pt-[calc(var(--safe-top)+40px)]">
      <Logo />
      <h1 className="mb-4 text-2xl font-bold">Welcome back</h1>
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {login.isError && <Alert>{errorMessage(login.error)}</Alert>}
          <Button type="submit" className="w-full" size="lg" loading={login.isPending}>
            Log in
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-slate-400">
        New here?{' '}
        <Link to="/register" className="font-semibold text-brand-400">
          Create an account
        </Link>
      </p>
      <p className="mt-6 text-center text-xs text-slate-600">Demo: demo@fitsathi.app / demo12345</p>
    </div>
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
    <div className="mx-auto flex h-full max-w-md flex-col px-6 pt-[calc(var(--safe-top)+40px)]">
      <Logo />
      <h1 className="mb-4 text-2xl font-bold">Create your account</h1>
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="What should the coach call you?" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" />
          </div>
          {register.isError && <Alert>{errorMessage(register.error)}</Alert>}
          <Button type="submit" className="w-full" size="lg" loading={register.isPending}>
            Continue
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-slate-400">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-400">
          Log in
        </Link>
      </p>
    </div>
  )
}
