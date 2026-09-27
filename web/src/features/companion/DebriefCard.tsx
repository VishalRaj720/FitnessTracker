import { useQuery } from '@tanstack/react-query'
import { Card, Icon, MonoLabel, Spinner } from '@/components/ui'
import { companionApi } from '@/features/companion/api'
import { useCompanionStatus } from '@/features/companion/api'

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
      <Card radius="xl" pad="sm" className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
        <Spinner className="h-3.5 w-3.5" /> your coach is looking at this session…
      </Card>
    )
  }
  if (q.isError || !q.data?.text) return null

  return (
    <Card radius="xl" pad="md" accent="pulse">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-pulse/30 bg-pulse/10 text-pulse">
          <Icon name="message" size={14} />
        </span>
        <MonoLabel tone="pulse">Coach debrief</MonoLabel>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{q.data.text}</p>
    </Card>
  )
}
