import type { LeagueTeam } from '../../../api/leagueTeamApi'

// Shared fixture for the league-team tests (not production code).
export function makeLeagueTeam(overrides: Partial<LeagueTeam> = {}): LeagueTeam {
  return {
    id: 'lt-1',
    leagueId: 'league-1',
    seasonId: 'season-2',
    name: 'Centurion Brits CC',
    abbreviation: 'CBC',
    logoUrl: null,
    active: true,
    referencedByMatchCount: 0,
    ...overrides,
  }
}
