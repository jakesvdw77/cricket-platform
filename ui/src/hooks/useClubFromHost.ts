import { useQuery } from '@tanstack/react-query'
import { getClubBySlug } from '../api/leadApi'
import type { ClubSummary } from '../api/leadApi'
import { clubSlugFromHost } from '../utils/clubFromHost'
import { readLastClub } from '../utils/lastClub'

// 'root': the root domain, no lookup. 'loading': a club host, lookup pending. 'found': the club exists and is active. 'missing': the
// server answered 404 (unknown, inactive or malformed). 'unavailable': the lookup itself failed (callers fail open).
export type ClubHostStatus = 'root' | 'loading' | 'found' | 'missing' | 'unavailable'

export interface ClubFromHost {
  club: ClubSummary | null
  status: ClubHostStatus
  isClubHost: boolean
  slug: string | null
}

const ONE_HOUR_MS = 60 * 60 * 1000

// docs/specs/149: the club named by the host of the address, looked up once and cached. Never read on the root domain.
export function useClubFromHost(): ClubFromHost {
  const slug = clubSlugFromHost()
  const isClubHost = slug !== null
  const query = useQuery({
    queryKey: ['public-club', slug],
    queryFn: () => getClubBySlug(slug as string),
    enabled: isClubHost,
    retry: false,
    staleTime: ONE_HOUR_MS,
  })
  let status: ClubHostStatus
  if (!isClubHost) status = 'root'
  else if (query.isError) status = 'unavailable'
  else if (query.isPending) status = 'loading'
  else status = query.data ? 'found' : 'missing'
  return { club: query.data ?? null, status, isClubHost, slug }
}

// The club to prefer on /welcome: the club of the address, else (root domain only) the remembered club from the landing dialog. Used for
// ordering and preselection only, never to hide or grant anything. `fromHost` is true only for the club of the address (the welcome line).
export function useVisitedClub(): { club: ClubSummary | null; fromHost: boolean } {
  const host = useClubFromHost()
  const remembered = host.isClubHost ? null : readLastClub()
  const rememberedQuery = useQuery({
    queryKey: ['public-club', remembered?.slug ?? null],
    queryFn: () => getClubBySlug(remembered?.slug as string),
    enabled: remembered !== null,
    retry: false,
    staleTime: ONE_HOUR_MS,
  })
  if (host.isClubHost) return { club: host.club, fromHost: host.club !== null }
  return { club: rememberedQuery.data ?? null, fromHost: false }
}
