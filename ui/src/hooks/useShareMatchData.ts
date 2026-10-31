import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getManagedClubProfile } from '../api/clubApi'
import type { ClubProfile } from '../api/clubApi'
import { listLeagues } from '../api/leagueApi'
import type { League } from '../api/leagueApi'
import type { Match } from '../api/matchApi'
import { listResults, resultsKey } from '../api/matchResultApi'
import type { ResultListItem } from '../api/matchResultApi'
import { listSections } from '../api/sectionApi'
import type { Section } from '../api/sectionApi'
import { listSponsors } from '../api/sponsorApi'
import type { Sponsor } from '../api/sponsorApi'
import type { Team } from '../api/teamApi'
import { isJuniorMatch } from '../utils/share/isJuniorMatch'
import type { JuniorMatchResult } from '../utils/share/isJuniorMatch'
import { buildFunFacts } from '../utils/share/matchFunFacts'
import type { FactResultRow, FunFact } from '../utils/share/matchFunFacts'
import { localDateIso } from '../utils/weather/forecastWindow'

// docs/specs/131-match-sharing.md (API Contract): everything the Share Match dialog reads besides the sides the host already
// loaded, fetched only while it is open. Tolerant like useShareResultData: a failed read leaves that piece empty (and keeps the
// junior lock on when the sections cannot be read), never throws, never retries. Fun facts are built from published results only.

export interface ShareMatchData {
  league: League | null | undefined
  clubProfile: ClubProfile | undefined
  sponsors: Sponsor[]
  junior: JuniorMatchResult
  facts: FunFact[]
  isLoading: boolean
}

const tolerantRetry = false
const FACT_RESULTS = 40

function rowOf(item: ResultListItem, teamId: string): FactResultRow {
  return {
    dateIso: localDateIso(item.match.matchDate),
    teamSide: item.match.homeTeamId === teamId ? 'HOME' : 'AWAY',
    outcomeType: item.result.outcomeType,
    winningSide: item.result.winningSide,
  }
}

const sameName = (a: string | null, b: string | null): boolean => Boolean(a && b) && (a as string).trim().toLowerCase() === (b as string).trim().toLowerCase()

export function useShareMatchData(
  clubId: string,
  match: Match,
  teamsById: Map<string, Team>,
  names: { ours: string; opposition: string },
  ownTeamId: string | null,
  oppositionTeamId: string | null,
  enabled: boolean,
): ShareMatchData {
  const active = enabled && Boolean(clubId)
  const leaguesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues'],
    queryFn: () => listLeagues(clubId),
    enabled: active && Boolean(match.leagueId),
    retry: tolerantRetry,
  })
  const sectionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId),
    enabled: active,
    retry: tolerantRetry,
  })
  const profileQuery = useQuery({
    queryKey: ['managed-club', clubId, 'profile'],
    queryFn: () => getManagedClubProfile(clubId),
    enabled: active,
    retry: tolerantRetry,
  })
  const sponsorsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sponsors'],
    queryFn: () => listSponsors(clubId),
    enabled: active,
    retry: tolerantRetry,
  })
  const oursQuery = useQuery({
    queryKey: [...resultsKey(clubId), 'match-share', ownTeamId],
    queryFn: () => listResults(clubId, { page: 0, size: FACT_RESULTS, sort: 'matchDate,desc', status: 'PUBLISHED', teamId: ownTeamId as string }),
    enabled: active && Boolean(ownTeamId),
    retry: tolerantRetry,
  })
  const oppQuery = useQuery({
    queryKey: [...resultsKey(clubId), 'match-share', oppositionTeamId],
    queryFn: () => listResults(clubId, { page: 0, size: FACT_RESULTS, sort: 'matchDate,desc', status: 'PUBLISHED', teamId: oppositionTeamId as string }),
    enabled: active && Boolean(oppositionTeamId) && oppositionTeamId !== ownTeamId,
    retry: tolerantRetry,
  })

  const league: League | null | undefined = match.leagueId ? leaguesQuery.data?.find((item) => item.id === match.leagueId) : null
  const ownTeams = [match.homeTeamId, match.awayTeamId].filter((id): id is string => Boolean(id)).map((id) => teamsById.get(id))
  const teamsKnown = ownTeams.every((team) => team !== undefined)
  const knownOwn = ownTeams.filter((team): team is Team => team !== undefined)
  const junior = isJuniorMatch({
    league,
    sections: teamsKnown ? (sectionsQuery.data as Pick<Section, 'id' | 'parentSectionId' | 'name' | 'maxAge'>[] | undefined) : undefined,
    teams: knownOwn.map((team) => ({ sectionId: team.sectionId })),
  })

  const sponsors = useMemo(() => (sponsorsQuery.data ?? []).filter((sponsor) => sponsor.active && sponsor.logoUrl), [sponsorsQuery.data])

  const facts = useMemo(() => {
    const before = localDateIso(match.matchDate)
    const prior = (items: ResultListItem[] | undefined) => (items ?? []).filter((item) => item.match.id !== match.id && localDateIso(item.match.matchDate) <= before)
    const ours = ownTeamId ? prior(oursQuery.data?.content).map((item) => rowOf(item, ownTeamId)) : []
    const opposition = oppositionTeamId && oppositionTeamId !== ownTeamId ? prior(oppQuery.data?.content).map((item) => rowOf(item, oppositionTeamId)) : []
    const headToHead = ownTeamId
      ? prior(oursQuery.data?.content)
          .filter((item) => {
            const otherId = item.match.homeTeamId === ownTeamId ? item.match.awayTeamId : item.match.homeTeamId
            const otherName = item.match.homeTeamId === ownTeamId ? item.match.awayTeamName : item.match.homeTeamName
            return oppositionTeamId ? otherId === oppositionTeamId : sameName(otherName, names.opposition)
          })
          .map((item) => rowOf(item, ownTeamId))
      : []
    return buildFunFacts({ ourName: names.ours, oppositionName: names.opposition, ours, opposition, headToHead })
  }, [match.id, match.matchDate, ownTeamId, oppositionTeamId, oursQuery.data, oppQuery.data, names.ours, names.opposition])

  const isLoading = active && (leaguesQuery.isLoading || sectionsQuery.isLoading || profileQuery.isLoading || sponsorsQuery.isLoading || oursQuery.isLoading)
  return { league, clubProfile: profileQuery.data, sponsors, junior, facts, isLoading }
}
