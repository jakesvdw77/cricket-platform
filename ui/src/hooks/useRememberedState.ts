import { useCallback, useEffect, useRef, useState } from 'react'

// Owner decision 2026-11-16: toolbar filters are remembered across visits, everywhere. A drop-in for useState for ONE toolbar control
// (a team, a switch, a sort, a view): it starts from what was saved under `storageKey` (the default when nothing valid is saved, the key
// is null while an id is still loading, or storage is blocked), and saves each change. Search text is never remembered: keep it in plain
// useState. A key that changes (another club, another league) loads that key's own value.
export function useRememberedState<T>(storageKey: string | null, initial: T, isValid: (value: unknown) => boolean = () => true): [T, (next: T | ((previous: T) => T)) => void] {
  const validRef = useRef(isValid)
  validRef.current = isValid
  const read = useCallback((): T => {
    if (!storageKey) return initial
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw !== null) {
        const parsed = JSON.parse(raw) as unknown
        if (validRef.current(parsed)) return parsed as T
      }
    } catch {
      // storage unavailable or corrupt: the default
    }
    return initial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const [value, setValue] = useState<T>(read)
  const loadedKey = useRef(storageKey)
  const dirty = useRef(false)

  useEffect(() => {
    if (loadedKey.current === storageKey) return
    loadedKey.current = storageKey
    dirty.current = false
    setValue(read())
  }, [storageKey, read])

  // Written from an effect, only after a change made through the setter, never after a load.
  useEffect(() => {
    if (!dirty.current || !storageKey) return
    dirty.current = false
    try {
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      // storage full or unavailable: it just is not remembered this session
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const set = useCallback((next: T | ((previous: T) => T)) => {
    dirty.current = true
    setValue(next)
  }, [])
  return [value, set]
}
