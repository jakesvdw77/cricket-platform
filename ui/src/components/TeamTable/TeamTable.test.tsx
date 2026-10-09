import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { TeamTable } from './TeamTable'
import type { TeamTableRow } from './TeamTable'
import type { Team } from '../../api/teamApi'

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    clubId: 'club-1',
    sectionId: 'section-1',
    name: '1st XI',
    logoUrl: null,
    abbreviation: null,
    groundName: null,
    socialLinks: [],
    active: true,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    ...overrides,
  }
}

function makeRow(overrides: Partial<TeamTableRow> = {}): TeamTableRow {
  return {
    team: makeTeam(),
    sectionName: 'Men',
    playerCount: 14,
    matchCount: 8,
    captainName: 'Jane Smith',
    loaded: true,
    to: '/manage/sections/section-1/teams/team-1',
    ...overrides,
  }
}

function renderTable(rows: TeamTableRow[]) {
  return render(
    <MemoryRouter>
      <TeamTable rows={rows} />
    </MemoryRouter>,
  )
}

describe('TeamTable', () => {
  it('renders the header and a row per team with section, players, matches, captain and status', () => {
    renderTable([makeRow(), makeRow({ team: makeTeam({ id: 'team-2', name: '2nd XI', active: false }), captainName: null })])

    expect(screen.getByRole('table', { name: 'Teams' })).toBeInTheDocument()
    for (const name of ['Team', 'Section', 'Players', 'Matches', 'Captain', 'Status']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    const [first, second] = screen.getAllByTestId('team-row')
    expect(within(first).getByTestId('team-row-section')).toHaveTextContent('Men')
    expect(within(first).getByTestId('team-row-players')).toHaveTextContent('14')
    expect(within(first).getByTestId('team-row-matches')).toHaveTextContent('8')
    expect(within(first).getByTestId('team-row-captain')).toHaveTextContent('Jane Smith')
    expect(within(first).getByTestId('team-row-status')).toHaveTextContent('Active')
    expect(within(second).getByTestId('team-row-status')).toHaveTextContent('Inactive')
  })

  it('shows "No captain" for a loaded team without one, and dashes while the data is loading', () => {
    renderTable([makeRow({ captainName: null }), makeRow({ team: makeTeam({ id: 'team-2' }), loaded: false, captainName: null, playerCount: 0 })])

    const [noCaptain, loading] = screen.getAllByTestId('team-row')
    expect(within(noCaptain).getByTestId('team-row-captain')).toHaveTextContent('No captain')
    expect(within(loading).getByTestId('team-row-captain')).toHaveTextContent('–')
    expect(within(loading).getByTestId('team-row-players')).toHaveTextContent('–')
    expect(within(loading).getByTestId('team-row-matches')).toHaveTextContent('–')
  })

  it('keeps the desktop-only columns marked so a phone can drop them, and shows the phone meta line', () => {
    renderTable([makeRow()])

    const row = screen.getByTestId('team-row')
    for (const id of ['team-row-section', 'team-row-matches', 'team-row-captain', 'team-row-status']) {
      expect(within(row).getByTestId(id)).toHaveAttribute('data-desktop-only', 'true')
    }
    expect(within(row).getByTestId('team-row-players')).not.toHaveAttribute('data-desktop-only')
    expect(within(row).getByTestId('team-row-phone-meta')).toHaveTextContent('Men · Active')
  })

  it('links the whole row to the row target', () => {
    renderTable([makeRow({ to: '/manage/sections/section-1/teams/team-1?from=section' })])
    expect(screen.getByRole('link', { name: '1st XI' })).toHaveAttribute(
      'href',
      '/manage/sections/section-1/teams/team-1?from=section',
    )
  })
})
