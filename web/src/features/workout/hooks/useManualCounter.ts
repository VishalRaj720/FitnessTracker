import { useCallback, useEffect, useRef, useState } from 'react'
import { useSessionStore } from '@/features/workout/store/sessionStore'

/**
 * Manual mode: tap to count reps, or a running timer for holds. Mirrors values into
 * the session store's `live` slice so the same widgets render.
 */
export function useManualCounter(mode: 'reps' | 'hold', active: boolean) {
  const updateLive = useSessionStore((s) => s.updateLive)
  const [reps, setReps] = useState(0)
  const [heldMs, setHeldMs] = useState(0)
  const [running, setRunning] = useState(false)
  const lastTick = useRef<number | null>(null)

  useEffect(() => {
    setReps(0)
    setHeldMs(0)
    setRunning(false)
    lastTick.current = null
    updateLive({ reps: 0, heldMs: 0, inTolerance: false, formScore: 100 })
  }, [active, mode, updateLive])

  useEffect(() => {
    if (mode !== 'hold' || !running || !active) return
    const id = setInterval(() => {
      const now = performance.now()
      const dt = lastTick.current === null ? 0 : now - lastTick.current
      lastTick.current = now
      setHeldMs((h) => {
        const next = h + dt
        updateLive({ heldMs: next, inTolerance: true })
        return next
      })
    }, 100)
    return () => clearInterval(id)
  }, [mode, running, active, updateLive])

  const tap = useCallback(() => {
    setReps((r) => {
      const next = r + 1
      updateLive({ reps: next })
      return next
    })
  }, [updateLive])

  const undo = useCallback(() => {
    setReps((r) => {
      const next = Math.max(0, r - 1)
      updateLive({ reps: next })
      return next
    })
  }, [updateLive])

  const toggle = useCallback(() => {
    lastTick.current = null
    setRunning((v) => !v)
  }, [])

  return { reps, heldMs, running, tap, undo, toggle }
}
