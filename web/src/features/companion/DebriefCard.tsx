import { useQuery } from '@tanstack/react-query'
import { Card, Spinner } from '@/components/ui'
import { companionApi } from '@/features/companion/api'
import { useCompanionStatus } from '@/features/companion/CoachPage'

/**
 * The coach's read on the session that just finished.
 *
 * Renders nothing at all when the coach is unavailable, offline, or has nothing to say —
 * an empty card would be worse than no card.
 */
export function DebriefCard({ sessionId }: { sessionId: string | undefined }) {
  const status = useCompanionStatus()
  const enabled = status.data?.enabled === true && !!sessionId && sessionId !== 'local'

  const q = useQuery({
    queryKey: ['companion', 'debrief', sessionId],
    queryFn: () => companionApi.debrief(sessionId as string),
    enabled,
    retry: false,
    staleTime: Infinity,
  })

  if (!enabled) return null
  if (q.isPending) {
    return (
      <Card className="mb-3 flex items-center gap-2 text-xs text-slate-500">
        <Spinner className="h-3.5 w-3.5" /> your coach is looking at this session…
      </Card>
    )
  }
  if (q.isError || !q.data?.text) return null

  return (
    <Card className="mb-3 border-sky-500/40 bg-sky-500/10">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-300">Your coach</div>
      <p className="whitespace-pre-wrap text-sm text-slate-200">{q.data.text}</p>
    </Card>
  )
}
