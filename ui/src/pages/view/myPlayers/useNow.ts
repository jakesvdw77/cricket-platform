import { useEffect, useState } from 'react'

// The current time, refreshed every minute, so an elapsed time or a countdown on screen stays right without a refetch.
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
