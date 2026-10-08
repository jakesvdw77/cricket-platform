import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSwipe } from './useSwipe'
import type { UseSwipeOptions } from './useSwipe'

function Target(options: UseSwipeOptions) {
  const bind = useSwipe(options)
  return <div data-testid="target" {...bind} />
}

function swipe(from: [number, number], to: [number, number]) {
  const target = screen.getByTestId('target')
  fireEvent.touchStart(target, { touches: [{ clientX: from[0], clientY: from[1] }] })
  fireEvent.touchEnd(target, { changedTouches: [{ clientX: to[0], clientY: to[1] }] })
}

describe('useSwipe', () => {
  it('calls onSwipeLeft for a leftward move and onSwipeRight for a rightward one', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    render(<Target onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight} />)

    swipe([200, 100], [100, 105])
    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
    expect(onSwipeRight).not.toHaveBeenCalled()

    swipe([100, 100], [210, 90])
    expect(onSwipeRight).toHaveBeenCalledTimes(1)
  })

  it('ignores a short move and a mostly vertical one', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    render(<Target onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight} />)

    swipe([100, 100], [70, 100])
    swipe([200, 100], [120, 250])
    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('honours a custom threshold', () => {
    const onSwipeLeft = vi.fn()
    render(<Target onSwipeLeft={onSwipeLeft} threshold={20} />)

    swipe([100, 100], [70, 100])
    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
  })

  it('forgets a cancelled touch', () => {
    const onSwipeLeft = vi.fn()
    render(<Target onSwipeLeft={onSwipeLeft} />)
    const target = screen.getByTestId('target')

    fireEvent.touchStart(target, { touches: [{ clientX: 200, clientY: 100 }] })
    fireEvent.touchCancel(target)
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: 50, clientY: 100 }] })
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('hands the element touch-action: pan-y so vertical scrolling stays with the browser', () => {
    const { result } = renderHook(() => useSwipe({}))

    expect(result.current.style).toEqual({ touchAction: 'pan-y' })
  })

  it('ignores a multi-touch start (pinch)', () => {
    const onSwipeLeft = vi.fn()
    render(<Target onSwipeLeft={onSwipeLeft} />)
    const target = screen.getByTestId('target')

    fireEvent.touchStart(target, { touches: [{ clientX: 200, clientY: 100 }, { clientX: 250, clientY: 100 }] })
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: 50, clientY: 100 }] })
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })
})
