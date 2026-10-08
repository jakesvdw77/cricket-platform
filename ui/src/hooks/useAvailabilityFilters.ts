import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { usePersistedListFilters } from './usePersistedListFilters'

// docs/specs/083-availability-filters-and-toolbars.md: the one filter model shared by the
// Availability hub's Polls, Players and Coverage views. Owned by the hub layout (so it survives
// switching tabs), saved once per club, and mirrored in the address (?league=&section=&team=)
// so the back button and shared links keep the same view. The address wins on load.
export type AvailabilityFilters = {
  leagueId: string | null
  sectionId: string | null
  teamId: string | null
}

const AVAILABILITY_FILTER_DEFAULTS: AvailabilityFilters = {
  leagueId: null,
  sectionId: null,
  teamId: null,
}

const availabilityFiltersKey = (clubId: string | undefined) => `availability:filters:${clubId}`

const PARAMS: Record<keyof AvailabilityFilters, string> = {
  leagueId: 'league',
  sectionId: 'section',
  teamId: 'team',
}
const FILTER_KEYS = Object.keys(PARAMS) as (keyof AvailabilityFilters)[]

// The three per-view keys this model replaces, in the order they are read when seeding (Players
// carries all four filters, Coverage three, Polls only the section).
const LEGACY_KEYS = ['playerAvailability:filters', 'availabilityCoverage:filters', 'availabilityPolls:filters']

function readLegacySeed(clubId: string): Partial<AvailabilityFilters> {
  const seed: Partial<AvailabilityFilters> = {}
  for (const legacyKey of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(`${legacyKey}:${clubId}`)
      if (!raw) continue
      const parsed = JSON.parse(raw) as Partial<Record<keyof AvailabilityFilters, unknown>>
      for (const key of FILTER_KEYS) {
        const value = parsed[key]
        if (seed[key] === undefined && typeof value === 'string' && value) seed[key] = value
      }
    } catch {
      // unreadable legacy value - ignore it
    }
  }
  return seed
}

export interface UseAvailabilityFilters {
  filters: AvailabilityFilters
  setFilters: (next: Partial<AvailabilityFilters>) => void
  // Clears League, Section and Team (there is no season control on any availability view).
  clearFilters: () => void
}

export function useAvailabilityFilters(clubId: string | undefined): UseAvailabilityFilters {
  const storageKey = availabilityFiltersKey(clubId)
  const [stored, update] = usePersistedListFilters<AvailabilityFilters>(storageKey, AVAILABILITY_FILTER_DEFAULTS)
  // Only the three known filters: anything else in an older saved value (e.g. a seasonId) is ignored.
  const filters = useMemo<AvailabilityFilters>(
    () => ({ leagueId: stored.leagueId, sectionId: stored.sectionId, teamId: stored.teamId }),
    [stored.leagueId, stored.sectionId, stored.teamId],
  )
  const [searchParams, setSearchParams] = useSearchParams()
  const { pathname } = useLocation()
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const searchString = searchParams.toString()

  // One-time migration: when this club has no saved filters yet, seed them from the old per-view keys.
  useEffect(() => {
    if (!clubId) return
    try {
      if (localStorage.getItem(storageKey) !== null) return
    } catch {
      return
    }
    const seed = readLegacySeed(clubId)
    if (Object.keys(seed).length > 0) update(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // Address -> state: the address wins. On the first run a filter missing from the address keeps its saved
  // value. After that the address is the truth for the same page (the back button and forward button
  // restore exactly that entry, so a missing param means "none"); the exception is a move to another
  // page of the hub with a bare address (a tab or "Go to Polls" link carries no query string), which
  // keeps the filters. Skips a repeat run for the same address (StrictMode).
  const seenAddress = useRef<string | null>(null)
  const seenPath = useRef(pathname)
  useEffect(() => {
    if (seenAddress.current === searchString) return
    const initial = seenAddress.current === null
    const samePage = seenPath.current === pathname
    seenAddress.current = searchString
    const anyParam = FILTER_KEYS.some((key) => searchParams.has(PARAMS[key]))
    const fromUrl: Partial<AvailabilityFilters> = {}
    for (const key of FILTER_KEYS) {
      const value = searchParams.get(PARAMS[key])
      let next: string | null | undefined
      if (value !== null) next = value || null
      else if (!initial && (samePage || anyParam)) next = null
      if (next !== undefined && next !== filtersRef.current[key]) fromUrl[key] = next
    }
    if (Object.keys(fromUrl).length > 0) update(fromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchString, storageKey])

  // Declared after the effect above so that, when it runs, this still holds the previous page.
  useEffect(() => {
    seenPath.current = pathname
  })

  // State -> address, also after moving between the hub's pages. The first run only records the
  // signature: the saved filters load in an effect right after it, and that change is what writes them
  // into a bare address (replace, so no history entry; a repeat run finds nothing to change).
  const lastMirrored = useRef<string | null>(null)
  useEffect(() => {
    const signature = `${pathname}|${JSON.stringify(filters)}`
    if (lastMirrored.current === null) {
      lastMirrored.current = signature
      return
    }
    if (lastMirrored.current === signature) return
    lastMirrored.current = signature
    const next = new URLSearchParams(searchParams)
    let changed = false
    for (const key of FILTER_KEYS) {
      const value = filters[key]
      const current = next.get(PARAMS[key])
      if (value) {
        if (current !== value) {
          next.set(PARAMS[key], value)
          changed = true
        }
      } else if (current !== null) {
        next.delete(PARAMS[key])
        changed = true
      }
    }
    if (changed) setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pathname])

  const setFilters = (next: Partial<AvailabilityFilters>) => {
    const patch = { ...next }
    // A team belongs to one section, so changing the section clears the team choice.
    if ('sectionId' in next && next.sectionId !== filters.sectionId && !('teamId' in next)) patch.teamId = null
    update(patch)
  }

  const clearFilters = () => update({ leagueId: null, sectionId: null, teamId: null })

  return { filters, setFilters, clearFilters }
}
