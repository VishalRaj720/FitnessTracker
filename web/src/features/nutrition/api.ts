import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiRequestError } from '@/lib/apiClient'
import type {
  DailyNutrition,
  Food,
  FoodLogEntry,
  FoodLogIn,
  Meal,
  NutritionHistory,
  NutritionPlan,
  NutritionProfile,
  NutritionProfileIn,
  NutritionTargets,
  WaterOut,
} from '@/types/api'

/** Every nutrition query lives under this key so one invalidation refreshes the page. */
const ROOT = 'nutrition'

export function useNutritionProfile() {
  return useQuery({
    queryKey: [ROOT, 'profile'],
    queryFn: () => api<NutritionProfile | null>('/nutrition/profile'),
    staleTime: 5 * 60_000,
  })
}

export function useSaveNutritionProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: NutritionProfileIn) => api<NutritionProfile>('/nutrition/profile', { method: 'PUT', body }),
    onSuccess: (profile) => {
      qc.setQueryData([ROOT, 'profile'], profile)
      void qc.invalidateQueries({ queryKey: [ROOT] })
    },
  })
}

/** Targets for metrics still being typed; `null` input disables the query. */
export function useNutritionPreview(body: NutritionProfileIn | null) {
  return useQuery({
    queryKey: [ROOT, 'preview', body],
    queryFn: () => api<NutritionTargets>('/nutrition/preview', { method: 'POST', body }),
    enabled: body !== null,
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}

export function useNutritionPlan(enabled = true) {
  return useQuery({
    queryKey: [ROOT, 'plan'],
    queryFn: () => api<NutritionPlan>('/nutrition/plan'),
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function isProfileMissing(e: unknown): boolean {
  return e instanceof ApiRequestError && e.code === 'nutrition_profile_required'
}

/** One day's intake. `date` undefined means "today" as the server (IST) sees it. */
export function useNutritionDay(date?: string) {
  return useQuery({
    queryKey: [ROOT, 'day', date ?? 'today'],
    queryFn: () => api<DailyNutrition>(`/nutrition/day${date ? `?date=${date}` : ''}`),
    staleTime: 30_000,
  })
}

export function useNutritionHistory(days = 7) {
  return useQuery({
    queryKey: [ROOT, 'history', days],
    queryFn: () => api<NutritionHistory>(`/nutrition/history?days=${days}`),
    staleTime: 60_000,
  })
}

export function useFoods(q: string, compatible = true) {
  return useQuery({
    queryKey: [ROOT, 'foods', q.trim().toLowerCase(), compatible],
    queryFn: () => api<Food[]>(`/nutrition/foods?compatible=${compatible}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`),
    staleTime: 10 * 60_000,
    placeholderData: (prev) => prev,
  })
}

function useRefreshIntake() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: [ROOT, 'day'] })
    void qc.invalidateQueries({ queryKey: [ROOT, 'history'] })
  }
}

export function useLogFood() {
  const refresh = useRefreshIntake()
  return useMutation({
    mutationFn: (body: FoodLogIn) => api<FoodLogEntry>('/nutrition/logs', { method: 'POST', body }),
    onSuccess: refresh,
  })
}

export function useLogMeal() {
  const refresh = useRefreshIntake()
  return useMutation({
    mutationFn: (body: { meal: Meal; items: { food_id: number; servings: number }[]; date?: string | null }) =>
      api<FoodLogEntry[]>('/nutrition/logs/batch', { method: 'POST', body }),
    onSuccess: refresh,
  })
}

export function useDeleteLog() {
  const refresh = useRefreshIntake()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/nutrition/logs/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  })
}

/** Water taps update the day optimistically — a glass should never wait on the network. */
export function useAddWater(dateKey: string | undefined) {
  const qc = useQueryClient()
  const key = [ROOT, 'day', dateKey ?? 'today']
  return useMutation({
    mutationFn: (amount_ml: number) => api<WaterOut>('/nutrition/water', { method: 'POST', body: { amount_ml, date: dateKey ?? null } }),
    onMutate: async (amount_ml) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<DailyNutrition>(key)
      if (prev) {
        const water = Math.max(0, prev.consumed.water_ml + amount_ml)
        qc.setQueryData<DailyNutrition>(key, {
          ...prev,
          consumed: { ...prev.consumed, water_ml: water },
          remaining: prev.remaining && prev.targets ? { ...prev.remaining, water_ml: Math.max(0, prev.targets.water_ml - water) } : prev.remaining,
        })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key })
      void qc.invalidateQueries({ queryKey: [ROOT, 'history'] })
    },
  })
}
