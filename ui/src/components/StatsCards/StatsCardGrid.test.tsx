import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StatsCardGrid } from './StatsCardGrid'
import type { GroupPickerProps } from './StatsCardGrid'
import type { CardCtx, CardSize, CardState, StatsCardDef, StatsGroupDef } from './statsCardTypes'

// docs/specs/147 section 2 and Amendment 2 items 2, 9, 10: the grid lays out whatever cards it is handed, one group at a time, and imports
// none. The cards here are synthetic: a future card needs no grid change.
interface Payload {
  value: number
}
const ctx: CardCtx = { firstName: 'Sam', scopeLabel: '2025/26', resultHref: (id) => `/r/${id}`, drillHref: () => '/d' }
const groups: StatsGroupDef[] = [{ id: 'summary', label: 'Summary' }, { id: 'batting', label: 'Batting' }, { id: 'bowling', label: 'Bowling' }]

function card(id: string, group: StatsGroupDef['id'], over: Partial<StatsCardDef<Payload>> & { state?: CardState; size?: CardSize } = {}): StatsCardDef<Payload> {
  const { state = 'ready', ...rest } = over
  return {
    id,
    page: 'mine',
    group,
    title: () => `Card ${id}`,
    tag: 'HAVE',
    needs: ['value'],
    order: 1,
    whenMissing: 'hide',
    state: () => state,
    summary: () => `Summary of ${id}`,
    Front: () => <p>front of {id}</p>,
    Back: () => <p>back of {id}</p>,
    ...rest,
  }
}

function Picker({ label, items, selectedId, onSelect }: GroupPickerProps) {
  return (
    <nav aria-label={label}>
      {items.map((item) => (
        <button key={item.id} type="button" aria-pressed={item.id === selectedId} onClick={() => onSelect(item.id)}>{item.label}</button>
      ))}
    </nav>
  )
}
const Location = () => <p data-testid="location">{useLocation().search}</p>

function setDesktop(desktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: desktop && query.includes('min-width'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia
})

function renderGrid(cards: StatsCardDef<Payload>[], { entry = '/', picker = true, scopeKey = 'a' }: { entry?: string; picker?: boolean; scopeKey?: string } = {}) {
  const ui = (key: string) => (
    <MemoryRouter initialEntries={[entry]}>
      <StatsCardGrid payload={{ value: 1 }} ctx={ctx} cards={cards} groups={groups} basis={{ counted: 4, total: 5 }} scopeKey={key} renderGroupPicker={picker ? (props) => <Picker {...props} /> : undefined} />
      <Location />
    </MemoryRouter>
  )
  const view = render(ui(scopeKey))
  return { ...view, rerenderScope: (key: string) => view.rerender(ui(key)) }
}

const CARDS = [card('s1', 'summary', { size: 'compact' }), card('s2', 'summary', { size: 'compact', order: 2 }), card('b1', 'batting'), card('b2', 'batting', { order: 2 }), card('w1', 'bowling')]
const pillNames = () => within(screen.getByRole('navigation', { name: 'Card groups' })).getAllByRole('button').map((button) => button.textContent)

describe('StatsCardGrid groups', () => {
  it('shows a pill for every group with a card on every width, and one group at a time', () => {
    for (const desktop of [false, true]) {
      setDesktop(desktop)
      const { unmount } = renderGrid(CARDS)
      expect(pillNames()).toEqual(['Summary', 'Batting', 'Bowling'])
      expect(screen.getByRole('region', { name: 'Summary' })).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Batting' })).not.toBeInTheDocument()
      expect(screen.getByText('front of s1')).toBeInTheDocument()
      expect(screen.queryByText('front of b1')).not.toBeInTheDocument()
      unmount()
    }
  })

  it('switches group from a pill, writes it to ?group= and replaces the history entry', async () => {
    const user = userEvent.setup()
    renderGrid(CARDS)
    await user.click(screen.getByRole('button', { name: 'Batting' }))
    expect(screen.getByTestId('location')).toHaveTextContent('?group=batting')
    expect(screen.getByRole('region', { name: 'Batting' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Summary' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Batting' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens on the group named in the address, and falls back to the first group for an unknown one', () => {
    renderGrid(CARDS, { entry: '/?group=bowling' })
    expect(screen.getByRole('region', { name: 'Bowling' })).toBeInTheDocument()
    document.body.innerHTML = ''
    renderGrid(CARDS, { entry: '/?group=nonsense' })
    expect(screen.getByRole('region', { name: 'Summary' })).toBeInTheDocument()
  })

  it('opens on the first group that has data when the first groups are all empty', () => {
    renderGrid([card('s1', 'summary', { state: 'empty' }), card('b1', 'batting')])
    expect(screen.getByRole('region', { name: 'Batting' })).toBeInTheDocument()
  })

  it('gives no pill to a group whose only cards are missing and hidden, and no pill row for a single group', () => {
    renderGrid([card('s1', 'summary'), card('b1', 'batting', { state: 'missing' }), card('w1', 'bowling')])
    expect(pillNames()).toEqual(['Summary', 'Bowling'])
    document.body.innerHTML = ''
    renderGrid([card('s1', 'summary'), card('b1', 'batting', { state: 'missing' })])
    expect(screen.queryByRole('navigation', { name: 'Card groups' })).not.toBeInTheDocument()
    expect(screen.getByText('front of s1')).toBeInTheDocument()
  })

  it('shows every group one after another when the page passes no picker', () => {
    renderGrid(CARDS, { picker: false })
    for (const name of ['Summary', 'Batting', 'Bowling']) expect(screen.getByRole('region', { name })).toBeInTheDocument()
  })

  it('shows a missing card that asks for the not-captured state, and hides one that does not', () => {
    renderGrid([card('s1', 'summary', { state: 'missing', whenMissing: 'notCaptured', missingText: 'Not captured yet.' }), card('s2', 'summary', { state: 'missing', order: 2 })])
    expect(screen.getByTestId('card-s1')).toHaveAttribute('data-state', 'missing')
    expect(screen.getByText('Not captured yet.')).toBeInTheDocument()
    expect(screen.queryByTestId('card-s2')).not.toBeInTheDocument()
  })
})

describe('StatsCardGrid rows and cards', () => {
  it('lays the cards out in rows by kind', () => {
    renderGrid([card('b1', 'batting', { size: 'tall' }), card('b2', 'batting', { order: 2 }), card('b3', 'batting', { order: 3 }), card('b4', 'batting', { order: 4 })], { picker: false })
    const kinds = [...document.querySelectorAll('[data-row]')].map((row) => row.getAttribute('data-row'))
    expect(kinds).toEqual(['tall', 'single'])
  })

  it('passes the page basis to a card and lets a card bring its own', () => {
    renderGrid([card('s1', 'summary'), card('s2', 'summary', { order: 2, basis: () => ({ counted: 2, total: 9 }) })])
    expect(within(screen.getByTestId('card-s1')).getAllByTestId('stats-basis')[0]).toHaveTextContent('Based on 4 of 5 results')
    expect(within(screen.getByTestId('card-s2')).getAllByTestId('stats-basis')[0]).toHaveTextContent('Based on 2 of 9 results')
  })

  it('turns a throwing face into the quiet text and keeps every other card', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderGrid([card('s1', 'summary', { Front: () => { throw new Error('block absent') }, missingText: 'Not recorded yet.' }), card('s2', 'summary', { order: 2 })])
    expect(screen.getByText('Not recorded yet.')).toBeInTheDocument()
    expect(screen.getByText('front of s2')).toBeInTheDocument()
    quiet.mockRestore()
  })

  it('treats a state() that throws as missing: hidden, and the page survives', () => {
    renderGrid([{ ...card('s1', 'summary'), state: () => { throw new Error('block absent') } }, card('s2', 'summary', { order: 2 })])
    expect(screen.queryByTestId('card-s1')).not.toBeInTheDocument()
    expect(screen.getByTestId('card-s2')).toBeInTheDocument()
  })

  it('puts every card back on its front when the scope changes', async () => {
    const user = userEvent.setup()
    const { rerenderScope } = renderGrid(CARDS, { picker: false })
    await user.click(screen.getByRole('button', { name: 'Flip Card b1' }))
    expect(screen.getByRole('button', { name: 'Flip Card b1' })).toHaveAttribute('aria-pressed', 'true')
    rerenderScope('b')
    expect(screen.getByRole('button', { name: 'Flip Card b1' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('StatsCardGrid expand', () => {
  const expandButton = (id: string) => screen.getByRole('button', { name: `Expand Card ${id}` })

  it('offers no expand button below desktop', () => {
    setDesktop(false)
    renderGrid(CARDS, { picker: false })
    expect(screen.queryByRole('button', { name: /^Expand/ })).not.toBeInTheDocument()
  })

  it('opens a card in an overlay with its Front and Back together, takes focus into Close, and makes the cards underneath inert', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    renderGrid(CARDS)
    await user.click(screen.getByRole('button', { name: 'Batting' }))
    await user.click(expandButton('b1'))

    const overlay = await screen.findByRole('region', { name: 'Card b1, expanded' })
    expect(within(overlay).getByRole('button', { name: 'Close Card b1' })).toHaveFocus()
    expect(within(overlay).getByText('front of b1')).toBeInTheDocument()
    expect(within(overlay).getByText('back of b1')).toBeInTheDocument()
    expect(within(overlay).queryByRole('button', { name: /^Flip/ })).not.toBeInTheDocument()
    const underlying = screen.getByTestId('stats-card-grid-group-batting').closest('[inert]')
    expect(underlying).not.toBeNull()
    expect(screen.queryByRole('region', { name: 'Batting' })).not.toBeInTheDocument()
  })

  it('closes with the Close button and returns focus to the expand button that opened it', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    renderGrid(CARDS, { picker: false })
    await user.click(expandButton('b2'))
    await user.click(await screen.findByRole('button', { name: 'Close Card b2' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Card b2, expanded' })).not.toBeInTheDocument())
    expect(expandButton('b2')).toHaveFocus()
    expect(document.querySelector('[inert]')).toBeNull()
  })

  it('closes on Escape and returns focus', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    renderGrid(CARDS, { picker: false })
    await user.click(expandButton('b1'))
    await screen.findByRole('region', { name: 'Card b1, expanded' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Card b1, expanded' })).not.toBeInTheDocument())
    expect(expandButton('b1')).toHaveFocus()
  })

  it('closes the overlay when another group is chosen', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    renderGrid(CARDS)
    await user.click(expandButton('s1'))
    await screen.findByRole('region', { name: 'Card s1, expanded' })
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Bowling' }))
    expect(screen.queryByRole('region', { name: /expanded/ })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Bowling' })).toBeInTheDocument()
  })

  it('uses the card\'s own Expanded face instead of Front and Back together when it has one', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    renderGrid([card('b1', 'batting', { Expanded: () => <p>bespoke expanded</p> })], { picker: false })
    await user.click(expandButton('b1'))
    const overlay = await screen.findByRole('region', { name: 'Card b1, expanded' })
    expect(within(overlay).getByText('bespoke expanded')).toBeInTheDocument()
    expect(within(overlay).queryByText('front of b1')).not.toBeInTheDocument()
  })
})
