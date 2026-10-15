import { useCallback, useSyncExternalStore } from 'react'
import type { NameMode } from '../utils/playerDisplayName'

export const PLAYER_NAME_MODE_KEY = 'scorecard:nameMode'
export const DEFAULT_NAME_MODE: NameMode = 'full'

const isNameMode = (value: unknown): value is NameMode => value === 'full' || value === 'first'

// Used when storage is unavailable (private browsing): the choice still applies for the visit, in memory.
let memoryMode: NameMode | null = null
const listeners = new Set<() => void>()

function readMode(): NameMode {
  try {
    const raw = localStorage.getItem(PLAYER_NAME_MODE_KEY)
    if (isNameMode(raw)) return raw
    return memoryMode ?? DEFAULT_NAME_MODE
  } catch {
    // storage unavailable: use what was chosen this visit, else the default; never throw
    return memoryMode ?? DEFAULT_NAME_MODE
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

// docs/specs/101-match-results-our-side-scorecard.md (Player name display toggle): the Full name | First name
// preference of the scorecard screens, remembered per user in the browser (try/catch around storage, default Full name),
// in the manner of useListViewPreference. Unlike that hook every user of this one shares ONE value: the toggle at the top
// of a step and every PlayerName below it must change together, so it is a small external store rather than per-hook
// state. Display-only; nothing is sent to the server.
export function usePlayerNameMode(): [NameMode, (mode: NameMode) => void] {
  const mode = useSyncExternalStore(subscribe, readMode, () => DEFAULT_NAME_MODE)
  const setMode = useCallback((next: NameMode) => {
    memoryMode = next
    try {
      localStorage.setItem(PLAYER_NAME_MODE_KEY, next)
    } catch {
      // storage full or unavailable: the choice still applies for this visit
    }
    listeners.forEach((listener) => listener())
  }, [])
  return [mode, setMode]
}

// For tests: forget the in-memory choice.
export function resetPlayerNameModeForTests(): void {
  memoryMode = null
  listeners.forEach((listener) => listener())
}
