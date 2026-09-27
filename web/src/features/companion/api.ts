import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'

export interface CompanionStatus {
  enabled: boolean
  provider: string
}

export interface SuggestedAction {
  kind: 'start_workout' | 'open_exercise' | 'open_tutorial' | 'open_progress'
  label: string
  slug: string | null
}

export interface ChatReply {
  reply: string
  in_scope: boolean
  suggested_actions: SuggestedAction[]
}

export interface CoachMessage {
  id: string
  role: 'user' | 'coach'
  content: string
  created_at: string
}

export interface RepKinematicsPayload {
  index: number
  series: Record<string, number[]>
  descent_ms: number
  bottom_ms: number
  ascent_ms: number
  total_ms: number
}

export interface CuePayload {
  exercise_slug: string
  set_number: number
  rep_count: number
  mode: 'reps' | 'hold'
  reps: RepKinematicsPayload[]
  glossary: Record<string, string>
  reference: unknown
  notes: string
  already_said: string[]
  recent_violations: Record<string, number>
}

export interface CueReply {
  observation: string | null
  cue: string | null
  urgency: number
}

export const companionApi = {
  status: () => api<CompanionStatus>('/companion/status'),
  chat: (message: string, clientReported?: unknown) =>
    api<ChatReply>('/companion/chat', { method: 'POST', body: { message, client_reported: clientReported ?? null } }),
  thread: () => api<{ messages: CoachMessage[] }>('/companion/thread'),
  clearThread: () => api<void>('/companion/thread', { method: 'DELETE' }),
  debrief: (sessionId: string) => api<{ text: string | null }>(`/companion/debrief/${sessionId}`),
  cue: (payload: CuePayload, signal?: AbortSignal) =>
    api<CueReply>('/companion/cue', { method: 'POST', body: payload, signal }),
}

/** Whether the AI coach is configured on this server (no API key = no Coach tab). */
export function useCompanionStatus() {
  return useQuery({
    queryKey: ['companion', 'status'],
    queryFn: () => companionApi.status(),
    staleTime: 5 * 60_000,
    retry: false,
  })
}
