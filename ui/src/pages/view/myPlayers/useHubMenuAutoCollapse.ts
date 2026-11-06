import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { FocusEvent } from 'react'

// docs/specs/145 decision 12: on a wide screen the Hub menu collapses to a 64 px icon rail MENU_COLLAPSE_MS after a page loads, unless the
// pointer is over the menu or focus is inside it. Hovering, focusing or clicking the rail (or its handle) brings the full menu back and
// the timer starts again when the pointer or focus leaves. Every route change re-arms the timer. A stored preference
// (localStorage 'hub:menuAutoCollapse', 'off' disables, absent means on) is read now so a Settings switch can come later; no UI here.
export const MENU_COLLAPSE_MS = 10000
export const MENU_AUTO_COLLAPSE_KEY = 'hub:menuAutoCollapse'

export function menuAutoCollapsePreference(): boolean {
  try {
    return localStorage.getItem(MENU_AUTO_COLLAPSE_KEY) !== 'off'
  } catch {
    return true
  }
}

// HubFrame provides it, HubMenu (and the player card) read it.
const HubMenuCollapsedContext = createContext(false)
export const HubMenuCollapsedProvider = HubMenuCollapsedContext.Provider
export const useHubMenuCollapsed = (): boolean => useContext(HubMenuCollapsedContext)

// `enabled` is the layout's answer (md up, a content page); `routeKey` changes with the page.
export function useHubMenuAutoCollapse(enabled: boolean, routeKey: string) {
  const [preferred] = useState(menuAutoCollapsePreference)
  const active = enabled && preferred
  const [collapsedState, setCollapsed] = useState(false)
  const [hover, setHover] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const collapsed = active && collapsedState
  const armed = active && !collapsed && !hover && !focusWithin

  useEffect(() => {
    if (!armed) return undefined
    const id = window.setTimeout(() => setCollapsed(true), MENU_COLLAPSE_MS)
    return () => window.clearTimeout(id)
  }, [armed, routeKey])

  const expand = useCallback(() => setCollapsed(false), [])
  const toggle = useCallback(() => setCollapsed((value) => !value), [])

  // Spread on the element that holds the whole menu column, handle included.
  const columnProps = {
    onMouseEnter: () => {
      setHover(true)
      if (collapsed) expand()
    },
    onMouseLeave: () => setHover(false),
    onFocus: () => {
      setFocusWithin(true)
      if (collapsed) expand()
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false)
    },
    onClick: () => {
      if (collapsed) expand()
    },
  }

  return { active, collapsed, armed, toggle, columnProps }
}
