import { useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { pingBackend, reportBackendReachable, useBackendUnreachable } from '../../api/connectionStatus'
import { StatusScreen } from '../StatusScreen'

// Shows the "Rain stopped play" screen over the app while a request has just shown the backend cannot be reached (see
// api/connectionStatus.ts), pings it every 10 seconds, and goes away as soon as it answers, refetching what had failed.
// Pages that never call the API never trigger it. The app underneath stays mounted, so nothing is lost.
export const CONNECTION_RETRY_MS = 10_000

export function ConnectionGuard({ children }: { children: ReactNode }) {
  const unreachable = useBackendUnreachable()
  const queryClient = useQueryClient()

  const check = useCallback(async () => {
    if (await pingBackend()) {
      reportBackendReachable()
      void queryClient.refetchQueries({ predicate: (query) => query.state.status === 'error' })
    }
  }, [queryClient])

  useEffect(() => {
    if (!unreachable) return
    const timer = window.setInterval(() => void check(), CONNECTION_RETRY_MS)
    return () => window.clearInterval(timer)
  }, [unreachable, check])

  return (
    <>
      {children}
      {unreachable && <StatusScreen kind="unreachable" overlay primaryAction={{ label: 'Try again', onClick: () => void check() }} />}
    </>
  )
}
