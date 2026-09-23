import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Stack, Typography } from '@mui/material'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import { RecordDetailScreen, DetailFieldRow, DetailFieldGrid } from '../../components/RecordDetailScreen'
import { PlayingXiSummary } from '../../components/PlayingXiSummary'
import { AvailabilityRespondentAvatars } from '../../components/AvailabilityRespondentAvatars'
import { EmptyState } from '../../components/EmptyState'
import { getMatch } from '../../api/matchApi'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { listLeagues } from '../../api/leagueApi'
import type { League } from '../../api/leagueApi'
import { listSeasons } from '../../api/seasonApi'
import type { Season } from '../../api/seasonApi'
import { listSquad } from '../../api/teamSquadApi'
import { listMatchSides } from '../../api/matchSideApi'
import { listPolls, getPollResponses } from '../../api/matchAvailabilityApi'
import type { MatchAvailabilityPollResponses } from '../../api/matchAvailabilityApi'
import { matchFields } from '../../utils/matchRecordFields'
import { badgeFor, sideName } from './MatchList'

// docs/specs/036-view-first-record-detail-screens.md: matchFields' own fixed label set
// ('Date & time' / 'Venue' / 'League / Season') mapped to a consistent icon per field type — the
// same convention every other DetailPage uses, applied here without duplicating matchFields'
// date/venue/league-season resolution logic a second time.
function iconForMatchField(label: string): ReactNode {
  if (label === 'Venue') {
    return <PlaceOutlinedIcon />
  }
  if (label === 'League / Season') {
    return <EmojiEventsOutlinedIcon />
  }
  return <CalendarTodayOutlinedIcon />
}

// One side's read-only availability summary — reuses AvailabilityRespondentAvatars verbatim
// (docs/specs/034-availability-polls-dashboard.md), grouping this side's poll responses
// (MatchAvailabilityTab.tsx's own MatchAvailabilityPollResponses shape) by status client-side,
// same as AvailabilityPollsDashboard.tsx's own per-status rendering. No admin-override control —
// that stays on MatchAvailabilityTab, reached via this page's single Edit action.
function SideAvailability({
  label,
  poll,
  isLoading,
}: {
  label: string
  poll: MatchAvailabilityPollResponses | null
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <Typography variant="body2" color="text.secondary">
        Loading availability for {label}…
      </Typography>
    )
  }

  if (!poll) {
    return (
      <Typography variant="body2" color="text.secondary">
        No availability poll open for {label}.
      </Typography>
    )
  }

  const available = poll.responses.filter((row) => row.status === 'AVAILABLE')
  const unavailable = poll.responses.filter((row) => row.status === 'UNAVAILABLE')
  const unsure = poll.responses.filter((row) => row.status === 'UNSURE')

  return (
    <Stack spacing={1}>
      <Typography variant="body2" fontWeight={600}>
        {label}
      </Typography>
      <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap alignItems="flex-start">
        <AvailabilityRespondentAvatars status="AVAILABLE" respondents={available} count={poll.availableCount} layout="wrap" />
        <AvailabilityRespondentAvatars status="UNAVAILABLE" respondents={unavailable} count={poll.unavailableCount} layout="wrap" />
        <AvailabilityRespondentAvatars status="UNSURE" respondents={unsure} count={poll.unsureCount} layout="wrap" />
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
          {poll.noResponseCount} No response
        </Typography>
      </Stack>
    </Stack>
  )
}

// docs/specs/036-view-first-record-detail-screens.md: the read-only counterpart to
// MatchFormPage.tsx — Match is the one entity with a real single-record GET (getMatch), same
// badgeFor/sideName mapping (imported from MatchList.tsx, not duplicated). MatchFormPage's
// Details/Home XI/Away XI/Availability tabs collapse into stacked sections: Home/Away XI use the
// new, genuinely read-only PlayingXiSummary (not PlayingXiBuilder, which has no read-only mode);
// Availability reuses AvailabilityRespondentAvatars verbatim, split into Home/Away sub-groups, with
// no admin-override control.
export default function MatchDetailPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { matchId } = useParams<{ matchId?: string }>()

  const matchQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId],
    queryFn: () => getMatch(clubId as string, matchId as string),
    enabled: Boolean(clubId) && Boolean(matchId),
  })

  const match = matchQuery.data

  const teamsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId as string),
    enabled: Boolean(clubId),
  })

  const leaguesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues'],
    queryFn: () => listLeagues(clubId as string),
    enabled: Boolean(clubId),
  })

  const seasonsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId),
  })

  const sidesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId, 'sides'],
    queryFn: () => listMatchSides(clubId as string, matchId as string),
    enabled: Boolean(clubId) && Boolean(matchId),
  })

  const homeSquadQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', match?.homeTeamId as string, 'seasons', match?.seasonId, 'squad'],
    queryFn: () => listSquad(clubId as string, match?.homeTeamId as string, match?.seasonId as string),
    enabled: Boolean(clubId) && Boolean(match?.homeTeamId),
  })

  const awaySquadQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', match?.awayTeamId as string, 'seasons', match?.seasonId, 'squad'],
    queryFn: () => listSquad(clubId as string, match?.awayTeamId as string, match?.seasonId as string),
    enabled: Boolean(clubId) && Boolean(match?.awayTeamId),
  })

  const pollsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId, 'polls'],
    queryFn: () => listPolls(clubId as string, matchId as string),
    enabled: Boolean(clubId) && Boolean(matchId),
  })

  const homePoll = (pollsQuery.data ?? []).find((candidate) => candidate.teamId === match?.homeTeamId) ?? null
  const awayPoll = (pollsQuery.data ?? []).find((candidate) => candidate.teamId === match?.awayTeamId) ?? null

  const homeResponsesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId, 'polls', homePoll?.id, 'responses'],
    queryFn: () => getPollResponses(clubId as string, matchId as string, homePoll?.id as string),
    enabled: Boolean(clubId) && Boolean(matchId) && Boolean(homePoll),
  })

  const awayResponsesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId, 'polls', awayPoll?.id, 'responses'],
    queryFn: () => getPollResponses(clubId as string, matchId as string, awayPoll?.id as string),
    enabled: Boolean(clubId) && Boolean(matchId) && Boolean(awayPoll),
  })

  const teamsById = useMemo(() => {
    const map = new Map<string, Team>()
    ;(teamsQuery.data ?? []).forEach((team) => map.set(team.id, team))
    return map
  }, [teamsQuery.data])

  const leaguesById = useMemo(() => {
    const map = new Map<string, League>()
    ;(leaguesQuery.data ?? []).forEach((league) => map.set(league.id, league))
    return map
  }, [leaguesQuery.data])

  const seasonsById = useMemo(() => {
    const map = new Map<string, Season>()
    ;(seasonsQuery.data ?? []).forEach((season) => map.set(season.id, season))
    return map
  }, [seasonsQuery.data])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (matchQuery.isLoading) {
    return null
  }

  if (matchQuery.isError || !match) {
    return (
      <EmptyState
        title="Couldn't load this match"
        description="Something went wrong loading this match. Please try again."
      />
    )
  }

  const homeTeamName = sideName(match.homeTeamId, match.homeTeamName, teamsById)
  const awayTeamName = sideName(match.awayTeamId, match.awayTeamName, teamsById)
  const homeSide = (sidesQuery.data ?? []).find((side) => side.teamId === match.homeTeamId)
  const awaySide = (sidesQuery.data ?? []).find((side) => side.teamId === match.awayTeamId)
  const hasAnyXiSide = Boolean(match.homeTeamId) || Boolean(match.awayTeamId)

  return (
    <RecordDetailScreen
      title={`${homeTeamName} vs ${awayTeamName}`}
      backTo="/manage/fixtures/matches"
      backLabel="Back to Matches"
      avatar={{ fallback: <SportsCricketOutlinedIcon fontSize="small" />, shape: 'rounded' }}
      badge={badgeFor(match)}
      // docs/specs/037-match-improvements.md item 2: jumps straight into this match's Playing XI
      // tab — hidden for a match with no real-Team side (no Playing XI tab to jump into).
      secondaryActions={
        hasAnyXiSide
          ? [
              {
                label: 'Select Team',
                to: `/manage/fixtures/matches/${match.id}/edit?tab=playing-xi`,
                icon: <GroupsOutlinedIcon fontSize="small" />,
              },
            ]
          : undefined
      }
      editTo={`/manage/fixtures/matches/${match.id}/edit`}
      sections={[
        {
          heading: 'Details',
          content: (
            <DetailFieldGrid>
              {matchFields(match, leaguesById, seasonsById).map((field) => (
                <DetailFieldRow key={field.label} icon={iconForMatchField(field.label)} label={field.label} value={field.value} />
              ))}
            </DetailFieldGrid>
          ),
        },
        ...(hasAnyXiSide
          ? [
              {
                heading: 'Availability',
                content: (
                  <Stack spacing={3}>
                    {match.homeTeamId && (
                      <SideAvailability
                        label={`${homeTeamName} (Home)`}
                        poll={homePoll ? homeResponsesQuery.data ?? null : null}
                        isLoading={pollsQuery.isLoading || (Boolean(homePoll) && homeResponsesQuery.isLoading)}
                      />
                    )}
                    {match.awayTeamId && (
                      <SideAvailability
                        label={`${awayTeamName} (Away)`}
                        poll={awayPoll ? awayResponsesQuery.data ?? null : null}
                        isLoading={pollsQuery.isLoading || (Boolean(awayPoll) && awayResponsesQuery.isLoading)}
                      />
                    )}
                  </Stack>
                ),
              },
            ]
          : []),
        ...(match.homeTeamId
          ? [
              {
                heading: 'Home XI',
                content: (
                  <PlayingXiSummary
                    squad={homeSquadQuery.data ?? []}
                    xi={homeSide?.players ?? []}
                    captainPlayerId={homeSide?.captainPlayerId ?? null}
                    wicketKeeperPlayerId={homeSide?.wicketKeeperPlayerId ?? null}
                    twelfthManPlayerId={homeSide?.twelfthManPlayerId ?? null}
                  />
                ),
              },
            ]
          : []),
        ...(match.awayTeamId
          ? [
              {
                heading: 'Away XI',
                content: (
                  <PlayingXiSummary
                    squad={awaySquadQuery.data ?? []}
                    xi={awaySide?.players ?? []}
                    captainPlayerId={awaySide?.captainPlayerId ?? null}
                    wicketKeeperPlayerId={awaySide?.wicketKeeperPlayerId ?? null}
                    twelfthManPlayerId={awaySide?.twelfthManPlayerId ?? null}
                  />
                ),
              },
            ]
          : []),
      ]}
    />
  )
}
