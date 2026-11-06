import { useCallback, useState } from 'react'

// TEMPORARY (owner, 2026-11-06): a slider in the Hub header band that sets how see-through the console is, so the owner can pick the
// value by eye. 1 is the current look, 0 is fully clear. Remove with the slider once a value is chosen and baked into HubFrame.
const KEY = 'hub:glass'

function read(): number {
  try {
    const v = Number(localStorage.getItem(KEY))
    return Number.isFinite(v) && localStorage.getItem(KEY) !== null ? Math.min(1, Math.max(0, v)) : 1
  } catch {
    return 1
  }
}

export function useHubGlass() {
  const [glass, setGlassState] = useState(read)
  const setGlass = useCallback((v: number) => {
    setGlassState(v)
    try {
      localStorage.setItem(KEY, String(v))
    } catch {
      /* storage unavailable: the value just lasts for this visit */
    }
  }, [])
  return { glass, setGlass }
}
