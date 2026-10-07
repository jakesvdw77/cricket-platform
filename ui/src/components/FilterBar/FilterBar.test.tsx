import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FilterBar } from './FilterBar'
import type { FilterBarProps } from './FilterBar'
import type { Section } from '../../api/sectionApi'

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

function section(id: string, name: string, parentSectionId: string | null = null): Section {
  return {
    id,
    clubId: 'club-1',
    parentSectionId,
    name,
    minAge: null,
    maxAge: null,
    gender: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
  }
}

const SECTIONS = [section('vets', 'Vets'), section('over40', 'Over 40', 'vets')]
const LEAGUES = [{ id: 'l1', name: 'Over 40 League' }]
const TEAMS = [{ id: 't1', name: 'Villagers 1' }]

function props(overrides: Partial<FilterBarProps> = {}): FilterBarProps {
  return {
    leagues: LEAGUES,
    sections: SECTIONS,
    teams: TEAMS,
    onLeagueChange: vi.fn(),
    onSectionChange: vi.fn(),
    onTeamChange: vi.fn(),
    onSearchChange: vi.fn(),
    searchPlaceholder: 'Search players',
    onClearAll: vi.fn(),
    ...overrides,
  }
}

describe('FilterBar on desktop (docs/specs/083)', () => {
  it('shows League, Section, Team, then Search, in that order, with no Filters button', () => {
    setPhone(false)
    render(<FilterBar {...props()} />)
    const labels = ['League', 'Section', 'Team', 'Search'].map((name) => screen.getByLabelText(name))
    labels.slice(1).forEach((field, index) => {
      expect(labels[index].compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
    expect(screen.queryByRole('button', { name: /^Filters/ })).not.toBeInTheDocument()
  })

  it('omits a filter whose options are not passed, and the search without a handler', () => {
    setPhone(false)
    render(<FilterBar {...props({ teams: undefined, onSearchChange: undefined })} />)
    expect(screen.getByLabelText('League')).toBeInTheDocument()
    expect(screen.getByLabelText('Section')).toBeInTheDocument()
    expect(screen.queryByLabelText('Team')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Search')).not.toBeInTheDocument()
  })

  it('reports a League choice and typed search text', async () => {
    setPhone(false)
    const onLeagueChange = vi.fn()
    const onSearchChange = vi.fn()
    render(<FilterBar {...props({ onLeagueChange, onSearchChange })} />)
    await userEvent.click(screen.getByLabelText('League'))
    await userEvent.click(await screen.findByRole('option', { name: 'Over 40 League' }))
    expect(onLeagueChange).toHaveBeenCalledWith('l1')
    await userEvent.type(screen.getByLabelText('Search'), 'a')
    expect(onSearchChange).toHaveBeenCalledWith('a')
  })

  it('the Team field uses the passed "all" wording', async () => {
    setPhone(false)
    render(<FilterBar {...props({ teamAllLabel: 'All teams in section' })} />)
    await userEvent.click(screen.getByLabelText('Team'))
    expect(await screen.findByRole('option', { name: 'All teams in section' })).toBeInTheDocument()
  })
})

describe('FilterBar on a phone (docs/specs/083)', () => {
  it('shows search and a Filters button, with the fields behind the sheet', () => {
    setPhone(true)
    render(<FilterBar {...props()} />)
    expect(screen.getByLabelText('Search')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filters' })).toHaveAttribute('aria-expanded', 'false')
    // The closed sheet stays mounted but hidden (SwipeableDrawer), so it is not in the accessibility tree.
    expect(screen.queryByRole('combobox', { name: 'League' })).not.toBeInTheDocument()
  })

  it('counts the active filters in the badge and its accessible name, with removable chips', async () => {
    setPhone(true)
    const onSectionChange = vi.fn()
    const onLeagueChange = vi.fn()
    render(
      <FilterBar
        {...props({ leagueId: 'l1', sectionId: 'over40', onSectionChange, onLeagueChange })}
      />,
    )
    const button = screen.getByRole('button', { name: 'Filters, 2 active' })
    expect(within(button).getByText('2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter Vets › Over 40' }))
    expect(onSectionChange).toHaveBeenCalledWith(null)
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter Over 40 League' }))
    expect(onLeagueChange).toHaveBeenCalledWith(null)
  })

  it('counts and shows a view-specific chip too', async () => {
    setPhone(true)
    const onRemove = vi.fn()
    render(<FilterBar {...props({ extraChips: [{ key: 'type', label: 'Group polls only', onRemove }] })} />)
    expect(screen.getByRole('button', { name: 'Filters, 1 active' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter Group polls only' }))
    expect(onRemove).toHaveBeenCalled()
  })

  it('opens a labelled sheet with the fields, the view controls, Clear all and Done', async () => {
    setPhone(true)
    const onClearAll = vi.fn()
    render(<FilterBar {...props({ onClearAll, viewControls: <button type="button">Show closed polls</button> })} />)
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }))
    expect(await screen.findByLabelText('League')).toBeInTheDocument()
    expect(screen.getByLabelText('Section')).toBeInTheDocument()
    expect(screen.getByLabelText('Team')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show closed polls' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(onClearAll).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => // The closed sheet stays mounted but hidden (SwipeableDrawer), so it is not in the accessibility tree.
    expect(screen.queryByRole('combobox', { name: 'League' })).not.toBeInTheDocument())
  })

  it('stacks the sheet fields full width with no flex basis (which would become a height in the column)', async () => {
    setPhone(true)
    render(<FilterBar {...props()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }))
    const container = await screen.findByTestId('filter-sheet-fields')
    expect(container).toHaveStyle({ flexDirection: 'column' })
    const fieldWrapper = (await screen.findByLabelText('League')).closest('.MuiFormControl-root')?.parentElement as HTMLElement
    expect(fieldWrapper.parentElement).toBe(container)
    expect(fieldWrapper).not.toHaveStyle({ flex: '1 1 160px' })
  })
})
