import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

// docs/specs/136 and page-anatomy section 5 (return navigation): a toggle that lives in the address (`?key=1`) instead of component state,
// so a link carrying `currentOrigin(location)` brings it back exactly as it was. Other parameters are kept; the history entry is replaced.
export function useUrlFlag(key: string): [boolean, (value: boolean) => void] {
  const [params, setParams] = useSearchParams()
  const value = params.get(key) === '1'
  const set = useCallback(
    (next: boolean) => {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current)
          if (next) updated.set(key, '1')
          else updated.delete(key)
          return updated
        },
        { replace: true },
      )
    },
    [key, setParams],
  )
  return [value, set]
}
