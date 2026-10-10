import api from './axiosConfig'

// A club's own Season — a date range scoping league affiliations, team squads, and matches.
// docs/specs/029-league-management.md. Single /manage-only namespace, same posture as
// League/Team/Sponsor. Never hard-deleted — deactivate/reactivate only.
export interface Season {
  id: string
  clubId: string
  label: string
  startDate: string
  endDate: string
  active: boolean
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

// Same shape for create and update — CreateSeasonRequest/UpdateSeasonRequest are identical
// server-side.
export interface SeasonPayload {
  label: string
  startDate: string
  endDate: string
}

function seasonsPath(clubId: string): string {
  return `/manage/clubs/${clubId}/seasons`
}

// Plain array response, not Page<T> — a club's own seasons are a small, bounded list (one per
// year/period), matching League/Team/Sponsor's own posture.
export async function listSeasons(clubId: string): Promise<Season[]> {
  const { data } = await api.get<Season[]>(seasonsPath(clubId))
  return data
}

// docs/specs/094-club-structure-and-seasons.md (B): what each season holds, for the Seasons page's cards and list. One
// entry per club season ("0" figures when it is empty). The status counters are not here: they are computed client-side
// from the season list.
export interface SeasonSummary {
  seasonId: string
  // Leagues with at least one affiliation in the season.
  leagueCount: number
  // Distinct own teams entered in a league that season.
  teamsEntered: number
  // Active matches in the season.
  matchCount: number
}

export interface SeasonsSummary {
  seasons: SeasonSummary[]
}

// Under the list's own ['managed-club', clubId, 'seasons'] prefix, so every season write that invalidates the list
// refreshes the figures too.
export const seasonsSummaryKey = (clubId: string) => ['managed-club', clubId, 'seasons', 'summary'] as const

export async function getSeasonsSummary(clubId: string): Promise<SeasonsSummary> {
  const { data } = await api.get<SeasonsSummary>(`${seasonsPath(clubId)}/summary`)
  return data
}

export async function createSeason(clubId: string, payload: SeasonPayload): Promise<Season> {
  const { data } = await api.post<Season>(seasonsPath(clubId), payload)
  return data
}

export async function updateSeason(clubId: string, seasonId: string, payload: SeasonPayload): Promise<Season> {
  const { data } = await api.put<Season>(`${seasonsPath(clubId)}/${seasonId}`, payload)
  return data
}

export async function deactivateSeason(clubId: string, seasonId: string): Promise<Season> {
  const { data } = await api.post<Season>(`${seasonsPath(clubId)}/${seasonId}/deactivate`)
  return data
}

export async function reactivateSeason(clubId: string, seasonId: string): Promise<Season> {
  const { data } = await api.post<Season>(`${seasonsPath(clubId)}/${seasonId}/reactivate`)
  return data
}
