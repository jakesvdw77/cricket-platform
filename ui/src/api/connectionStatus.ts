import axios from 'axios'
import { useSyncExternalStore } from 'react'

// "Can the backend be reached?" as a tiny store. axiosConfig reports into it: a request that got no response at all (network
// error, timeout) or a 502/503/504 from the proxy marks the server unreachable; any other answer (200, and also 4xx) marks it
// reachable again. `ConnectionGuard` shows the "Rain stopped play" screen while it is unreachable and polls `pingBackend`.
let unreachable = false
const listeners = new Set<() => void>()

function set(value: boolean) {
  if (unreachable === value) return
  unreachable = value
  listeners.forEach((listener) => listener())
}

export function isBackendDownResponse(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  if (error.code === 'ERR_CANCELED') return false
  if (!error.response) return true
  return [502, 503, 504].includes(error.response.status)
}

export function reportBackendFailure(error: unknown): void {
  if (isBackendDownResponse(error)) set(true)
}

export function reportBackendReachable(): void {
  set(false)
}

export function useBackendUnreachable(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => unreachable,
  )
}

// A tiny public request: Spring answers it (404 or any other status) without a login, so any answer other than a
// gateway error proves the server is up. Resolves true when reachable.
export async function pingBackend(): Promise<boolean> {
  try {
    const response = await axios.get('/api/v1/public/ping', { timeout: 5000, validateStatus: () => true })
    return ![502, 503, 504].includes(response.status)
  } catch {
    return false
  }
}

// Test helper: the store is module state.
export function resetConnectionStatusForTests(): void {
  unreachable = false
  listeners.forEach((listener) => listener())
}
