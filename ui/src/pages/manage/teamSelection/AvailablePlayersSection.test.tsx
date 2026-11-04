import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AvailablePlayersSection } from './AvailablePlayersSection'
import type { SelectionPoolEntry } from '../../../api/matchSelectionApi'

function entry(id: string, first: string, overrides: Partial<SelectionPoolEntry> = {}): SelectionPoolEntry {
  return { playerProfileId: id, firstName: first, lastName: 'Smith', jerseyNumber: null, availability: 'AVAILABLE', selected: false, selectable: true, reason: null, reasonText: null, taken: null, ...overrides }
}

const entries = [
  entry('a', 'Ann'),
  entry('b', 'Bob', { selected: true }),
  entry('c', 'Cy', { availability: 'UNSURE', selectable: false, reason: 'NOT_CONFIRMED' }),
  entry('d', 'Dee', { availability: 'NOT_POLLED' }),
  entry('e', 'Eve', { selectable: false, reason: 'TAKEN_FOR_SLOT' }),
  entry('f', 'Flo'),
]

function renderSection(props: Partial<React.ComponentProps<typeof AvailablePlayersSection>> = {}) {
  return render(
    <MemoryRouter>
      <AvailablePlayersSection entries={entries} selectedCount={3} maxSelected={11} onSelectOtherPlayer={vi.fn()} onCreatePlayer={vi.fn()} onAddPlayer={vi.fn()} {...props} />
    </MemoryRouter>,
  )
}

describe('AvailablePlayersSection', () => {
  it('adds the player to the team when their block is clicked, and shows the server reason when it is refused', async () => {
    const onAddPlayer = vi.fn()
    const { rerender } = renderSection({ onAddPlayer })
    await userEvent.click(screen.getByRole('button', { name: 'Add Ann Smith to the team' }))
    expect(onAddPlayer).toHaveBeenCalledWith('a')
    rerender(
      <MemoryRouter>
        <AvailablePlayersSection entries={entries} selectedCount={3} maxSelected={11} onSelectOtherPlayer={vi.fn()} onCreatePlayer={vi.fn()} onAddPlayer={onAddPlayer} addError="Ann cannot be selected." />
      </MemoryRouter>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Ann cannot be selected.')
  })

  it('does not add while one is being added, or when the team is full', () => {
    renderSection({ addingId: 'a' })
    expect(screen.getByRole('button', { name: 'Add Flo Smith to the team' })).toBeDisabled()
  })

  it('lists only players who are available and eligible but not selected, drawn faded with dashed edges', () => {
    renderSection()
    const rows = screen.getAllByTestId('available-player')
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual(['Add Ann Smith to the team', 'Add Flo Smith to the team'])
    expect(rows[0]).toHaveStyle({ opacity: '0.72', borderStyle: 'dashed' })
    expect(screen.getByText('2 not selected')).toBeInTheDocument()
  })

  it('is open when the team has room', () => {
    renderSection({ selectedCount: 3, maxSelected: 11 })
    expect(screen.getAllByTestId('available-player')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Hide available players' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('is closed on arrival when the team is full, and the manager can open it', async () => {
    renderSection({ selectedCount: 11, maxSelected: 11 })
    expect(screen.queryByTestId('available-player')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show available players' }))
    expect(await screen.findAllByTestId('available-player')).toHaveLength(2)
  })

  it('has a Select Other Player button that opens the Select Players dialog', async () => {
    const onSelectOtherPlayer = vi.fn()
    renderSection({ onSelectOtherPlayer })
    await userEvent.click(screen.getByRole('button', { name: 'Select Other Player' }))
    expect(onSelectOtherPlayer).toHaveBeenCalledTimes(1)
  })

  it('shows ONE "Team is full" message for the section when the team is full, and none otherwise', async () => {
    const { rerender } = renderSection({ selectedCount: 3, maxSelected: 11 })
    expect(screen.queryByTestId('available-full-message')).not.toBeInTheDocument()
    rerender(
      <MemoryRouter>
        <AvailablePlayersSection entries={entries} selectedCount={11} maxSelected={11} onSelectOtherPlayer={vi.fn()} onCreatePlayer={vi.fn()} onAddPlayer={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getAllByTestId('available-full-message')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Show available players' }))
    expect(screen.getAllByTestId('available-full-message')).toHaveLength(1)
  })

  it('has a Create New Player button beside Select Other Player', async () => {
    const onCreatePlayer = vi.fn()
    renderSection({ onCreatePlayer })
    await userEvent.click(screen.getByRole('button', { name: 'Create New Player' }))
    expect(onCreatePlayer).toHaveBeenCalledTimes(1)
  })

  it('says so when nobody else is available', () => {
    renderSection({ entries: [entry('b', 'Bob', { selected: true })] })
    expect(screen.getByText('No other available players.')).toBeInTheDocument()
  })
})
