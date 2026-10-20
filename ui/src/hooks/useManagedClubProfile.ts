import { useQuery } from '@tanstack/react-query'
import { getManagedClubProfile } from '../api/clubApi'

// The managed club's profile under the shared key ['managed-club', clubId, 'profile'] (the same cache entry every page reads).
export function useManagedClubProfile(clubId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['managed-club', clubId, 'profile'],
    queryFn: () => getManagedClubProfile(clubId as string),
    enabled: enabled && Boolean(clubId),
  })
}
