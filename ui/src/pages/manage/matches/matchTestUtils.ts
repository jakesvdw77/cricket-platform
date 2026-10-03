import type { Match, MatchPoll } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'

// Shared fixtures for the 069 match card tests (not production code).
export function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    clubId: 'club-1',
    homeTeamId: 'team-1',
    homeTeamName: null,
    awayTeamId: null,
    awayTeamName: 'Riverside Occasionals',
    leagueId: null,
    seasonId: 'season-1',
    matchDate: '2026-10-03T10:00:00Z',
    venue: 'Riverside Oval',
    active: true,
    homeSideAnnounced: false,
    awaySideAnnounced: false,
    homePickedCount: 0,
    awayPickedCount: null,
    playingXiSize: 11,
    polls: [],
    homeTeamLogoUrl: null,
    awayTeamLogoUrl: null,
    homeLeagueTeamId: null,
    awayLeagueTeamId: null,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    ...overrides,
  }
}

export function makeTeam(id: string, name: string, sectionId = `section-${id}`): Team {
  return {
    id,
    clubId: 'club-1',
    sectionId,
    name,
    logoUrl: null,
    abbreviation: null,
    groundName: null,
    socialLinks: [],
    active: true,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
  }
}

export function makeTeams(...teams: Team[]): Map<string, Team> {
  return new Map(teams.map((team) => [team.id, team]))
}

export function squadPoll(overrides: Partial<MatchPoll> = {}): MatchPoll {
  return { type: 'SQUAD', teamId: 'team-1', pollId: 'poll-1', roundId: null, open: true, ...overrides }
}

export function groupPoll(overrides: Partial<MatchPoll> = {}): MatchPoll {
  return { type: 'GROUP', teamId: null, pollId: 'round-1', roundId: 'round-1', open: true, ...overrides }
}
