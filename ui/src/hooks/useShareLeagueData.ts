import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getManagedClubProfile } from '../api/clubApi'
import type { ClubProfile } from '../api/clubApi'
import { listLeagueAffiliations } from '../api/leagueAffiliationApi'
import { listLeagueContacts } from '../api/leagueContactApi'
import type { LeagueContact } from '../api/leagueContactApi'
import type { League } from '../api/leagueApi'
import { getPlayingConditions } from '../api/leaguePlayingConditionsApi'
import type { LeaguePlayingConditions } from '../api/leaguePlayingConditionsApi'
import { getLeagueSeasonDates, leagueSeasonDatesKey } from '../api/leagueSeasonDatesApi'
import type { LeagueSeasonDates } from '../api/leagueSeasonDatesApi'
import { leagueTeamsQueryKey, listLeagueTeams } from '../api/leagueTeamApi'
import type { LeagueTeam } from '../api/leagueTeamApi'
import { listAllMatches } from '../api/matchApi'
import type { Match } from '../api/matchApi'
import { listPublishedLeagueResults, resultsKey } from '../api/matchResultApi'
import type { ResultListItem } from '../api/matchResultApi'
import { listSections } from '../api/sectionApi'
import type { Section } from '../api/sectionApi'
import { listSeasons } from '../api/seasonApi'
import type { Season } from '../api/seasonApi'
import { listSponsors } from '../api/sponsorApi'
import type { Sponsor } from '../api/sponsorApi'
import { listTeamsForClub } from '../api/teamApi'
import type { Team } from '../api/teamApi'
import { leagueContentGaps } from '../utils/share/shareLeagueData'
import type { LeagueContent } from '../utils/share/leagueShareFormats'

// docs/specs/122-league-sharing.md (API Contract): everything the Share League dialog reads, fetched only while it is
// open and reusing the keys the League pages already cache. Each read is tolerant, as useShareResultData: a
// section-scoped manager cannot read some of it, and a failed read leaves that piece empty (and the junior lock stays on
// when the sections are unreadable), never throws and never retries.

export interface ShareLeagueData {
  season: Season | null
  conditions: LeaguePlayingConditions | null | undefined
  contacts: LeagueContact[]
  ownTeams: Team[]
  leagueTeams: LeagueTeam[]
  teamsById: Map<string, Team>
  matches: Match[]
  // Published results of the league and season.
  results: ResultListItem[]
  seasonDates: LeagueSeasonDates | null | undefined
  // undefined: could not be read.
  sections: Section[] | undefined
  clubProfile: ClubProfile | undefined
  // Active club sponsors with a logo.
  sponsors: Sponsor[]
  // Contents with nothing to share, with the reason each is greyed in step 1.
  gaps: Partial<Record<LeagueContent, string>>
  // True until every read has settled (succeeded or failed).
  isLoading: boolean
}

const tolerantRetry = false

export function useShareLeagueData(
  clubId: string,
  league: League,
  seasonId: string | null | undefined,
  enabled: boolean,
): ShareLeagueData {
  const active = enabled && Boolean(clubId)
  const withSeason = active && Boolean(seasonId)
  const leagueId = league.id
  const season = seasonId ?? ''

  const seasonsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId),
    enabled: active,
    retry: tolerantRetry,
  })
  const conditionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'playing-conditions', season],
    queryFn: () => getPlayingConditions(clubId, leagueId, season),
    enabled: withSeason,
    retry: tolerantRetry,
  })
  const contactsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'contacts'],
    queryFn: () => listLeagueContacts(clubId, leagueId),
    enabled: active,
    retry: tolerantRetry,
  })
  const teamsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId),
    enabled: active,
    retry: tolerantRetry,
  })
  const affiliationsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'affiliations'],
    queryFn: () => listLeagueAffiliations(clubId, leagueId),
    enabled: active,
    retry: tolerantRetry,
  })
  const leagueTeamsQuery = useQuery({
    queryKey: [...leagueTeamsQueryKey(clubId, leagueId, season), 'active'],
    queryFn: () => listLeagueTeams(clubId, leagueId, season, { activeOnly: true }),
    enabled: withSeason,
    retry: tolerantRetry,
  })
  const matchesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'matches', season],
    queryFn: () => listAllMatches(clubId, { leagueId, seasonId: season }),
    enabled: withSeason,
    retry: tolerantRetry,
  })
  const resultsQuery = useQuery({
    queryKey: [...resultsKey(clubId), 'league-published', leagueId, season],
    queryFn: () => listPublishedLeagueResults(clubId, { leagueId, seasonId: season }),
    enabled: withSeason,
    retry: tolerantRetry,
  })
  const datesQuery = useQuery({
    queryKey: leagueSeasonDatesKey(clubId, leagueId, season),
    queryFn: () => getLeagueSeasonDates(clubId, leagueId, season),
    enabled: withSeason,
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

  const teamsById = useMemo(() => {
    const map = new Map<string, Team>()
    ;(teamsQuery.data ?? []).forEach((team) => map.set(team.id, team))
    return map
  }, [teamsQuery.data])

  const ownTeams = useMemo(
    () =>
      (affiliationsQuery.data ?? [])
        .filter((affiliation) => affiliation.seasonId === season)
        .map((affiliation) => teamsById.get(affiliation.teamId))
        .filter((team): team is Team => team !== undefined),
    [affiliationsQuery.data, season, teamsById],
  )

  const sponsors = useMemo(
    () => (sponsorsQuery.data ?? []).filter((sponsor) => sponsor.active && Boolean(sponsor.logoUrl)),
    [sponsorsQuery.data],
  )

  const contacts = useMemo(() => contactsQuery.data ?? [], [contactsQuery.data])
  const matches = useMemo(() => matchesQuery.data ?? [], [matchesQuery.data])
  const results = useMemo(() => resultsQuery.data ?? [], [resultsQuery.data])
  const leagueTeams = useMemo(() => leagueTeamsQuery.data ?? [], [leagueTeamsQuery.data])
  const seasonDates = datesQuery.data
  const conditions = conditionsQuery.data

  const gaps = useMemo(() => {
    const keyDateCount = (seasonDates ? 2 : 0) + (matches.some((match) => match.active) ? 1 : 0)
    return leagueContentGaps({
      conditions,
      teamCount: ownTeams.length + leagueTeams.length,
      matchCount: matches.filter((match) => match.active).length,
      publishedResultCount: results.length,
      keyDateCount,
    })
  }, [conditions, ownTeams.length, leagueTeams.length, matches, results.length, seasonDates])

  const isLoading =
    active &&
    (seasonsQuery.isLoading ||
      conditionsQuery.isLoading ||
      contactsQuery.isLoading ||
      teamsQuery.isLoading ||
      affiliationsQuery.isLoading ||
      leagueTeamsQuery.isLoading ||
      matchesQuery.isLoading ||
      resultsQuery.isLoading ||
      datesQuery.isLoading ||
      sectionsQuery.isLoading ||
      profileQuery.isLoading ||
      sponsorsQuery.isLoading)

  return {
    season: seasonsQuery.data?.find((item) => item.id === seasonId) ?? null,
    conditions,
    contacts,
    ownTeams,
    leagueTeams,
    teamsById,
    matches,
    results,
    seasonDates,
    sections: sectionsQuery.data,
    clubProfile: profileQuery.data,
    sponsors,
    gaps,
    isLoading,
  }
}
