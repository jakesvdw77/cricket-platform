import { useQuery } from '@tanstack/react-query'
import { listTeamsForClub } from '../api/teamApi'

// The section of a club team (the teams are already loaded by the pages), and whether that is still being looked up.
// `enabled` keeps the call from running until it is needed.
export function useTeamSectionLookup(clubId: string, teamId: string | null, enabled: boolean): { sectionId: string | null; pending: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId),
    enabled: enabled && Boolean(teamId),
  })
  return { sectionId: data?.find((team) => team.id === teamId)?.sectionId ?? null, pending: isLoading }
}

// The section of a club team, or null while unknown.
export function useTeamSectionId(clubId: string, teamId: string | null, enabled: boolean): string | null {
  return useTeamSectionLookup(clubId, teamId, enabled).sectionId
}
