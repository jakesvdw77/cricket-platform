// ?competition= from a link: only the two known values count, anything else means no filter. Shared by the player and team
// statistics pages (both StatsCompetition and TeamStatsCompetition are 'LEAGUE' | 'FRIENDLY').
export function parseCompetition(value: string | null): 'LEAGUE' | 'FRIENDLY' | null {
  return value === 'LEAGUE' || value === 'FRIENDLY' ? value : null
}
