import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { flushQueue, queueLength } from '@/features/workout/sync/offlineQueue'
import { useAuthStore } from '@/features/auth/authStore'

/** Flushes queued sessions on mount and whenever the browser comes back online. */
export function useOfflineQueueSync(): number {
  const [pending, setPending] = useState(0)
  const qc = useQueryClient()
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const run = async () => {
      const before = await queueLength()
      if (!cancelled) setPending(before)
      if (before === 0 || !navigator.onLine) return
      const after = await flushQueue()
      if (cancelled) return
      setPending(after)
      if (after < before) {
        qc.invalidateQueries({ queryKey: ['plan'] })
        qc.invalidateQueries({ queryKey: ['progress'] })
        qc.invalidateQueries({ queryKey: ['sessions'] })
        qc.invalidateQueries({ queryKey: ['squad'] })
        qc.invalidateQueries({ queryKey: ['me'] })
      }
    }
    run()
    window.addEventListener('online', run)
    const id = window.setInterval(run, 60_000)
    return () => {
      cancelled = true
      window.removeEventListener('online', run)
      window.clearInterval(id)
    }
  }, [token, qc])

  return pending
}
