import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NextMatchCountdown } from './NextMatchCountdown'
import type { Match } from '../../api/matchApi'
import type { Team } from '../../api/teamApi'

const homeTeam: Team = {
  id: 'team-home',
  clubId: 'club-1',
  sectionId: 'section-1',
  name: 'Riverside 1st XI',
  logoUrl: null,
  abbreviation: null,
  groundName: null,
  socialLinks: [],
  active: true,
  createdAt: '',
  updatedAt: '',
  updatedBy: null,
}

const teamsById = new Map<string, Team>([[homeTeam.id, homeTeam]])

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    clubId: 'club-1',
    homeTeamId: 'team-home',
    homeTeamName: null,
    awayTeamId: null,
    awayTeamName: 'Coastal CC',
    leagueId: 'league-1',
    seasonId: 'season-1',
    matchDate: '2026-03-14T10:00:00Z',
    venue: 'Riverside Oval',
    active: true,
    homeSideAnnounced: false,
    awaySideAnnounced: false,
    homeTeamLogoUrl: null,
    awayTeamLogoUrl: null,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    ...overrides,
  }
}

describe('NextMatchCountdown', () => {
  it('renders nothing given a null countdown', () => {
    const { container } = render(<NextMatchCountdown countdown={null} teamsById={teamsById} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders a "Today" chip, not a numeric day count, when label is "today"', () => {
    render(<NextMatchCountdown countdown={{ match: makeMatch(), label: 'today' }} teamsById={teamsById} />)

    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.queryByText('DAYS')).not.toBeInTheDocument()
  })

  it('renders a "Tomorrow" chip, not a numeric day count, when label is "tomorrow"', () => {
    render(<NextMatchCountdown countdown={{ match: makeMatch(), label: 'tomorrow' }} teamsById={teamsById} />)

    expect(screen.getByText('Tomorrow')).toBeInTheDocument()
    expect(screen.queryByText('DAYS')).not.toBeInTheDocument()
  })

  it('renders the numeric day count and a "DAYS" label, not a chip, when label is "days"', () => {
    render(<NextMatchCountdown countdown={{ match: makeMatch(), label: 'days', value: 12 }} teamsById={teamsById} />)

    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('DAYS')).toBeInTheDocument()
    expect(screen.queryByText('Today')).not.toBeInTheDocument()
    expect(screen.queryByText('Tomorrow')).not.toBeInTheDocument()
  })

  it("resolves and displays both sides' names via teamsById, falling back to the match's own free-text name", () => {
    render(
      <NextMatchCountdown
        countdown={{ match: makeMatch({ homeTeamId: 'team-home', awayTeamId: null, awayTeamName: 'Coastal CC' }), label: 'days', value: 3 }}
        teamsById={teamsById}
      />,
    )

    // The home side resolves its name via teamsById (not a raw id); the away side falls back to
    // the match's own free-text awayTeamName, since it has no awayTeamId.
    expect(screen.getByText('Riverside 1st XI vs Coastal CC')).toBeInTheDocument()
  })
})
