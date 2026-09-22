import { env } from '@/lib/env'
import { useAuthStore } from '@/features/auth/authStore'
import type { ApiError } from '@/types/api'

export class ApiRequestError extends Error {
  code: string
  status: number
  details?: unknown
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export class NetworkError extends Error {
  constructor(message = 'You are offline') {
    super(message)
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
  signal?: AbortSignal
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = opts
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = useAuthStore.getState().token
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(env.apiBase + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new NetworkError()
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!res.ok) {
    const err = (data as ApiError | null)?.error
    if (res.status === 401 && auth) {
      useAuthStore.getState().logout()
    }
    throw new ApiRequestError(
      res.status,
      err?.code ?? 'http_error',
      err?.message ?? `Request failed (${res.status})`,
      err?.details,
    )
  }
  return data as T
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) return e.message
  if (e instanceof NetworkError) return e.message
  if (e instanceof Error) return e.message
  return 'Something went wrong'
}
