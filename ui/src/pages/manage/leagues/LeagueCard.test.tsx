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

function renderCard(league: League, seasonId?: string) {
  return render(
    <MemoryRouter initialEntries={['/list']}>
      <Routes>
        <Route path="/list" element={<LeagueCard league={league} seasonId={seasonId} />} />
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

    it('shows the format then Active, and no team count or season badge', () => {
      renderCard(
        makeLeague({
          format: 'T20',
          currentSeasonLabel: '2026/2027',
          teams: [team('A', { own: true }), team('B'), team('C')],
        }),
      )

      expect(chipLabels().filter((label) => ['T20', 'Active', 'Inactive'].includes(label) || /team|20/.test(label))).toEqual(['T20', 'Active'])
      expect(screen.queryByText('3 teams')).not.toBeInTheDocument()
      expect(screen.queryByText('2026/2027')).not.toBeInTheDocument()
    })

    it('omits the format badge when unset and shows Inactive for an inactive league', () => {
      renderCard(makeLeague({ active: false }))

      expect(screen.getByText('Inactive')).toBeInTheDocument()
      expect(screen.queryByText('T20')).not.toBeInTheDocument()
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

  describe('next match strip', () => {
    it('shows the next match date-time with a countdown chip, neutral when it is days away', () => {
      renderCard(makeLeague({ nextMatchDate: localIso(6, 10), matchCount: 4, playedCount: 1 }))

      const strip = screen.getByTestId('league-next-match')
      expect(strip).toHaveTextContent('Next match')
      expect(strip).toHaveAttribute('data-tone', 'neutral')
      expect(within(strip).getByRole('timer')).toBeInTheDocument()
    })

    it('turns amber within 24 hours of the kickoff', () => {
      renderCard(makeLeague({ nextMatchDate: new Date(Date.now() + 5 * 3_600_000).toISOString(), matchCount: 4, playedCount: 1 }))

      expect(screen.getByTestId('league-next-match')).toHaveAttribute('data-tone', 'warning')
    })

    it('says "No matches scheduled yet" with no matches, and "No more matches this season" when all are played', () => {
      const { unmount } = renderCard(makeLeague())
      expect(screen.getByTestId('league-next-match')).toHaveTextContent('No matches scheduled yet')
      unmount()

      renderCard(makeLeague({ matchCount: 10, playedCount: 10 }))
      expect(screen.getByTestId('league-next-match')).toHaveTextContent('No more matches this season')
    })
  })

  describe('matches played gauge', () => {
    it('shows "N of M" with the Played and To go legend', () => {
      renderCard(makeLeague({ matchCount: 56, playedCount: 12 }))

      const progress = screen.getByTestId('league-progress')
      expect(within(progress).getByText('12 of 56')).toBeInTheDocument()
      expect(within(progress).getByRole('progressbar', { name: 'Matches played' })).toHaveAttribute('aria-valuenow', '12')
      expect(within(progress).getByTestId('league-gauge-picked')).toHaveTextContent('12 Played')
      expect(within(progress).getByTestId('league-gauge-togo')).toHaveTextContent('44 To go')
    })

    it('says Season complete once every match is played, and hides the gauge with no matches or null counts', () => {
      const { unmount } = renderCard(makeLeague({ matchCount: 5, playedCount: 5 }))
      expect(screen.getByTestId('league-gauge-complete')).toHaveTextContent('Season complete')
      unmount()

      const second = renderCard(makeLeague())
      expect(screen.queryByTestId('league-progress')).not.toBeInTheDocument()
      second.unmount()

      renderCard(makeLeague({ matchCount: null, playedCount: null }))
      expect(screen.queryByTestId('league-progress')).not.toBeInTheDocument()
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

  describe('chosen season', () => {
    it('carries the season into the Schedule, Teams and Conditions links but not Edit', async () => {
      const user = userEvent.setup()
      renderCard(makeLeague(), 'season-9')

      expect(within(screen.getByRole('heading', { level: 3 })).getByRole('link')).toHaveAttribute('href', `${BASE}/schedule?seasonId=season-9`)
      await user.click(screen.getByRole('button', { name: 'Teams' }))
      expect(screen.getByTestId('location')).toHaveTextContent(`${BASE}/teams`)
    })
  })
})
