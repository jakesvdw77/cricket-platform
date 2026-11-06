import { useCallback, useEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'

// docs/specs/145 decision 12 (owner, 2026-11-06): on a wide screen the Hub menu collapses MENU_COLLAPSE_MS after a page loads, unless the pointer is
// over the menu or focus is inside it. Collapsed, the menu is ONE menu button at the left of the header band and the content takes the whole
// width; hovering (or clicking, or focusing) the button fades the menu in as a panel OVER the content (nothing reflows), and it fades out
// when the pointer leaves. "Keep Menu Open" in the panel puts the menu back in the layout. A stored preference (localStorage
// 'hub:menuAutoCollapse', 'off' disables, absent means on) is read now so a Settings switch can come later; no UI here.
export const MENU_COLLAPSE_MS = 10000
export const MENU_AUTO_COLLAPSE_KEY = 'hub:menuAutoCollapse'
// The change is a dissolve, never an animated resize: the page fades out to its background (VEIL_IN_MS), the layout swaps while it is covered,
// and it fades back in slowly (VEIL_OUT_MS). Animating the column width re-laid out the whole content grid on every frame and flickered.
export const VEIL_IN_MS = 160
export const VEIL_OUT_MS = 520
export const PEEK_CLOSE_DELAY_MS = 350

export function menuAutoCollapsePreference(): boolean {
  try {
    return localStorage.getItem(MENU_AUTO_COLLAPSE_KEY) !== 'off'
  } catch {
    return true
  }
}

const reducedMotion = (): boolean => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

export type MenuVeil = 'idle' | 'in' | 'out'

// `enabled` is the layout's answer (md up, a content page); `routeKey` changes with the page and re-arms the timer.
export function useHubMenuAutoCollapse(enabled: boolean, routeKey: string) {
  const [preferred] = useState(menuAutoCollapsePreference)
  const active = enabled && preferred
  const [open, setOpen] = useState(true)
  const [veil, setVeil] = useState<MenuVeil>('idle')
  const [hover, setHover] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const [peek, setPeek] = useState(false)
  const timers = useRef<number[]>([])
  const closeTimer = useRef<number | undefined>(undefined)
  const collapsed = active && !open
  const armed = active && open && veil === 'idle' && !hover && !focusWithin

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id))
      window.clearTimeout(closeTimer.current)
    },
    [],
  )

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

  // The peek (the panel over the content while collapsed). Opening is immediate (the fade is CSS); closing waits a moment so the pointer can
  // travel between the button and the panel. Choosing a page (a route change) closes it.
  const openPeek = useCallback(() => {
    window.clearTimeout(closeTimer.current)
    setPeek(true)
  }, [])
  const closePeek = useCallback((delay = PEEK_CLOSE_DELAY_MS) => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setPeek(false), delay)
  }, [])
  useEffect(() => setPeek(false), [routeKey])
  const pin = useCallback(() => {
    setPeek(false)
    change(true)
  }, [change])

  // While the menu is in the layout these only PAUSE the collapse timer. While collapsed they keep the peek panel open under the pointer or focus.
  const columnProps = {
    onMouseEnter: () => {
      setHover(true)
      if (collapsed) openPeek()
    },
    onMouseLeave: () => {
      setHover(false)
      if (collapsed) closePeek()
    },
    onFocus: () => {
      setFocusWithin(true)
      if (collapsed) openPeek()
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setFocusWithin(false)
        if (collapsed) closePeek(120)
      }
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (collapsed && event.key === 'Escape') setPeek(false)
    },
  }

  return { active, collapsed, peek: collapsed && peek, openPeek, closePeek, pin, veil, armed, toggle, columnProps }
}
