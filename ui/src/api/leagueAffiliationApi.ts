import api from './axiosConfig'

// A club's own Team entered into its own League for a Season — docs/specs/029-league-management.md.
// Nested under the league (a Team/Season pairing only ever makes sense in the context of "which
// teams are entered in this league"). Unlink-only — hard delete of the join row, no active flag,
// same posture as SectionContact/TeamContact/TeamSponsor/PlayerSection.
export interface LeagueAffiliation {
  id: string
  leagueId: string
  teamId: string
  seasonId: string
  createdAt: string
  createdBy: string | null
}

function affiliationsPath(clubId: string, leagueId: string): string {
  return `/manage/clubs/${clubId}/leagues/${leagueId}/affiliations`
}

export async function listLeagueAffiliations(clubId: string, leagueId: string): Promise<LeagueAffiliation[]> {
  const { data } = await api.get<LeagueAffiliation[]>(affiliationsPath(clubId, leagueId))
  return data
}

export async function createLeagueAffiliation(
  clubId: string,
  leagueId: string,
  teamId: string,
  seasonId: string,
): Promise<LeagueAffiliation> {
  const { data } = await api.post<LeagueAffiliation>(affiliationsPath(clubId, leagueId), { teamId, seasonId })
  return data
}

export async function unaffiliateLeagueTeam(clubId: string, leagueId: string, affiliationId: string): Promise<void> {
  await api.post(`${affiliationsPath(clubId, leagueId)}/${affiliationId}/unaffiliate`)
}
