import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { FocusEvent } from 'react'

// docs/specs/145 decision 12: on a wide screen the Hub menu collapses to a 64 px icon rail MENU_COLLAPSE_MS after a page loads, unless the
// pointer is over the menu or focus is inside it. Only the handle (or the keyboard on it) opens or closes the menu: hovering the rail does
// NOT expand it (owner, 2026-11-06: the menu popping open under the pointer was jarring). A stored preference (localStorage
// 'hub:menuAutoCollapse', 'off' disables, absent means on) is read now so a Settings switch can come later; no UI here.
export const MENU_COLLAPSE_MS = 10000
export const MENU_AUTO_COLLAPSE_KEY = 'hub:menuAutoCollapse'
// The change is a dissolve, never an animated resize: the page fades out to its background (VEIL_IN_MS), the layout swaps while it is covered,
// and it fades back in slowly (VEIL_OUT_MS). Animating the column width re-laid out the whole content grid on every frame and flickered.
export const VEIL_IN_MS = 160
export const VEIL_OUT_MS = 520

export function menuAutoCollapsePreference(): boolean {
  try {
    return localStorage.getItem(MENU_AUTO_COLLAPSE_KEY) !== 'off'
  } catch {
    return true
  }
}

const reducedMotion = (): boolean => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

// HubFrame provides it, HubMenu (and the player card) read it.
const HubMenuCollapsedContext = createContext(false)
export const HubMenuCollapsedProvider = HubMenuCollapsedContext.Provider
export const useHubMenuCollapsed = (): boolean => useContext(HubMenuCollapsedContext)

export type MenuVeil = 'idle' | 'in' | 'out'

// `enabled` is the layout's answer (md up, a content page); `routeKey` changes with the page and re-arms the timer.
export function useHubMenuAutoCollapse(enabled: boolean, routeKey: string) {
  const [preferred] = useState(menuAutoCollapsePreference)
  const active = enabled && preferred
  const [open, setOpen] = useState(true)
  const [veil, setVeil] = useState<MenuVeil>('idle')
  const [hover, setHover] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const timers = useRef<number[]>([])
  const collapsed = active && !open
  const armed = active && open && veil === 'idle' && !hover && !focusWithin

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  // Swap the layout behind the veil: dim, change while covered, reveal.
  const change = useCallback((nextOpen: boolean) => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
    if (reducedMotion()) {
      setOpen(nextOpen)
      return
    }
    setVeil('in')
    timers.current.push(
      window.setTimeout(() => {
        setOpen(nextOpen)
        setVeil('out')
      }, VEIL_IN_MS),
      window.setTimeout(() => setVeil('idle'), VEIL_IN_MS + VEIL_OUT_MS),
    )
  }, [])

  useEffect(() => {
    if (!armed) return undefined
    const id = window.setTimeout(() => change(false), MENU_COLLAPSE_MS)
    return () => window.clearTimeout(id)
  }, [armed, routeKey, change])

  const toggle = useCallback(() => change(!open), [change, open])

  // Spread on the element that holds the whole menu column, handle included: they only PAUSE the timer, they never expand the menu.
  const columnProps = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    onFocus: () => setFocusWithin(true),
    onBlur: (event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false)
    },
  }

  return { active, collapsed, veil, armed, toggle, columnProps }
}
