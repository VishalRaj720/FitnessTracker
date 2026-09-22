import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'
import type { Leaderboard, Squad } from '@/types/api'

export function useLeaderboard(squadId: string | undefined, week?: string) {
  return useQuery({
    queryKey: ['squad', 'leaderboard', squadId, week ?? 'current'],
    queryFn: () => api<Leaderboard>(`/squads/${squadId}/leaderboard${week ? `?week=${week}` : ''}`),
    enabled: !!squadId,
    staleTime: 30_000,
  })
}

export function useCreateSquad() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api<Squad>('/squads', { method: 'POST', body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['squad'] }),
  })
}

export function useJoinSquad() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (invite_code: string) => api<Squad>('/squads/join', { method: 'POST', body: { invite_code } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['squad'] }),
  })
}

export function useLeaveSquad() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>('/squads/leave', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['squad'] }),
  })
}
