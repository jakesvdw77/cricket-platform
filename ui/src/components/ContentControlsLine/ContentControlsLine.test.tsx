import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContentControlsLine, SortLink, SortMenu } from './ContentControlsLine'

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

// docs/specs/088
describe('SortMenu', () => {
  const options = [
    { value: 'name-asc', label: 'Name, A to Z', linkLabel: 'A to Z' },
    { value: 'name-desc', label: 'Name, Z to A', linkLabel: 'Z to A' },
    { value: 'season-desc', label: 'Games this season, most first', linkLabel: 'most games' },
    { value: 'season-asc', label: 'Games this season, fewest first', linkLabel: 'fewest games' },
  ]

  it('reads like the sort link, with the current order in words', () => {
    render(<SortMenu value="season-desc" options={options} onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: /most games/ })).toHaveAttribute('aria-haspopup', 'menu')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens a menu of every order with the current one selected, and reports the chosen one', async () => {
    const onChange = vi.fn()
    render(<SortMenu value="name-asc" options={options} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: /A to Z/ }))

    const items = screen.getAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual(options.map((option) => option.label))
    expect(items[0]).toHaveClass('Mui-selected')
    expect(items[2]).not.toHaveClass('Mui-selected')

    await userEvent.click(screen.getByRole('menuitem', { name: 'Games this season, most first' }))

    expect(onChange).toHaveBeenCalledWith('season-desc')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

