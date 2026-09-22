import { get, set } from 'idb-keyval'
import { api, NetworkError } from '@/lib/apiClient'
import type { SessionCreateOut, SessionIn } from '@/types/api'

const KEY = 'fitsathi.sessionQueue.v1'

interface QueuedSession {
  payload: SessionIn
  queuedAt: number
  attempts: number
}

async function readQueue(): Promise<QueuedSession[]> {
  try {
    return (await get<QueuedSession[]>(KEY)) ?? []
  } catch {
    return []
  }
}

async function writeQueue(q: QueuedSession[]): Promise<void> {
  try {
    await set(KEY, q)
  } catch {
    /* IndexedDB unavailable (private mode) — nothing we can do */
  }
}

export async function enqueueSession(payload: SessionIn): Promise<void> {
  const q = await readQueue()
  if (q.some((s) => s.payload.client_session_id === payload.client_session_id)) return
  q.push({ payload, queuedAt: Date.now(), attempts: 0 })
  await writeQueue(q)
}

export async function queueLength(): Promise<number> {
  return (await readQueue()).length
}

/**
 * Submit now; if the network is down, persist locally and resolve with `queued: true`.
 * The backend's client_session_id idempotency makes retries safe.
 */
export async function submitOrQueue(payload: SessionIn): Promise<{ result: SessionCreateOut | null; queued: boolean }> {
  try {
    const result = await api<SessionCreateOut>('/sessions', { method: 'POST', body: payload })
    return { result, queued: false }
  } catch (e) {
    if (e instanceof NetworkError) {
      await enqueueSession(payload)
      return { result: null, queued: true }
    }
    throw e
  }
}

/** Try to flush everything queued. Returns how many remain. */
export async function flushQueue(): Promise<number> {
  const q = await readQueue()
  if (!q.length) return 0
  const remaining: QueuedSession[] = []
  for (const item of q) {
    try {
      await api<SessionCreateOut>('/sessions', { method: 'POST', body: item.payload })
    } catch (e) {
      if (e instanceof NetworkError) {
        remaining.push({ ...item, attempts: item.attempts + 1 })
      } else {
        // Permanent rejection (validation/auth) — drop after 5 attempts so the queue can't jam.
        if (item.attempts < 5) remaining.push({ ...item, attempts: item.attempts + 1 })
      }
    }
  }
  await writeQueue(remaining)
  return remaining.length
}
