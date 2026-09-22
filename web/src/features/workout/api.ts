import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'
import type { SessionList, SessionOut } from '@/types/api'

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: ['sessions', id],
    queryFn: () => api<SessionOut>(`/sessions/${id}`),
    enabled: !!id && id !== 'local',
  })
}

export function useRecentSessions(limit = 10) {
  return useQuery({
    queryKey: ['sessions', 'list', limit],
    queryFn: () => api<SessionList>(`/sessions?limit=${limit}`),
  })
}

export function useSetRpe(id: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rpe: number) => api<SessionOut>(`/sessions/${id}`, { method: 'PATCH', body: { rpe } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      qc.invalidateQueries({ queryKey: ['plan'] })
    },
  })
}
