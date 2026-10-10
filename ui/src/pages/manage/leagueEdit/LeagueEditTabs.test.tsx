import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LeagueEditTabs } from './LeagueEditTabs'
import { resolveLeagueEditTab } from './leagueEditTabConfig'

function Where() {
  const location = useLocation()
  const type = useNavigationType()
  return <div data-testid="where">{`${location.search}|${type}`}</div>
}

function renderTabs(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LeagueEditTabs />
      <Where />
    </MemoryRouter>,
  )
}

describe('LeagueEditTabs', () => {
  it('is a tablist of the five tabs in order, in sentence case', () => {
    renderTabs('/edit')

    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Details',
      'Teams',
      'Schedule',
      'Playing conditions',
      'Contacts',
    ])
  })

  it.each([
    ['teams', 'Teams'],
    ['schedule', 'Schedule'],
    ['conditions', 'Playing conditions'],
    ['contacts', 'Contacts'],
    ['details', 'Details'],
  ])('selects the %s tab from ?tab=', (value, label) => {
    renderTabs(`/edit?tab=${value}`)

    expect(screen.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true')
  })

  it('falls back to Details when the tab is missing or unknown', () => {
    const { unmount } = renderTabs('/edit')
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true')
    unmount()

    renderTabs('/edit?tab=nonsense')
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true')
  })

  it('switches with ?tab=, replacing the history entry and keeping the other parameters', async () => {
    const user = userEvent.setup()
    renderTabs('/edit?seasonId=season-2')

    await user.click(screen.getByRole('tab', { name: 'Teams' }))

    expect(screen.getByTestId('where')).toHaveTextContent('?seasonId=season-2&tab=teams|REPLACE')
    expect(screen.getByRole('tab', { name: 'Teams' })).toHaveAttribute('aria-selected', 'true')
  })

  it('resolveLeagueEditTab maps unknown values to details', () => {
    expect(resolveLeagueEditTab(null)).toBe('details')
    expect(resolveLeagueEditTab('x')).toBe('details')
    expect(resolveLeagueEditTab('conditions')).toBe('conditions')
  })
})
