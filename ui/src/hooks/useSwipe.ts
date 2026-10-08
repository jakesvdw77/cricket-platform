import { useRef } from 'react'
import type { CSSProperties, TouchEvent } from 'react'

export interface UseSwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  // Minimum horizontal travel in px for a swipe.
  threshold?: number
}

// docs/specs/085 (E): a horizontal swipe on touch screens, e.g. to step between games. Spread the result onto the element.
// A move counts when it travels at least `threshold` px sideways and is clearly more sideways than vertical (a
// mostly-vertical drag is a page scroll and is ignored); `touch-action: pan-y` leaves vertical scrolling to the browser.
// Arrows stay the primary control - this is an extra.
export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 50 }: UseSwipeOptions) {
  const start = useRef<{ x: number; y: number } | null>(null)

  return {
    onTouchStart: (event: TouchEvent) => {
      const touch = event.touches[0]
      start.current = event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : null
    },
    onTouchEnd: (event: TouchEvent) => {
      const origin = start.current
      start.current = null
      const touch = event.changedTouches[0]
      if (!origin || !touch) return
      const dx = touch.clientX - origin.x
      const dy = touch.clientY - origin.y
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (dx < 0) onSwipeLeft?.()
      else onSwipeRight?.()
    },
    onTouchCancel: () => {
      start.current = null
    },
    style: { touchAction: 'pan-y' } as CSSProperties,
  }
}
