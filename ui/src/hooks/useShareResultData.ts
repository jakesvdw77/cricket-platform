import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { getManagedClubProfile } from '../api/clubApi'
import type { ClubProfile } from '../api/clubApi'
import { listLeagues } from '../api/leagueApi'
import type { League } from '../api/leagueApi'
import type { Match } from '../api/matchApi'
import { getScorecard, resultKeys } from '../api/matchResultApi'
import type { MatchResult, Scorecard } from '../api/matchResultApi'
import { listSections } from '../api/sectionApi'
import type { Section } from '../api/sectionApi'
import { listSponsors } from '../api/sponsorApi'
import type { Sponsor } from '../api/sponsorApi'
import { listTeamSponsors } from '../api/teamSponsorApi'
import type { Team } from '../api/teamApi'
import { isJuniorMatch } from '../utils/share/isJuniorMatch'
import type { JuniorMatchResult } from '../utils/share/isJuniorMatch'

// docs/specs/114-share-result.md (Data check): everything the Share dialog reads besides the result itself, fetched only
// while the dialog is open. Each read is tolerant: a section-scoped manager cannot read leagues, sections, the club
// profile or club sponsors (plan decision 2), and a failed read simply leaves that piece undefined, never throws and never
// retries. Queries share their keys with the pages that already cache the same data.

export interface ShareResultData {
  scorecard: Scorecard | undefined
  // null: the match has no league. undefined: it has one that could not be loaded.
  league: League | null | undefined
  clubProfile: ClubProfile | undefined
  // Active sponsors with a logo (club sponsors, then the match's own teams' sponsors), each once.
  sponsors: Sponsor[]
  // The id of the first active sponsor of the home team (else of the other own team); the default tick.
  defaultSponsorId: string | null
  junior: JuniorMatchResult
  // True until every read has settled (succeeded or failed).
  isLoading: boolean
}

const tolerantRetry = false

export function useShareResultData(
  clubId: string,
  match: Match,
  result: MatchResult,
  teamsById: Map<string, Team>,
  enabled: boolean,
): ShareResultData {
  const active = enabled && Boolean(clubId)

  const scorecardQuery = useQuery({
    queryKey: resultKeys.scorecard(clubId, match.id),
    queryFn: () => getScorecard(clubId, match.id),
    enabled: active && result.hasScorecard,
    retry: tolerantRetry,
  })
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

  // The match's own teams, home first. A team id the teams list does not know leaves the section data incomplete.
  const ownTeamIds = [match.homeTeamId, match.awayTeamId].filter((id): id is string => Boolean(id))
  const ownTeams = ownTeamIds.map((id) => teamsById.get(id))
  const teamsKnown = ownTeams.every((team) => team !== undefined)
  const knownOwnTeams = ownTeams.filter((team): team is Team => team !== undefined)

  const teamSponsorQueries = useQueries({
    queries: knownOwnTeams.map((team) => ({
      queryKey: ['managed-club', clubId, 'sections', team.sectionId, 'teams', team.id, 'sponsors'],
      queryFn: () => listTeamSponsors(clubId, team.sectionId, team.id),
      enabled: active,
      retry: tolerantRetry,
    })),
  })

  const leagueLoaded = leaguesQuery.data?.find((item) => item.id === match.leagueId)
  // A league id whose league could not be loaded is undefined (fails safe to junior); no league id is null.
  const league: League | null | undefined = match.leagueId ? leagueLoaded : null

  const sponsors = useMemo(() => {
    const seen = new Set<string>()
    const list: Sponsor[] = []
    const add = (sponsor: Sponsor) => {
      if (!sponsor.active || !sponsor.logoUrl || seen.has(sponsor.id)) return
      seen.add(sponsor.id)
      list.push(sponsor)
    }
    ;(sponsorsQuery.data ?? []).forEach(add)
    teamSponsorQueries.forEach((query) => (query.data ?? []).forEach(add))
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsorsQuery.data, ...teamSponsorQueries.map((query) => query.data)])

  const defaultSponsorId =
    teamSponsorQueries.flatMap((query) => query.data ?? []).find((sponsor) => sponsor.active && sponsor.logoUrl)?.id ?? null

  const junior = isJuniorMatch({
    league,
    sections: teamsKnown ? (sectionsQuery.data as Pick<Section, 'id' | 'parentSectionId' | 'name' | 'maxAge'>[] | undefined) : undefined,
    teams: knownOwnTeams.map((team) => ({ sectionId: team.sectionId })),
  })

  const isLoading =
    active &&
    (scorecardQuery.isLoading ||
      leaguesQuery.isLoading ||
      sectionsQuery.isLoading ||
      profileQuery.isLoading ||
      sponsorsQuery.isLoading ||
      teamSponsorQueries.some((query) => query.isLoading))

  return {
    scorecard: scorecardQuery.data,
    league,
    clubProfile: profileQuery.data,
    sponsors,
    defaultSponsorId,
    junior,
    isLoading,
  }
}
