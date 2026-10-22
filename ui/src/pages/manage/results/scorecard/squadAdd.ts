import { useQueryClient } from '@tanstack/react-query'
import { addToSquad, listSquad } from '../../../../api/teamSquadApi'
import { errorStatus } from '../../../../utils/errorDetail'

export const squadKey = (clubId: string, teamId: string, seasonId: string) => ['managed-club', clubId, 'teams', teamId, 'seasons', seasonId, 'squad'] as const

// docs/specs/118-result-review-fixes.md: adds a player to a team's squad for a season. "Already in the squad" (409) and "not an
// active club member" (400) are benign and count as done; any other failure (a section-scope refusal, a network error) is thrown.
export async function addPlayerToSquad(clubId: string, teamId: string, seasonId: string, playerId: string): Promise<void> {
  try {
    await addToSquad(clubId, teamId, seasonId, playerId)
  } catch (error) {
    const status = errorStatus(error)
    if (status === 409 || status === 400) return
    throw error
  }
}

// Best-effort auto-add on the Teams step (docs/specs/118): a player linked or created for one of our sides joins the team's squad
// for the match's season. Skips with no season or when the squad already holds the player; never throws and never blocks a save.
export function useAutoAddToSquad(clubId: string, seasonId: string | null | undefined) {
  const queryClient = useQueryClient()
  return async (teamId: string | null, playerId: string | null | undefined): Promise<void> => {
    if (!teamId || !playerId || !seasonId) return
    try {
      const squad = await queryClient.fetchQuery({ queryKey: squadKey(clubId, teamId, seasonId), queryFn: () => listSquad(clubId, teamId, seasonId) })
      if (squad.some((member) => member.playerProfileId === playerId)) return
      await addPlayerToSquad(clubId, teamId, seasonId, playerId)
    } catch {
      // Best effort: the Review step still warns, and offers Add to squad.
    } finally {
      void queryClient.invalidateQueries({ queryKey: squadKey(clubId, teamId, seasonId) })
    }
  }
}
