import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Link as RouterLink, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Button as MuiButton,
  Chip,
  Stack,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ScoreboardOutlinedIcon from '@mui/icons-material/ScoreboardOutlined'
import LiveTvOutlinedIcon from '@mui/icons-material/LiveTvOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { badgeSx } from '../../components/RecordCard'
import { EmptyState } from '../../components/EmptyState'
import { PageHeaderBand } from '../../components/PageHeaderBand'
import { getMatch } from '../../api/matchApi'
import type { Match } from '../../api/matchApi'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { listLeagues } from '../../api/leagueApi'
import type { League } from '../../api/leagueApi'
import { listSeasons } from '../../api/seasonApi'
import type { Season } from '../../api/seasonApi'
import { listSquad } from '../../api/teamSquadApi'
import { listMatchSides } from '../../api/matchSideApi'
import type { MatchSide } from '../../api/matchSideApi'
import { listPolls } from '../../api/matchAvailabilityApi'
import { getMatchSquad } from '../../api/matchSquadApi'
import { MatchKeyFigures } from './matchDetail/MatchKeyFigures'
import { MatchTeamCard } from './matchDetail/MatchTeamCard'
import { useAvailabilityNavigation } from './matches/useAvailabilityNavigation'
import { useTeamSheetShare } from './matches/useTeamSheetShare'
import { TeamLogo } from './matches/TeamLogo'
import { logoFor } from './matches/teamLogoHelpers'
import { selectTeamPath } from './teamSelection/selectionLinks'
import {
  badgeFor,
  matchPollsFrom,
  NO_CLUB_TEAM_REASON,
  ownSides,
    pollDestination,
  sideName,
} from './matches/matchCardHelpers'
import type { MatchSquadCoverage, OwnSide } from './matches/matchCardHelpers'

const MATCHES_PATH = '/manage/fixtures/matches'

// docs/specs/075-match-view-and-edit.md section 1: the Match View, hand-built on PageHeaderBand in
// the shape of LeagueViewLayout (072) rather than RecordDetailScreen. The outer component loads the
// match and the lookups every part needs; MatchView below loads the per-side data (sides, squads,
// polls, coverage) and renders the header and one card per own team.
export default function MatchDetailPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { matchId } = useParams<{ matchId?: string }>()

  const matchQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId],
    queryFn: () => getMatch(clubId as string, matchId as string),
    enabled: Boolean(clubId) && Boolean(matchId),
  })

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

  if (matchQuery.isError || !matchQuery.data) {
    return (
      <EmptyState
        title="Couldn't load this match"
        description="Something went wrong loading this match. Please try again."
      />
    )
  }

  return (
    <MatchView
      clubId={clubId}
      match={matchQuery.data}
      teamsById={teamsById}
      leaguesById={leaguesById}
      seasonsById={seasonsById}
    />
  )
}

interface MatchViewProps {
  clubId: string
  match: Match
  teamsById: Map<string, Team>
  leaguesById: Map<string, League>
  seasonsById: Map<string, Season>
}

function MatchView({ clubId, match, teamsById, leaguesById, seasonsById }: MatchViewProps) {
  const own = ownSides(match)
  const homeOwn = own.find((entry) => entry.side === 'home')
  const awayOwn = own.find((entry) => entry.side === 'away')

  const sidesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', match.id, 'sides'],
    queryFn: () => listMatchSides(clubId, match.id),
  })

  const homeSquadQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', match.homeTeamId as string, 'seasons', match.seasonId, 'squad'],
    queryFn: () => listSquad(clubId, match.homeTeamId as string, match.seasonId),
    enabled: Boolean(homeOwn),
  })

  const awaySquadQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', match.awayTeamId as string, 'seasons', match.seasonId, 'squad'],
    queryFn: () => listSquad(clubId, match.awayTeamId as string, match.seasonId),
    enabled: Boolean(awayOwn),
  })

  // The poll state and Availability destination: the match's squad polls plus each own side's
  // match-squad coverage (the key MatchFormPage's useSideCoverage uses).
  const pollsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', match.id, 'polls'],
    queryFn: () => listPolls(clubId, match.id),
  })

  const homeCoverageQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', match.id, 'teams', match.homeTeamId, 'squad'],
    queryFn: () => getMatchSquad(clubId, match.id, match.homeTeamId as string),
    enabled: Boolean(homeOwn),
  })

  const awayCoverageQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', match.id, 'teams', match.awayTeamId, 'squad'],
    queryFn: () => getMatchSquad(clubId, match.id, match.awayTeamId as string),
    enabled: Boolean(awayOwn),
  })

  // getMatch returns the list-only fields as false / [] (040/069): the page rebuilds them once from
  // the sides and the polls/coverage queries and feeds the existing helpers.
  const sides = sidesQuery.data ?? []
  const sideFor = (entry?: OwnSide): MatchSide | undefined =>
    entry ? sides.find((candidate) => candidate.teamId === entry.teamId) : undefined
  const homeSide = sideFor(homeOwn)
  const awaySide = sideFor(awayOwn)

  const coverageByTeamId = new Map<string, MatchSquadCoverage | undefined>()
  if (homeOwn) coverageByTeamId.set(homeOwn.teamId, homeCoverageQuery.data)
  if (awayOwn) coverageByTeamId.set(awayOwn.teamId, awayCoverageQuery.data)

  // A failed query is NOT ready: the poll state is unknown, so the badge is hidden and
  // Availability stays disabled rather than offering the New poll flow for a match that has a poll.
  const pollQueries = [pollsQuery, homeCoverageQuery, awayCoverageQuery]
  const pollsReady = pollQueries.every((query) => !query.isLoading && !query.isError)
  const sidesReady = !sidesQuery.isLoading

  const overlay: Match = {
    ...match,
    homeSideAnnounced: Boolean(homeSide?.announced),
    awaySideAnnounced: Boolean(awaySide?.announced),
    polls: matchPollsFrom(
      own.map((entry) => entry.teamId),
      pollsQuery.data ?? [],
      coverageByTeamId,
    ),
  }

  const { openShare, shareDialog } = useTeamSheetShare({ clubId, match: overlay, teamsById, leaguesById, seasonsById })
  const { openAvailability, menu } = useAvailabilityNavigation(pollDestination(overlay, teamsById))

  const homeName = sideName(match.homeTeamId, match.homeTeamName, teamsById)
  const awayName = sideName(match.awayTeamId, match.awayTeamName, teamsById)
  const title = `${homeName} vs ${awayName}`

  const inactive = badgeFor(match)

  const logos = [
    logoFor(match.homeTeamId, match.homeTeamLogoUrl, homeName, teamsById),
    logoFor(match.awayTeamId, match.awayTeamLogoUrl, awayName, teamsById),
  ]

  const noOwnTeam = own.length === 0
  // docs/specs/076-team-selection.md section 7: a league match's M is each side's own
  // limits.maxSelected (a 12th man counts); a match with no league keeps 075's rule (no bar).
  const hasLeague = Boolean(match.leagueId)
  const editTo = `${MATCHES_PATH}/${match.id}/edit`
  // docs/specs/093: Select team opens the Select team page of the first own side (home when it is ours).
  const selectTo = selectTeamPath(match.id, (homeOwn ? homeSide : awaySide)?.id ?? null, Boolean(homeOwn))

  // The one open squad poll's scheduled close, when there is exactly one (group polls carry none): the Poll tile's caption.
  const openScheduled = (pollsQuery.data ?? []).filter((poll) => poll.open && poll.scheduledCloseAt)
  const pollClosesAt = openScheduled.length === 1 ? openScheduled[0].scheduledCloseAt : null
  const leagueName = match.leagueId ? (leaguesById.get(match.leagueId)?.name ?? null) : null
  const seasonLabel = seasonsById.get(match.seasonId)?.label ?? null

  // docs/specs/089 (A, revised): the poll page's header. Top row: Back on the left, the page-level actions (Scoring, Watch
  // live, Edit) on the right. Title row: the title (a logo before each team that has one) and the match workflow buttons
  // right-aligned. No header badges: each team card shows its own Announced chip and the strip shows the poll; only
  // Inactive stays. Then the key-figure strip and one team card per own side.
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.75, md: 2 } }}>
      <PageHeaderBand>
        <Stack spacing={2}>
          <Box
            data-testid="match-header-top-row"
            sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}
          >
            <MuiButton
              component={RouterLink}
              to={MATCHES_PATH}
              variant="text"
              color="inherit"
              size="small"
              startIcon={<ArrowBackIcon fontSize="small" />}
              sx={{ ml: -1, color: 'text.secondary' }}
            >
              Back to Matches
            </MuiButton>

            {/* Scoring and Watch live (only when the match has the link; below the actions on a phone) and the primary Edit. */}
            <Box sx={{ display: 'flex', gap: 1, flex: 'none' }} data-testid="match-header-links">
              {match.scoringUrl && (
                <MuiButton
                  component="a"
                  href={match.scoringUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                  aria-label="Scoring link"
                  startIcon={<ScoreboardOutlinedIcon fontSize="small" />}
                  sx={{ display: { xs: 'none', md: 'inline-flex' } }}
                >
                  Scoring
                </MuiButton>
              )}
              {match.streamingUrl && (
                <MuiButton
                  component="a"
                  href={match.streamingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                  aria-label="Watch live link"
                  startIcon={<LiveTvOutlinedIcon fontSize="small" />}
                  sx={{ display: { xs: 'none', md: 'inline-flex' } }}
                >
                  Watch live
                </MuiButton>
              )}
              <MuiButton component={RouterLink} to={editTo} variant="contained" startIcon={<EditOutlinedIcon fontSize="small" />}>
                Edit
              </MuiButton>
            </Box>
          </Box>

          <Box
            data-testid="match-header-title-row"
            sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
          >
            <Typography
              variant="h4"
              component="h1"
              aria-label={title}
              sx={{
                fontWeight: 700,
                lineHeight: 1.2,
                fontSize: { xs: '1.4rem', md: '1.75rem' },
                overflowWrap: 'anywhere',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                columnGap: { xs: 1, md: 1.5 },
                rowGap: 0.5,
                flex: '1 1 320px',
                minWidth: 0,
              }}
            >
              {logos[0].src && <TeamLogo logo={logos[0]} testId="match-logo-home" />}
              <span>{homeName}</span>
              <Box component="span" sx={{ fontWeight: 500, color: 'text.secondary', fontSize: { xs: '1rem', md: '1.1rem' } }}>
                vs
              </Box>
              {logos[1].src && <TeamLogo logo={logos[1]} testId="match-logo-away" />}
              <span>{awayName}</span>
              {inactive && <Chip size="small" label={inactive.label} sx={badgeSx(inactive.tone)} data-testid="match-inactive-badge" />}
            </Typography>

            {/* The match workflow, right-aligned like the poll page's actions; all disabled with a reason when none of
                the club's teams plays. A phone shows Select team and Availability as two full-width halves. */}
            <Box
              data-testid="match-header-actions"
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, auto)' },
                width: { xs: '100%', md: 'auto' },
                justifyContent: { md: 'end' },
              }}
            >
              <ActionSlot disabled={noOwnTeam}>
                {noOwnTeam ? (
                  <MuiButton variant="outlined" disabled startIcon={<GroupsOutlinedIcon fontSize="small" />} sx={ACTION_SX}>
                    Select team
                  </MuiButton>
                ) : (
                  <MuiButton
                    component={RouterLink}
                    to={selectTo}
                    variant="outlined"
                    startIcon={<GroupsOutlinedIcon fontSize="small" />}
                    sx={ACTION_SX}
                  >
                    Select team
                  </MuiButton>
                )}
              </ActionSlot>
              <ActionSlot disabled={noOwnTeam}>
                <MuiButton
                  variant="outlined"
                  disabled={noOwnTeam || !pollsReady}
                  onClick={openAvailability}
                  startIcon={<EventAvailableOutlinedIcon fontSize="small" />}
                  sx={ACTION_SX}
                >
                  Availability
                </MuiButton>
              </ActionSlot>
              <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, display: 'flex' }}>
                <ActionSlot disabled={noOwnTeam}>
                  <MuiButton
                    variant="outlined"
                    disabled={noOwnTeam}
                    onClick={openShare}
                    aria-label="Share team sheet"
                    startIcon={<ShareOutlinedIcon fontSize="small" />}
                    sx={ACTION_SX}
                  >
                    <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                      Share
                    </Box>
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                      Share team sheet
                    </Box>
                  </MuiButton>
                </ActionSlot>
              </Box>
            </Box>
          </Box>

          {/* A phone has no room for the links beside Edit: they follow the actions. */}
          {(match.scoringUrl || match.streamingUrl) && (
            <Box sx={{ display: { xs: 'grid', md: 'none' }, gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              {match.scoringUrl && (
                <MuiButton component="a" href={match.scoringUrl} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<ScoreboardOutlinedIcon fontSize="small" />}>
                  Scoring
                </MuiButton>
              )}
              {match.streamingUrl && (
                <MuiButton component="a" href={match.streamingUrl} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<LiveTvOutlinedIcon fontSize="small" />}>
                  Watch live
                </MuiButton>
              )}
            </Box>
          )}
        </Stack>
      </PageHeaderBand>

      <MatchKeyFigures
        matchDate={match.matchDate}
        venue={match.venue}
        leagueName={leagueName}
        seasonLabel={seasonLabel}
        pollsReady={pollsReady}
        polls={overlay.polls}
        pollClosesAt={pollClosesAt}
      />

      {own.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          None of your teams is playing in this match, so there is no team to select.
        </Typography>
      ) : (
        <Box
          data-testid="match-team-cards"
          sx={{
            display: 'grid',
            gap: 2,
            alignItems: 'start',
            gridTemplateColumns:
              own.length === 1 ? 'minmax(0, 640px)' : 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))',
          }}
        >
          {own.map((entry) => {
            const side = entry.side === 'home' ? homeSide : awaySide
            const squadQuery = entry.side === 'home' ? homeSquadQuery : awaySquadQuery
            return (
              <MatchTeamCard
                key={entry.side}
                testId={`match-team-card-${entry.side}`}
                teamName={entry.side === 'home' ? homeName : awayName}
                sideLabel={entry.side === 'home' ? 'Home' : 'Away'}
                side={side}
                squad={squadQuery.data ?? []}
                announced={Boolean(side?.announced)}
                announcedReady={sidesReady}
                sidesReady={sidesReady}
                playingXiSize={hasLeague ? (side?.limits?.maxSelected ?? null) : null}
                selectTo={selectTeamPath(match.id, side?.id ?? null, entry.side === 'home')}
              />
            )
          })}
        </Box>
      )}

      {menu}
      {shareDialog}
    </Box>
  )
}

const ACTION_SX = { flex: { xs: 1, sm: 'none' }, justifyContent: 'center', minWidth: 0 } as const

// A disabled control is wrapped in a titled span so the reason shows (a disabled button swallows
// pointer events), as RecordCard's footer buttons are.
function ActionSlot({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  return (
    <Box
      component="span"
      title={disabled ? NO_CLUB_TEAM_REASON : undefined}
      sx={{ display: 'flex', flex: { xs: 1, sm: 'none' }, minWidth: 0 }}
    >
      {children}
    </Box>
  )
}
