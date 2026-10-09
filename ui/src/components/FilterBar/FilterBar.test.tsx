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

  it('shows unset League and Team as an explicit "All" value under a floated label, like Section', () => {
    render(<FilterBar {...props()} />)
    expect(screen.getByLabelText('League')).toHaveTextContent('All leagues')
    expect(screen.getByLabelText('Team')).toHaveTextContent('All teams')
    for (const name of ['League', 'Section', 'Team']) {
      const label = screen.getAllByText(name, { selector: 'label' })[0]
      expect(label).toHaveAttribute('data-shrink', 'true')
    }
  })

  it('does not count or chip the "All" values as active filters on a phone', () => {
    setPhone(true)
    render(<FilterBar {...props()} />)
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove filter/ })).not.toBeInTheDocument()
  })

  it('shows the floated "All" values in the phone sheet too', async () => {
    setPhone(true)
    render(<FilterBar {...props()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }))
    expect(await screen.findByLabelText('League')).toHaveTextContent('All leagues')
    expect(screen.getByLabelText('Team')).toHaveTextContent('All teams')
    expect(screen.getAllByText('League', { selector: 'label' })[0]).toHaveAttribute('data-shrink', 'true')
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

const SEASONS = [
  { id: 's1', name: '2026/27' },
  { id: 's2', name: '2025/26' },
]

describe('FilterBar Season slot (docs/specs/087)', () => {
  it('shows Season between League and Section only when seasons are passed', () => {
    setPhone(false)
    const { unmount } = render(<FilterBar {...props()} />)
    expect(screen.queryByLabelText('Season')).not.toBeInTheDocument()
    unmount()

    render(<FilterBar {...props({ seasons: SEASONS, onSeasonChange: vi.fn() })} />)
    const labels = ['League', 'Season', 'Section', 'Team', 'Search'].map((name) => screen.getByLabelText(name))
    labels.slice(1).forEach((field, index) => {
      expect(labels[index].compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })

  it('shows the unset Season as the "All seasons" value, with the passed wording when given, and reports a choice', async () => {
    setPhone(false)
    const onSeasonChange = vi.fn()
    render(<FilterBar {...props({ seasons: SEASONS, onSeasonChange, seasonAllLabel: 'Every season' })} />)
    const season = screen.getByRole('combobox', { name: 'Season' })
    expect(season).toHaveTextContent('Every season')
    await userEvent.click(season)
    await userEvent.click(await screen.findByRole('option', { name: '2025/26' }))
    expect(onSeasonChange).toHaveBeenCalledWith('s2')
  })

  it('counts a chosen season in the phone badge with a removable chip, but never the "All" value', async () => {
    setPhone(true)
    const onSeasonChange = vi.fn()
    const { unmount } = render(<FilterBar {...props({ seasons: SEASONS, onSeasonChange })} />)
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument()
    unmount()

    render(<FilterBar {...props({ seasons: SEASONS, seasonId: 's1', onSeasonChange })} />)
    expect(screen.getByRole('button', { name: 'Filters, 1 active' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter 2026/27' }))
    expect(onSeasonChange).toHaveBeenCalledWith(null)
  })

  it('puts the Season field in the phone sheet', async () => {
    setPhone(true)
    render(<FilterBar {...props({ seasons: SEASONS, onSeasonChange: vi.fn() })} />)
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }))
    expect(await screen.findByRole('combobox', { name: 'Season' })).toBeInTheDocument()
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

describe('FilterBar density (085 I)', () => {
  const css = (element: HTMLElement) =>
    Array.from(document.querySelectorAll('style'))
      .flatMap((style) => Array.from(style.sheet?.cssRules ?? []))
      .map((rule) => rule.cssText)
      .filter((text) => Array.from(element.classList).some((name) => text.includes(`.${name}`)))
      .join('\n')

  it('keeps the original padding, gap and 40 px fields by default', () => {
    setPhone(false)
    render(<FilterBar {...props()} />)

    const fields = screen.getByTestId('filter-bar-fields')
    const panel = fields.parentElement as HTMLElement
    expect(getComputedStyle(panel).padding).toBe('16px')
    expect(getComputedStyle(fields).gap).toBe('16px')
    expect(css(fields)).not.toMatch(/36px/)
  })

  it('compact has an 8 px panel padding and gap and 36 px fields on desktop', () => {
    setPhone(false)
    render(<FilterBar {...props()} density="compact" />)

    const fields = screen.getByTestId('filter-bar-fields')
    const panel = fields.parentElement as HTMLElement
    expect(getComputedStyle(panel).padding).toBe('8px')
    expect(getComputedStyle(panel).gap).toBe('8px')
    expect(getComputedStyle(fields).gap).toBe('8px')
    expect(css(fields)).toMatch(/\.MuiOutlinedInput-root[^{]*\{[^}]*height:\s*36px/)
  })

  it('centres the value of the Select-based fields (League, Team) in the 36 px box, and only in compact', () => {
    setPhone(false)
    const { unmount } = render(<FilterBar {...props()} density="compact" />)
    const compactCss = css(screen.getByTestId('filter-bar-fields'))
    expect(compactCss).toMatch(/\.MuiSelect-select\.MuiOutlinedInput-input[^{]*\{[^}]*min-height:\s*0/)
    expect(compactCss).toMatch(/\.MuiSelect-select\.MuiOutlinedInput-input[^{]*\{[^}]*align-items:\s*center/)
    // Same floated label with the explicit "All ..." value as in the comfortable look.
    expect(screen.getByLabelText('League')).toHaveTextContent('All leagues')
    expect(screen.getByLabelText('Team')).toHaveTextContent('All teams')
    unmount()

    render(<FilterBar {...props()} />)
    expect(css(screen.getByTestId('filter-bar-fields'))).not.toMatch(/MuiSelect-select/)
  })

  it('the phone toolbar is unchanged by density: search plus Filters button, no 36 px fields', () => {
    setPhone(true)
    render(<FilterBar {...props()} density="compact" />)

    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument()
    expect(screen.queryByTestId('filter-bar-fields')).not.toBeInTheDocument()
  })
})
