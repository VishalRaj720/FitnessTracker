import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/authStore'

export function RequireAuth() {
  const token = useAuthStore((s) => s.token)
  const loc = useLocation()
  if (!token) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return <Outlet />
}

export function RequireOnboarded() {
  const user = useAuthStore((s) => s.user)
  if (user && !user.onboarding_completed) return <Navigate to="/onboarding" replace />
  return <Outlet />
}
