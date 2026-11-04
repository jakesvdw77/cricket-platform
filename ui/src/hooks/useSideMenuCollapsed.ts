import { useCallback, useState } from 'react'

export const SIDE_MENU_COLLAPSED_KEY = 'shell:sideMenuCollapsed'

function read(): boolean {
  try {
    return localStorage.getItem(SIDE_MENU_COLLAPSED_KEY) === 'true'
  } catch {
    // storage unavailable: the menu is simply open
    return false
  }
}

// docs/specs/139 (owner, 2026-11-04): the side menu can be collapsed to the icon rail by the user and is OPEN by default. The choice is
// remembered per browser (try/catch around storage; unavailable storage means open, and the choice still holds for the visit).
export function useSideMenuCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(read)
  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current
      try {
        localStorage.setItem(SIDE_MENU_COLLAPSED_KEY, String(next))
      } catch {
        // storage full or unavailable: the choice still applies for this visit
      }
      return next
    })
  }, [])
  return [collapsed, toggle]
}
