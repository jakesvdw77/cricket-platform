import { isAxiosError } from 'axios'
import api from './axiosConfig'

// A league+season's single Playing Conditions PDF — docs/specs/050-league-schedule-and-fixtures.md.
// No version history: a re-upload replaces this same row's documentUrl/uploadedAt/uploadedBy in
// place (an upsert against the backend's unique (league_id, season_id) key), the same
// "no history, just current state" posture Sponsor.logoUrl/Team.logoUrl already have.
export interface LeaguePlayingConditions {
  id: string
  leagueId: string
  seasonId: string
  documentUrl: string
  uploadedAt: string
  uploadedBy: string | null
}

function playingConditionsPath(clubId: string, leagueId: string, seasonId: string): string {
  return `/manage/clubs/${clubId}/leagues/${leagueId}/seasons/${seasonId}/playing-conditions`
}

// Treats a 404 (nothing uploaded yet for this league+season, or a cross-club leagueId/seasonId) as
// "no document" rather than an error, so callers (DocumentUpload's host screens) don't need a
// try/catch of their own per call site.
export async function getPlayingConditions(
  clubId: string,
  leagueId: string,
  seasonId: string,
): Promise<LeaguePlayingConditions | null> {
  try {
    const { data } = await api.get<LeaguePlayingConditions>(playingConditionsPath(clubId, leagueId, seasonId))
    return data
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return null
    }
    throw error
  }
}

// Multipart upload — mirrors mediaApi.ts's uploadMedia/uploadManagedMedia FormData shape, but
// against a PDF-only allowlist enforced server-side. Creates the row on first upload for this
// (leagueId, seasonId) pair, replaces it in place on every subsequent one.
export async function uploadPlayingConditions(
  clubId: string,
  leagueId: string,
  seasonId: string,
  file: File,
): Promise<LeaguePlayingConditions> {
  const formData = new FormData()
  formData.append('file', file)

  const { data } = await api.post<LeaguePlayingConditions>(playingConditionsPath(clubId, leagueId, seasonId), formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
