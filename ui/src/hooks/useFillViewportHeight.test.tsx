import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFillViewportHeight } from './useFillViewportHeight'
import type { FillViewportHeightOptions } from './useFillViewportHeight'

function Box(options: FillViewportHeightOptions) {
  const { ref, height } = useFillViewportHeight<HTMLDivElement>(options)
  return (
    <div ref={ref} data-testid="box" style={{ height }}>
      {height === undefined ? 'unmeasured' : height}
    </div>
  )
}

let top = 200
let observed: (() => void) | null = null
const disconnect = vi.fn()

beforeEach(() => {
  top = 200
  observed = null
  disconnect.mockReset()
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.tagName === 'FOOTER') return { height: 50, top: 0 } as DOMRect
    return { top, height: 0 } as DOMRect
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        observed = callback
      }
      observe() {}
      disconnect() {
        disconnect()
      }
    },
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.querySelectorAll('footer').forEach((node) => node.remove())
})

describe('useFillViewportHeight', () => {
  it('fills the window from the element top, less the bottom padding', () => {
    render(<Box bottomPadding={24} />)

    expect(screen.getByTestId('box')).toHaveTextContent('576') // 800 - 200 - 24
  })

  it('also leaves room for the page footer', () => {
    document.body.appendChild(document.createElement('footer'))
    render(<Box bottomPadding={24} />)

    expect(screen.getByTestId('box')).toHaveTextContent('526') // 800 - 200 - 24 - 50
  })

  it('never goes below the minimum height, so the page scrolls instead', () => {
    top = 790
    render(<Box minHeight={150} />)

    expect(screen.getByTestId('box')).toHaveTextContent('150')
  })

  it('re-measures on resize, orientation change and when the page body changes size', () => {
    render(<Box bottomPadding={0} />)
    expect(screen.getByTestId('box')).toHaveTextContent('600')

    Object.defineProperty(window, 'innerHeight', { value: 700, configurable: true })
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(screen.getByTestId('box')).toHaveTextContent('500')

    Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true })
    act(() => {
      window.dispatchEvent(new Event('orientationchange'))
    })
    expect(screen.getByTestId('box')).toHaveTextContent('200')

    top = 250
    act(() => {
      observed?.()
    })
    expect(screen.getByTestId('box')).toHaveTextContent('150')
  })

  it('copes without ResizeObserver (jsdom) and stops observing on unmount', () => {
    vi.unstubAllGlobals()
    const { unmount } = render(<Box />)
    expect(screen.getByTestId('box')).toHaveTextContent('576')
    unmount()

    vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { observed = cb } observe() {} disconnect() { disconnect() } })
    const second = render(<Box />)
    second.unmount()
    expect(disconnect).toHaveBeenCalled()
  })
})
