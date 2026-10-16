import { useQuery } from '@tanstack/react-query'
import { listTeamsForClub } from '../api/teamApi'

// The section of a club team (the teams are already loaded by the pages), or null while unknown. `enabled` keeps the call
// from running until it is needed.
export function useTeamSectionId(clubId: string, teamId: string | null, enabled: boolean): string | null {
  const { data } = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId),
    enabled: enabled && Boolean(teamId),
  })
  return data?.find((team) => team.id === teamId)?.sectionId ?? null
}
