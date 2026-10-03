import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { League, LeagueSeasonTeam } from '../../../api/leagueApi'
import { LeagueCard } from './LeagueCard'

function makeLeague(overrides: Partial<League> = {}): League {
  return {
    id: 'league-1',
    clubId: 'club-1',
    name: 'Riverside Premier League',
    source: 'INTERNAL',
    maxPlayingXiSize: 11,
    minAge: null,
    maxAge: null,
    ageCutoffDate: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    currentSeasonTeamCount: 0,
    currentSeasonLabel: null,
    currentSeasonPlayingConditionsUrl: null,
    matchCount: 0,
    playedCount: 0,
    firstMatchDate: null,
    lastMatchDate: null,
    nextMatchDate: null,
    teams: [],
    format: null,
    logoUrl: null,
    phone: null,
    website: null,
    email: null,
    socialLinks: [],
    ...overrides,
  }
}

function team(name: string, overrides: Partial<LeagueSeasonTeam> = {}): LeagueSeasonTeam {
  return { name, abbreviation: null, logoUrl: null, own: false, ...overrides }
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

function renderCard(league: League) {
  return render(
    <MemoryRouter initialEntries={['/list']}>
      <Routes>
        <Route path="/list" element={<LeagueCard league={league} />} />
        <Route path="*" element={<div>Elsewhere</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  )
}

// Local-calendar-day offsets so the "in N days" label does not depend on when the suite runs.
function localIso(dayOffset: number, hour = 12): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, 0, 0).toISOString()
}

function chipLabels(): string[] {
  return Array.from(document.querySelectorAll('.MuiChip-label')).map((el) => el.textContent ?? '')
}

const BASE = '/manage/fixtures/leagues/league-1'

describe('LeagueCard', () => {
  describe('header', () => {
    it('renders the league name as a heading that can wrap, linking to the Schedule', () => {
      renderCard(makeLeague({ name: 'A very long league name that needs to wrap over more than one line' }))

      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toHaveTextContent('A very long league name that needs to wrap over more than one line')
      expect(within(heading).getByRole('link')).toHaveAttribute('href', `${BASE}/schedule`)
    })

    it('orders the badges format, teams, season, Active', () => {
      renderCard(
        makeLeague({
          format: 'T20',
          currentSeasonLabel: '2026/2027',
          teams: [team('A', { own: true }), team('B'), team('C')],
        }),
      )

      expect(chipLabels()).toEqual(['T20', '3 teams', '2026/2027', 'Active'])
    })

    it('omits the format and season badges when unset, singularises "1 team" and shows Inactive', () => {
      renderCard(makeLeague({ active: false, teams: [team('A', { own: true })] }))

      expect(chipLabels()).toEqual(['1 team', 'Inactive'])
    })

    it('counts the team badge from the teams list, and treats null teams as zero', () => {
      renderCard(makeLeague({ teams: null, currentSeasonTeamCount: 9 }))

      expect(chipLabels()).toEqual(['0 teams', 'Active'])
    })

    it('uses the logo in the avatar when set, and the trophy icon otherwise', () => {
      const { unmount } = renderCard(makeLeague({ logoUrl: 'https://example.com/logo.png' }))
      expect(document.querySelector('.MuiAvatar-root img')).toHaveAttribute('src', 'https://example.com/logo.png')
      unmount()

      renderCard(makeLeague({ logoUrl: null }))
      const avatar = document.querySelector('.MuiAvatar-root')
      expect(avatar?.querySelector('img')).not.toBeInTheDocument()
      expect(avatar?.querySelector('[data-testid="EmojiEventsOutlinedIcon"]')).toBeInTheDocument()
    })
  })

  describe('detail lines', () => {
    it('shows the first and last match dates, and the same date for both when there is a single match', () => {
      const iso = localIso(10)
      const expected = new Date(iso).toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
      renderCard(makeLeague({ matchCount: 1, firstMatchDate: iso, lastMatchDate: iso }))

      expect(screen.getAllByText(expected)).toHaveLength(2)
    })

    it('shows "Not scheduled yet" (muted) for First and Last match, and "None scheduled" for Next, when there are none', () => {
      renderCard(makeLeague())

      expect(screen.getAllByText('Not scheduled yet')).toHaveLength(2)
      expect(screen.getByText('None scheduled')).toBeInTheDocument()
      expect(screen.getByText('None scheduled')).toHaveStyle({ fontWeight: '400' })
    })

    it('lists Last match directly after Next match', () => {
      renderCard(makeLeague())

      const labels = ['First match', 'Next match', 'Last match', 'Playing XI'].map((text) => screen.getByText(text))
      for (let i = 0; i < labels.length - 1; i += 1) {
        expect(labels[i].compareDocumentPosition(labels[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      }
    })

    it('shows the next match date-time with an "in N days" badge', () => {
      renderCard(makeLeague({ nextMatchDate: localIso(5) }))

      expect(screen.getByText('in 5 days')).toBeInTheDocument()
      expect(screen.queryByText('None scheduled')).not.toBeInTheDocument()
    })

    it('labels a next match tomorrow and today', () => {
      const { unmount } = renderCard(makeLeague({ nextMatchDate: localIso(1) }))
      expect(screen.getByText('tomorrow')).toBeInTheDocument()
      unmount()

      renderCard(makeLeague({ nextMatchDate: localIso(0, 23) }))
      expect(screen.getByText('today')).toBeInTheDocument()
    })

    it('always shows Playing XI as "N players"', () => {
      renderCard(makeLeague({ maxPlayingXiSize: 9 }))

      expect(screen.getByText('9 players')).toBeInTheDocument()
    })

    it('omits Age range when neither bound is set', () => {
      renderCard(makeLeague())

      expect(screen.queryByText('Age range')).not.toBeInTheDocument()
    })

    it('shows both age bounds, and "Any" for a missing one', () => {
      const { unmount } = renderCard(makeLeague({ minAge: 12, maxAge: 16 }))
      expect(screen.getByText('12–16')).toBeInTheDocument()
      unmount()

      const second = renderCard(makeLeague({ minAge: 18, maxAge: null }))
      expect(screen.getByText('18–Any')).toBeInTheDocument()
      second.unmount()

      renderCard(makeLeague({ minAge: null, maxAge: 14 }))
      expect(screen.getByText('Any–14')).toBeInTheDocument()
    })
  })

  describe('progress block', () => {
    it('shows "N of M", the bar value and "N played · K to go"', () => {
      renderCard(makeLeague({ matchCount: 12, playedCount: 5 }))

      expect(screen.getByText('5 of 12')).toBeInTheDocument()
      const bar = screen.getByRole('progressbar', { name: 'Matches played' })
      expect(bar).toHaveAttribute('aria-valuenow', '5')
      expect(bar).toHaveAttribute('aria-valuemax', '12')
      expect(screen.getByText('5 played · 7 to go')).toBeInTheDocument()
    })

    it('shows "0 of 0", an empty bar and "No matches scheduled yet" when nothing is scheduled', () => {
      renderCard(makeLeague({ matchCount: 0, playedCount: 0 }))

      expect(screen.getByText('0 of 0')).toBeInTheDocument()
      expect(screen.getByTestId('selection-bar-fill')).toHaveStyle({ width: '0%' })
      expect(screen.getByText('No matches scheduled yet')).toBeInTheDocument()
    })

    it('treats null counts as zero', () => {
      renderCard(makeLeague({ matchCount: null, playedCount: null }))

      expect(screen.getByText('0 of 0')).toBeInTheDocument()
      expect(screen.getByText('No matches scheduled yet')).toBeInTheDocument()
    })
  })

  describe('team avatars', () => {
    it('keeps the order received (own first, then league teams)', () => {
      renderCard(
        makeLeague({
          teams: [team('Riverside 1st XI', { own: true }), team('Riverside 2nd XI', { own: true }), team('Hawks CC')],
        }),
      )

      expect(screen.getAllByRole('listitem').map((el) => el.getAttribute('aria-label'))).toEqual([
        'Riverside 1st XI',
        'Riverside 2nd XI',
        'Hawks CC',
      ])
    })

    it('exposes the full team name as the title and accessible name', () => {
      renderCard(makeLeague({ teams: [team('Hawks Cricket Club', { abbreviation: 'HCC' })] }))

      const item = screen.getByLabelText('Hawks Cricket Club')
      expect(item).toHaveAttribute('title', 'Hawks Cricket Club')
    })

    it('shows the logo when present, else the abbreviation, else the initials of the name', () => {
      renderCard(
        makeLeague({
          teams: [
            team('Logo Team', { logoUrl: 'https://example.com/t.png', abbreviation: 'LGT' }),
            team('Abbrev Team', { abbreviation: 'ABT' }),
            team('Plain Wanderers'),
          ],
        }),
      )

      const [logo, abbrev, plain] = screen.getAllByRole('listitem')
      expect(logo.querySelector('img')).toHaveAttribute('src', 'https://example.com/t.png')
      expect(within(abbrev).getAllByText('ABT')).toHaveLength(2) // inside the avatar and as the caption
      expect(abbrev.querySelector('img')).not.toBeInTheDocument()
      expect(within(plain).getAllByText('PW')).toHaveLength(2)
    })

    it('styles own teams solid and league teams neutral with a border', () => {
      renderCard(makeLeague({ teams: [team('Own', { own: true }), team('Other')] }))

      const [own, other] = screen.getAllByRole('listitem').map((el) => el.querySelector('.MuiAvatar-root') as HTMLElement)
      expect(getComputedStyle(own).backgroundColor).not.toBe(getComputedStyle(other).backgroundColor)
      expect(getComputedStyle(other).borderStyle).toBe('solid')
    })

    it('shows every team with no cap and no "+N" for 20 teams', () => {
      renderCard(makeLeague({ teams: Array.from({ length: 20 }, (_, i) => team(`Team ${i + 1}`)) }))

      expect(screen.getAllByRole('listitem')).toHaveLength(20)
      expect(screen.queryByText(/^\+\d+/)).not.toBeInTheDocument()
    })

    it('shows the empty copy for no teams, or null teams', () => {
      const { unmount } = renderCard(makeLeague({ teams: [] }))
      expect(screen.getByText('No teams registered for this season')).toBeInTheDocument()
      unmount()

      renderCard(makeLeague({ teams: null }))
      expect(screen.getByText('No teams registered for this season')).toBeInTheDocument()
    })
  })

  describe('social links', () => {
    it('omits the row when there is no website or social link', () => {
      renderCard(makeLeague())

      expect(screen.queryByRole('link', { name: 'Website' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Facebook' })).not.toBeInTheDocument()
    })

    it('puts the website icon first, then the social links in stored order', () => {
      renderCard(
        makeLeague({
          website: 'https://league.example.com',
          socialLinks: [
            { platform: 'facebook', url: 'https://facebook.com/league' },
            { platform: 'x', url: 'https://x.com/league' },
          ],
        }),
      )

      const names = screen
        .getAllByRole('link')
        .map((el) => el.getAttribute('aria-label'))
        .filter((name): name is string => name !== null)
      expect(names).toEqual(['Website', 'Facebook', 'X'])
      expect(screen.getByRole('link', { name: 'Website' })).toHaveAttribute('href', 'https://league.example.com')
    })

    it('renders a row with only a website, or only social links', () => {
      const { unmount } = renderCard(makeLeague({ website: 'https://league.example.com' }))
      expect(screen.getByRole('link', { name: 'Website' })).toBeInTheDocument()
      unmount()

      renderCard(makeLeague({ socialLinks: [{ platform: 'instagram', url: 'https://instagram.com/league' }] }))
      expect(screen.getByRole('link', { name: 'Instagram' })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Website' })).not.toBeInTheDocument()
    })

    it('lifts the links above the stretched card link with a positioned wrapper', () => {
      renderCard(makeLeague({ website: 'https://league.example.com' }))

      const wrapper = screen.getByTestId('league-social-links')
      expect(wrapper).toHaveStyle({ position: 'relative' })
      expect(within(wrapper).getByRole('link', { name: 'Website' })).toBeInTheDocument()
    })
  })

  describe('footer and card click', () => {
    it('renders Schedule, Teams, Conditions and Edit in that order, and no Playing Conditions action', () => {
      renderCard(makeLeague({ currentSeasonPlayingConditionsUrl: '/media/pc.pdf' }))

      const labels = ['Schedule', 'Teams', 'Conditions', 'Edit'].map((name) => screen.getByRole('button', { name }))
      for (let i = 0; i < labels.length - 1; i += 1) {
        expect(labels[i].compareDocumentPosition(labels[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      }
      expect(screen.queryByRole('button', { name: 'Playing Conditions' })).not.toBeInTheDocument()
    })

    it.each([
      ['Schedule', `${BASE}/schedule`],
      ['Teams', `${BASE}/teams`],
      ['Conditions', `${BASE}/conditions`],
      ['Edit', `${BASE}/edit`],
    ])('the %s button navigates to %s', async (name, path) => {
      const user = userEvent.setup()
      renderCard(makeLeague())

      await user.click(screen.getByRole('button', { name }))

      expect(screen.getByTestId('location')).toHaveTextContent(path)
    })

    it('keeps Conditions enabled even with no conditions or PDF', () => {
      renderCard(makeLeague({ currentSeasonPlayingConditionsUrl: null }))

      expect(screen.getByRole('button', { name: 'Conditions' })).toBeEnabled()
    })

    it('opens the Schedule when the card title link is clicked', async () => {
      const user = userEvent.setup()
      renderCard(makeLeague())

      await user.click(screen.getByRole('link', { name: 'Riverside Premier League' }))

      expect(screen.getByTestId('location')).toHaveTextContent(`${BASE}/schedule`)
    })
  })
})
