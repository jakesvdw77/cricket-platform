import { isAxiosError } from 'axios'
import api from './axiosConfig'

// docs/specs/111-league-season-dates.md: when a league runs in a season. Both dates are required once set; a league season
// that has none yet answers 404, which getLeagueSeasonDates turns into null.
export interface LeagueSeasonDates {
  startDate: string
  endDate: string
}

export const leagueSeasonDatesKey = (clubId: string, leagueId: string, seasonId: string) =>
  ['managed-club', clubId, 'leagues', leagueId, 'season-dates', seasonId] as const

function datesPath(clubId: string, leagueId: string, seasonId: string): string {
  return `/manage/clubs/${clubId}/leagues/${leagueId}/seasons/${seasonId}/dates`
}

export async function getLeagueSeasonDates(
  clubId: string,
  leagueId: string,
  seasonId: string,
): Promise<LeagueSeasonDates | null> {
  try {
    const { data } = await api.get<LeagueSeasonDates>(datesPath(clubId, leagueId, seasonId))
    return data
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return null
    }
    throw error
  }
}

export async function putLeagueSeasonDates(
  clubId: string,
  leagueId: string,
  seasonId: string,
  payload: LeagueSeasonDates,
): Promise<LeagueSeasonDates> {
  const { data } = await api.put<LeagueSeasonDates>(datesPath(clubId, leagueId, seasonId), payload)
  return data
}
