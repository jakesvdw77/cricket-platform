import { useEffect, useState } from 'react'

// docs/specs/043-list-toolbar-gold-standard.md: generalizes the ad hoc, per-screen
// try/catch-wrapped localStorage.getItem/setItem pair MatchList.tsx introduced in
// docs/specs/042-match-list-filters-and-search.md (justified there as a one-off, first-and-only
// use) — TeamDirectory/PlayerList/AvailabilityPollsDashboard all need the identical pattern now,
// the real "rule of three-plus" trigger for extracting it rather than copying it a fourth time.
// `search` is never part of `T` for any caller — every screen keeps `search` as its own separate,
// non-persisted useState, exactly as MatchList already does; this hook doesn't enforce that
// itself, it's a convention every caller follows.
export function usePersistedListFilters<T extends Record<string, unknown>>(
  storageKey: string,
  defaults: T,
): [T, (next: Partial<T>) => void] {
  const [state, setState] = useState<T>(defaults)

  // Loaded once per storageKey (e.g. when clubId, and therefore the key, changes) — falls back
  // silently to defaults on a missing key, a parse failure, or a blocked/unavailable
  // localStorage (private browsing, quota, disabled storage), never throwing.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        setState({ ...defaults, ...JSON.parse(raw) })
      }
    } catch {
      // storage unavailable/corrupt — start from defaults, never throw
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const update = (next: Partial<T>) => {
    const merged = { ...state, ...next }
    try {
      localStorage.setItem(storageKey, JSON.stringify(merged))
    } catch {
      // storage full/unavailable — filters just won't persist this session
    }
    setState(merged)
  }

  return [state, update]
}
