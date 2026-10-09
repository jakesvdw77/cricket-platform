import { useCallback, useState } from 'react'

export type ListView = 'cards' | 'list'

function isListView(value: unknown): value is ListView {
  return value === 'cards' || value === 'list'
}

function readView(storageKey: string, fallback: ListView): ListView {
  try {
    const raw = localStorage.getItem(storageKey)
    return isListView(raw) ? raw : fallback
  } catch {
    // storage unavailable (private browsing, disabled storage): just use the default, never throw
    return fallback
  }
}

// docs/specs/088-players-polls-alignment.md: the Cards | List preference of a page, remembered per page in the
// browser. Players is the first user (`playerList:view`); Matches and Polls will use the same hook for their own keys,
// so the preference behaves the same everywhere. Read once when the page mounts (so the first render is already the
// remembered view), saved the moment it changes, and an unknown stored value or unavailable storage falls back to the
// default. Never part of usePersistedListFilters: it is a display preference, not a filter.
export function useListViewPreference(storageKey: string, defaultView: ListView = 'cards'): [ListView, (view: ListView) => void] {
  const [view, setViewState] = useState<ListView>(() => readView(storageKey, defaultView))

  const setView = useCallback(
    (next: ListView) => {
      setViewState(next)
      try {
        localStorage.setItem(storageKey, next)
      } catch {
        // storage full or unavailable: the choice still applies for this visit
      }
    },
    [storageKey],
  )

  return [view, setView]
}
