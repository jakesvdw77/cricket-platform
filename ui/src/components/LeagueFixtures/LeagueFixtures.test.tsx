import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LeagueFixtures } from './LeagueFixtures'
import type { Match } from '../../api/matchApi'
import type { Team } from '../../api/teamApi'

// docs/specs/050-league-schedule-and-fixtures.md item 24: reuses the same realistic Irene
// Villagers/Riverside/Centurion/Wanderers fixture data shape LeagueFixtures.stories.tsx already
// uses, for consistency.
const IRENE_VILLAGERS_1: Team = {
  id: 'team-iv1',
  clubId: 'club-1',
  sectionId: 'section-1',
  name: 'Irene Villagers 1st XI',
  logoUrl: 'https://example.com/irene-villagers.png',
  abbreviation: null,
  groundName: null,
  socialLinks: [],
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: null,
}

const IRENE_VILLAGERS_2: Team = {
  id: 'team-iv2',
  clubId: 'club-1',
  sectionId: 'section-1',
  name: 'Irene Villagers 2nd XI',
  logoUrl: null,
  abbreviation: null,
  groundName: null,
  socialLinks: [],
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: null,
}

const TEAMS_BY_ID = new Map<string, Team>([
  [IRENE_VILLAGERS_1.id, IRENE_VILLAGERS_1],
  [IRENE_VILLAGERS_2.id, IRENE_VILLAGERS_2],
])

function makeMatch(overrides: Partial<Match> & Pick<Match, 'id' | 'matchDate'>): Match {
  return {
    clubId: 'club-1',
    homeTeamId: null,
    homeTeamName: null,
    awayTeamId: null,
    awayTeamName: null,
    homeTeamLogoUrl: null,
    awayTeamLogoUrl: null,
    leagueId: 'league-1',
    seasonId: 'season-1',
    venue: null,
    active: true,
    homeSideAnnounced: false,
    awaySideAnnounced: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

describe('LeagueFixtures', () => {
  it('renders the empty state when there are no matches', () => {
    render(<LeagueFixtures matches={[]} teamsById={TEAMS_BY_ID} />)

    expect(screen.getByText('No fixtures yet')).toBeInTheDocument()
  })

  it('resolves a real Team\'s name and logo via id lookup against teamsById', () => {
    const { container } = render(
      <LeagueFixtures
        matches={[
          makeMatch({
            id: 'match-1',
            matchDate: '2026-03-14T14:00:00Z',
            homeTeamId: IRENE_VILLAGERS_1.id,
            awayTeamName: 'Riverside Occasionals',
          }),
        ]}
        teamsById={TEAMS_BY_ID}
      />,
    )

    expect(screen.getByText('Irene Villagers 1st XI')).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/irene-villagers.png')
  })

  it('renders an external opponent\'s own name and logo when one is set', () => {
    const { container } = render(
      <LeagueFixtures
        matches={[
          makeMatch({
            id: 'match-1',
            matchDate: '2026-03-14T14:00:00Z',
            homeTeamId: IRENE_VILLAGERS_1.id,
            awayTeamName: 'Riverside Occasionals',
            awayTeamLogoUrl: '/media/riverside-occasionals-logo.png',
          }),
        ]}
        teamsById={TEAMS_BY_ID}
      />,
    )

    expect(screen.getByText('Riverside Occasionals')).toBeInTheDocument()
    const images = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'))
    expect(images).toContain('/media/riverside-occasionals-logo.png')
  })

  it('falls back to initials for an external opponent with no logo', () => {
    render(
      <LeagueFixtures
        matches={[
          makeMatch({
            id: 'match-1',
            matchDate: '2026-03-14T10:00:00Z',
            homeTeamId: IRENE_VILLAGERS_2.id,
            awayTeamName: 'Centurion Thursdays',
          }),
        ]}
        teamsById={TEAMS_BY_ID}
      />,
    )

    expect(screen.getByText('Centurion Thursdays')).toBeInTheDocument()
    // No <img> anywhere for the away side — the initials fallback ("CE", the first two letters of
    // "Centurion Thursdays") renders as plain text inside the Avatar instead.
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('CE')).toBeInTheDocument()
  })

  it('groups matches under distinct date headings, ordering same-day matches earliest first', () => {
    render(
      <LeagueFixtures
        matches={[
          makeMatch({
            id: 'match-1',
            matchDate: '2026-03-14T14:00:00Z',
            homeTeamId: IRENE_VILLAGERS_1.id,
            awayTeamName: 'Riverside Occasionals',
          }),
          makeMatch({
            id: 'match-2',
            matchDate: '2026-03-14T10:00:00Z',
            homeTeamId: IRENE_VILLAGERS_2.id,
            awayTeamName: 'Centurion Thursdays',
          }),
          makeMatch({
            id: 'match-3',
            matchDate: '2026-03-21T13:00:00Z',
            homeTeamName: 'Wanderers Pioneers',
            homeTeamLogoUrl: '/media/wanderers-pioneers-logo.png',
            awayTeamId: IRENE_VILLAGERS_1.id,
          }),
        ]}
        teamsById={TEAMS_BY_ID}
      />,
    )

    const headings = screen.getAllByRole('heading', { level: 6 }).map((heading) => heading.textContent)
    expect(headings).toEqual(['Sat, 14 Mar 2026', 'Sat, 21 Mar 2026'])

    // The earlier same-day match ("Centurion Thursdays" kick-off, 10:00) renders before the later
    // one ("Riverside Occasionals" kick-off, 14:00) within that first date's own group — asserted
    // via DOM source order, since both render under the same date heading.
    const earlierMatch = screen.getByText('Centurion Thursdays')
    const laterMatch = screen.getByText('Riverside Occasionals')
    expect(earlierMatch.compareDocumentPosition(laterMatch) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('Wanderers Pioneers')).toBeInTheDocument()
  })
})
