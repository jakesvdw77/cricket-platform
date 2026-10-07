import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContentControlsLine, SortLink } from './ContentControlsLine'

function setPhone(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia
})

describe('ContentControlsLine (docs/specs/083)', () => {
  it('shows the scope text, the sort link and the controls on desktop', () => {
    setPhone(false)
    render(
      <ContentControlsLine
        scope="Showing 2 open polls"
        sortAction={<SortLink label="soonest first" onToggle={() => undefined} />}
        controls={<button type="button">Show closed polls</button>}
        pinned={<button type="button">Jump to today</button>}
      />,
    )
    expect(screen.getByText(/Showing 2 open polls/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'soonest first' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show closed polls' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jump to today' })).toBeInTheDocument()
  })

  it('keeps only the scope text and pinned controls on a phone', () => {
    setPhone(true)
    render(
      <ContentControlsLine
        scope="Showing 2 open polls"
        sortAction={<SortLink label="soonest first" onToggle={() => undefined} />}
        controls={<button type="button">Show closed polls</button>}
        pinned={<button type="button">Jump to today</button>}
      />,
    )
    expect(screen.getByText(/Showing 2 open polls/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /soonest first/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show closed polls' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jump to today' })).toBeInTheDocument()
  })

  it('SortLink calls onToggle when clicked', async () => {
    const onToggle = vi.fn()
    render(<SortLink label="latest first" onToggle={onToggle} />)
    await userEvent.click(screen.getByRole('button', { name: 'latest first' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
