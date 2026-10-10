import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SlotNavigator } from './SlotNavigator'

// jsdom has no layout, so the box's geometry is stubbed: three groups starting 0, 500 and 1100 px along.
function makeBox(scrollLeft: number) {
  const box = document.createElement('div')
  const firstCol = document.createElement('div')
  firstCol.setAttribute('data-first-col', '')
  firstCol.getBoundingClientRect = () => ({ width: 100, left: 0 }) as DOMRect
  box.appendChild(firstCol)
  const groups: [string, number][] = [['Sat 3 Oct, Morning', 0], ['Sat 3 Oct, Afternoon', 500], ['Sun 4 Oct, Morning', 1100]]
  for (const [label, start] of groups) {
    const header = document.createElement('div')
    header.setAttribute('data-slot-start', label)
    header.setAttribute('data-slot-label', label)
    // Left edge in the viewport: content offset (start plus the first column) less the scroll position.
    header.getBoundingClientRect = () => ({ left: start + 100 - scrollLeft, width: 100 }) as DOMRect
    box.appendChild(header)
  }
  box.getBoundingClientRect = () => ({ left: 0 }) as DOMRect
  box.scrollLeft = scrollLeft
  Object.defineProperty(box, 'scrollWidth', { value: 2000 })
  Object.defineProperty(box, 'clientWidth', { value: 800 })
  box.scrollTo = vi.fn() as unknown as typeof box.scrollTo
  return box
}

afterEach(() => vi.restoreAllMocks())

describe('SlotNavigator', () => {
  it('renders nothing without a scroll box', () => {
    const { container } = render(<SlotNavigator scrollBox={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('disables Previous at the first group and shows the label', () => {
    render(<SlotNavigator scrollBox={makeBox(0)} />)
    expect(screen.getByText('Sat 3 Oct, Morning (1 of 3)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous slot' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next slot' })).toBeEnabled()
  })

  it('disables Next at the last group', () => {
    render(<SlotNavigator scrollBox={makeBox(1100)} />)
    expect(screen.getByText('Sun 4 Oct, Morning (3 of 3)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next slot' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous slot' })).toBeEnabled()
  })

  it('scrolls the box to the next and previous group start', async () => {
    const user = userEvent.setup()
    const box = makeBox(500)
    render(<SlotNavigator scrollBox={box} />)
    expect(screen.getByText('Sat 3 Oct, Afternoon (2 of 3)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next slot' }))
    expect(box.scrollTo).toHaveBeenLastCalledWith({ left: 1100, behavior: 'smooth' })
    await user.click(screen.getByRole('button', { name: 'Previous slot' }))
    expect(box.scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' })
  })

  it('scrolls instantly when reduced motion is preferred', async () => {
    const user = userEvent.setup()
    window.matchMedia = ((query: string) => ({ matches: query.includes('reduce') })) as unknown as typeof window.matchMedia
    const box = makeBox(0)
    render(<SlotNavigator scrollBox={box} />)
    await user.click(screen.getByRole('button', { name: 'Next slot' }))
    expect(box.scrollTo).toHaveBeenCalledWith({ left: 500, behavior: 'auto' })
    delete (window as { matchMedia?: unknown }).matchMedia
  })
})
