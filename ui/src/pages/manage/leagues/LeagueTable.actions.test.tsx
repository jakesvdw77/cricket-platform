import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LeagueTable } from './LeagueTable'
import type { League } from '../../../api/leagueApi'

function makeLeague(overrides: Partial<League> = {}): League {
  return {
    id: 'league-1',
    clubId: 'club-1',
    name: 'TVL Division 1',
    source: 'INTERNAL',
    maxPlayingXiSize: 11,
    minAge: null,
    maxAge: null,
    ageCutoffMonth: null,
    ageCutoffDay: null,
    active: true,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    currentSeasonTeamCount: 8,
    currentSeasonLabel: '2026/2027',
    currentSeasonPlayingConditionsUrl: null,
    matchCount: 56,
    playedCount: 12,
    firstMatchDate: null,
    lastMatchDate: null,
    nextMatchDate: '2026-10-15T07:15:00',
    teams: Array.from({ length: 8 }, (_, i) => ({ name: `Team ${i}`, abbreviation: null, logoUrl: null, own: i < 2 })),
    format: 'T20',
    logoUrl: null,
    phone: null,
    website: null,
    email: null,
    socialLinks: [],
    ...overrides,
  }
}

function renderTable(leagues: League[], seasonId?: string, handlers: { onDuplicate?: (league: League) => void; onShare?: (league: League) => void } = {}, entry = '/start') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path={entry} element={<LeagueTable leagues={leagues} seasonId={seasonId} {...handlers} />} />
        <Route path="*" element={<p>Schedule Page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

// docs/standards/page-anatomy.md section 6: the Leagues list's one Actions kebab per row.
describe('LeagueTable Actions kebab', () => {
  it('has ONE Actions kebab per row whose menu lists the row\'s actions, and no Duplicate without a handler', async () => {
    renderTable([makeLeague(), makeLeague({ id: 'league-2', name: 'Vets League' })], 'season-1')

    expect(screen.getAllByRole('button', { name: /^Actions for / })).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Vets League' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Open League',
      'Edit League Details',
      'Open Schedule',
      'Open Teams',
      'Open Playing Conditions',
      'Add Match',
      'Import Schedule',
    ])
    expect(screen.getByRole('menuitem', { name: 'Add Match' })).toHaveAttribute('href', expect.stringContaining('leagueId=league-2&seasonId=season-1'))
  })

  it('adds Duplicate League when the page gives a handler, and runs it for that row', async () => {
    const onDuplicate = vi.fn()
    renderTable([makeLeague({ id: 'league-2', name: 'Vets League' })], undefined, { onDuplicate })
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Vets League' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate League' }))
    await vi.waitFor(() => expect(onDuplicate).toHaveBeenCalledWith(expect.objectContaining({ id: 'league-2' })))
  })

  it('disables Add Match and Import Schedule with their reasons without a season', async () => {
    renderTable([makeLeague()])
    await userEvent.click(screen.getByRole('button', { name: /^Actions for / }))
    expect(screen.getByRole('menuitem', { name: /Add Match/ })).toHaveTextContent('Create a season first')
    expect(screen.getByRole('menuitem', { name: /Import Schedule/ })).toHaveTextContent('Create a season first')
  })

  it('the kebab is a separate target from the row link: clicking it opens the menu and does not navigate', async () => {
    renderTable([makeLeague()], 'season-1')
    await userEvent.click(screen.getByRole('button', { name: /^Actions for / }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.queryByText('Schedule Page')).not.toBeInTheDocument()
  })

})

// docs/specs/127-return-navigation.md
describe('LeagueTable return navigation (127)', () => {
  it('the row link and menu items carry the Leagues list as the origin, and a row has no chevron', async () => {
    renderTable([makeLeague()], 'season-1', {}, '/manage/fixtures/leagues')
    const origin = (href: string | null) => {
      const params = new URLSearchParams((href ?? '').split('?')[1])
      return { to: params.get('returnTo'), label: params.get('returnLabel') }
    }
    const expected = { to: '/manage/fixtures/leagues', label: 'Leagues' }

    expect(origin(screen.getByRole('link', { name: 'TVL Division 1' }).getAttribute('href'))).toEqual(expected)
    expect(screen.getByTestId('league-row').querySelector('[data-testid="ChevronRightOutlinedIcon"]')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Actions for TVL Division 1' }))
    for (const item of screen.getAllByRole('menuitem')) expect(origin(item.getAttribute('href'))).toEqual(expected)
  })
})
