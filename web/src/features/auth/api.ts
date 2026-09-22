import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'
import { useAuthStore } from '@/features/auth/authStore'
import type { TokenOut, User } from '@/types/api'

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({
    mutationFn: (body: { email: string; password: string; name: string }) => api<TokenOut>('/auth/register', { method: 'POST', body, auth: false }),
    onSuccess: (d) => setSession(d.access_token, d.user),
  })
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({
    mutationFn: (body: { email: string; password: string }) => api<TokenOut>('/auth/login', { method: 'POST', body, auth: false }),
    onSuccess: (d) => setSession(d.access_token, d.user),
  })
}

/** Refreshes the cached user (stats, profile) from the server. */
export function useMe() {
  const token = useAuthStore((s) => s.token)
  const setUser = useAuthStore((s) => s.setUser)
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const u = await api<User>('/users/me')
      setUser(u)
      return u
    },
    enabled: !!token,
    staleTime: 30_000,
  })
}
