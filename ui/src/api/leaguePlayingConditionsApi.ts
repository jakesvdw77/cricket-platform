import { isAxiosError } from 'axios'
import api from './axiosConfig'

// A league+season's Playing Conditions — docs/specs/050-league-schedule-and-fixtures.md's PDF
// upload plus docs/specs/052-league-playing-conditions.md's structured match-format/points/
// bonus-points fields, on the same row. No version history: a save (either the PDF upload or the
// structured-fields PUT) replaces this same row's fields in place (an upsert against the backend's
// unique (league_id, season_id) key), the same "no history, just current state" posture
// Sponsor.logoUrl/Team.logoUrl already have. documentUrl/uploadedAt are nullable as of `052` — a
// row can now exist with structured fields saved and no PDF ever uploaded. allowSubstitutions
// moved here from League itself (052 amendment) — never enforced by any backend rule, and like
// the rest of this record's fields, plausibly differs by season.
export interface LeaguePlayingConditions {
  id: string
  leagueId: string
  seasonId: string
  documentUrl: string | null
  uploadedAt: string | null
  uploadedBy: string | null
  maxOversPerInnings: number | null
  powerplayOvers: number | null
  maxOversPerBowler: number | null
  fieldingRestrictionsNotes: string | null
  allowSubstitutions: boolean
  pointsForWin: number | null
  pointsForLoss: number | null
  pointsForDraw: number | null
  pointsForNoResult: number | null
  pointsForForfeitWin: number | null
  bonusPointsEnabled: boolean
  bonusBattingOversThreshold: number | null
  bonusBowlingRestrictionPercentage: number | null
  additionalNotes: string | null
}

// The writable structured-fields subset — mirrors UpdateLeaguePlayingConditionsRequest.java
// field-for-field. Saved as one whole form (docs/specs/052), so every field except
// maxOversPerBowler/fieldingRestrictionsNotes/the two bonus-threshold fields/additionalNotes is
// required at this type level.
export interface PlayingConditionsPayload {
  maxOversPerInnings: number
  powerplayOvers: number
  maxOversPerBowler: number | null
  fieldingRestrictionsNotes: string | null
  allowSubstitutions: boolean
  pointsForWin: number
  pointsForLoss: number
  pointsForDraw: number
  pointsForNoResult: number
  pointsForForfeitWin: number
  bonusPointsEnabled: boolean
  bonusBattingOversThreshold: number | null
  bonusBowlingRestrictionPercentage: number | null
  additionalNotes: string | null
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

// JSON PUT — docs/specs/052-league-playing-conditions.md. Upserts against the same row the PDF
// upload does: creates it on first save for this (leagueId, seasonId) pair if none exists yet,
// otherwise updates the structured fields in place, leaving documentUrl/uploadedAt/uploadedBy
// untouched.
export async function updatePlayingConditions(
  clubId: string,
  leagueId: string,
  seasonId: string,
  payload: PlayingConditionsPayload,
): Promise<LeaguePlayingConditions> {
  const { data } = await api.put<LeaguePlayingConditions>(playingConditionsPath(clubId, leagueId, seasonId), payload)
  return data
}
