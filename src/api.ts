import type { Tier } from './data/metrics'

export interface ApiEntry {
  id: number
  metric_id: string
  /** YYYY-MM-DD, local. */
  date: string
  /** HH:MM, local. Several entries can share a date. */
  time: string
  tier: Tier
  note: string | null
  created_at: string
  updated_at: string
}

class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError((body && body.error) || `Request failed with status ${res.status}`)
  }
  return res.json()
}

export function getSession(): Promise<{ authenticated: boolean }> {
  return request('/api/session')
}

export function login(password: string): Promise<{ ok: true }> {
  return request('/api/login', { method: 'POST', body: JSON.stringify({ password }) })
}

export function logout(): Promise<{ ok: true }> {
  return request('/api/logout', { method: 'POST' })
}

export function getEntries(): Promise<{ entries: ApiEntry[] }> {
  return request('/api/entries')
}

export function createEntry(input: {
  metricId: string
  date: string
  time: string
  tier: Tier
  note?: string | null
}): Promise<{ entry: ApiEntry }> {
  return request('/api/entries', { method: 'POST', body: JSON.stringify(input) })
}

export function updateEntry(
  id: number,
  input: { tier?: Tier; time?: string; note?: string | null },
): Promise<{ entry: ApiEntry }> {
  return request(`/api/entries/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function deleteEntry(id: number): Promise<{ ok: true }> {
  return request(`/api/entries/${id}`, { method: 'DELETE' })
}

export { ApiError }
