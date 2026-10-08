import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listSeasons } from '../api/seasonApi'
import { pickDefaultSeasonId } from '../utils/defaultSeason'

// docs/specs/083-availability-filters-and-toolbars.md: the Players and Coverage views always use the
// default season (the one containing today, else the latest created) - there is no season control on
// any availability view. Shared by both through the hub layout.
export function useAvailabilitySeason(clubId: string | undefined, enabled = true) {
  const seasonsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId) && enabled,
  })
  const seasonId = useMemo(() => pickDefaultSeasonId(seasonsQuery.data ?? []), [seasonsQuery.data])
  return { seasonId, seasonsLoading: seasonsQuery.isLoading }
}
