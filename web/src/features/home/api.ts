import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { get, set } from 'idb-keyval'
import { api, NetworkError } from '@/lib/apiClient'
import type { Plan, ProgressSummary, Squad } from '@/types/api'

const PLAN_CACHE = 'fitsathi.plan.today'

/** Today's plan; served from IndexedDB when offline so a workout can still start. */
export function useTodayPlan() {
  return useQuery({
    queryKey: ['plan', 'today'],
    queryFn: async () => {
      try {
        const plan = await api<Plan>('/plans/today')
        set(PLAN_CACHE, plan).catch(() => {})
        return plan
      } catch (e) {
        if (e instanceof NetworkError) {
          const cached = await get<Plan>(PLAN_CACHE).catch(() => undefined)
          if (cached) return { ...cached, __offline: true } as Plan & { __offline?: boolean }
        }
        throw e
      }
    },
    staleTime: 60_000,
  })
}

export function useRegeneratePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<Plan>('/plans/today/regenerate', { method: 'POST' }),
    onSuccess: (plan) => qc.setQueryData(['plan', 'today'], plan),
  })
}

export function useProgress() {
  return useQuery({ queryKey: ['progress', 'summary'], queryFn: () => api<ProgressSummary>('/progress/summary'), staleTime: 30_000 })
}

export function useMySquad() {
  return useQuery({ queryKey: ['squad', 'mine'], queryFn: () => api<Squad | null>('/squads/mine'), staleTime: 60_000 })
}
