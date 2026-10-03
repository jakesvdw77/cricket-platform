import type { AvailabilityCell, CellStatus, GameColumn, PlayerRow } from '../../../api/playerAvailabilityApi'

// Shared fixtures for the 068 grid tests. Dates are built in local time so the date/slot/kickoff
// assertions hold in any timezone.
export function at(month: number, day: number, hour: number, minute = 0, year = 2026): string {
  return new Date(year, month - 1, day, hour, minute).toISOString()
}

export function makeGame(overrides: Partial<GameColumn> = {}): GameColumn {
  return {
    matchId: 'match-1',
    matchDate: at(10, 3, 9),
    dayPart: 'MORNING',
    label: 'Villagers 1 v CBC',
    venue: 'Home Ground',
    leagueId: 'league-1',
    leagueName: 'Premier League',
    teamId: 'team-1',
    sectionId: 'section-1',
    pollType: 'GROUP',
    pollId: 'round-1',
    roundId: 'round-1',
    ...overrides,
  }
}

export function makePlayer(
  id: string,
  firstName: string,
  lastName: string,
  jerseyNumber: number | null,
  statuses: Array<[string, CellStatus, boolean?]>,
): PlayerRow {
  const cells: AvailabilityCell[] = statuses.map(([matchId, status, picked]) => ({ matchId, status, picked: picked ?? false }))
  return {
    playerProfileId: id,
    firstName,
    lastName,
    jerseyNumber,
    answeredCount: cells.filter((cell) => ['AVAILABLE', 'UNSURE', 'UNAVAILABLE'].includes(cell.status)).length,
    pickedCount: cells.filter((cell) => cell.picked).length,
    cells,
  }
}
