import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'
import type { Exercise } from '@/types/api'

export function useExercises() {
  return useQuery({ queryKey: ['exercises'], queryFn: () => api<Exercise[]>('/exercises'), staleTime: 10 * 60_000 })
}
