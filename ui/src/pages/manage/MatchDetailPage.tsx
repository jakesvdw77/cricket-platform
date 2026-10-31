import { useMemo } from 'react'
import { Link as RouterLink, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box, Button as MuiButton, Chip, Link as MuiLink, Stack, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import LiveTvOutlinedIcon from '@mui/icons-material/LiveTvOutlined'
import ScoreboardOutlinedIcon from '@mui/icons-material/ScoreboardOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import SportsScoreOutlinedIcon from '@mui/icons-material/SportsScoreOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { badgeSx } from '../../components/RecordCard'
import { compactButtonSx } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { ManageMenu } from '../../components/ManageMenu'
import type { ManageMenuItem } from '../../components/ManageMenu'
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
import { resultActionFor, resultBadgeFor, resultImportActionFor } from './matches/matchResultHelpers'
import { MatchKeyFigures } from './matchDetail/MatchKeyFigures'
import { useMatchFieldWeather } from '../../hooks/useMatchWeather'
import { MatchTeamCard } from './matchDetail/MatchTeamCard'
import { availabilityMenuItems, titleCase } from './matches/MatchRowMenu'
import { useTeamSheetShare } from './matches/useTeamSheetShare'
import { TeamLogo } from './matches/TeamLogo'
import { logoFor } from './matches/teamLogoHelpers'
import { useBackLink } from '../../hooks/useReturnTo'
import { currentOrigin, withReturnTo } from '../../utils/returnTo'
import { pageTitleSx } from '../../theme'
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

  // docs/specs/089 (Match page actions, 2026-10-16): Share team sheet sits on each own side's card and opens the dialog on that side.
  // docs/specs/131: ONE Share Match dialog; the per-side Share Team Sheet entries are preselections of it.
  const weather = useMatchFieldWeather(clubId, match)
  const share = useTeamSheetShare({ clubId, match: overlay, teamsById, leaguesById, seasonsById })
  // docs/specs/127 and 130: Back returns to where the page was opened from (default: the Matches list); every link that leaves the page
  // carries this page as its origin, labelled "{Home} v {Away}" (at most 60 characters).
  const location = useLocation()
  const back = useBackLink(MATCHES_PATH, 'Back to Matches')

  const homeName = sideName(match.homeTeamId, match.homeTeamName, teamsById)
  const awayName = sideName(match.awayTeamId, match.awayTeamName, teamsById)
  const title = `${homeName} vs ${awayName}`
  const leaveTo = (destination: string) => withReturnTo(destination, currentOrigin(location), `${homeName} v ${awayName}`.slice(0, 60))

  const inactive = badgeFor(match)
  const resultBadge = resultBadgeFor(match)
  const resultAction = resultActionFor(match)
  const importAction = resultImportActionFor(match)

  const logos = [
    logoFor(match.homeTeamId, match.homeTeamLogoUrl, homeName, teamsById),
    logoFor(match.awayTeamId, match.awayTeamLogoUrl, awayName, teamsById),
  ]

  const noOwnTeam = own.length === 0
  // docs/specs/076-team-selection.md section 7: a league match's M is each side's own
  // limits.maxSelected (a 12th man counts); a match with no league keeps 075's rule (no bar).
  const hasLeague = Boolean(match.leagueId)
  const editTo = leaveTo(`${MATCHES_PATH}/${match.id}/edit`)
  // The one open squad poll's scheduled close, when there is exactly one (group polls carry none): the Poll tile's caption.
  const openScheduled = (pollsQuery.data ?? []).filter((poll) => poll.open && poll.scheduledCloseAt)
  const pollClosesAt = openScheduled.length === 1 ? openScheduled[0].scheduledCloseAt : null
  const leagueName = match.leagueId ? (leaguesById.get(match.leagueId)?.name ?? null) : null
  const seasonLabel = seasonsById.get(match.seasonId)?.label ?? null

  const destination = pollDestination(overlay, teamsById)
  const availabilityReason = noOwnTeam ? NO_CLUB_TEAM_REASON : !pollsReady ? 'Polls are still loading' : null
  const sideName2 = (entry: OwnSide) => (entry.side === 'home' ? homeName : awayName)
  const perSide = own.length > 1
  const shareTeamSheet = (entry: OwnSide) => () => share.openShareFor({ content: 'TEAM_SHEET', scope: entry.side })

  // docs/specs/130 and page-anatomy sections 1 and 8: ONE filled Manage Match menu with everything you can do to the match, Share last.
  // Deactivate, Reactivate and Delete are on the edit page (6b, 109). An action that cannot apply says why.
  const selectItems: ManageMenuItem[] = noOwnTeam
    ? [{ id: 'select-team', title: 'Select Team', description: 'Pick the Playing XI.', icon: <GroupsOutlinedIcon fontSize="small" />, disabled: true, reason: NO_CLUB_TEAM_REASON }]
    : own.map((entry) => ({
        id: perSide ? `select-team-${entry.side}` : 'select-team',
        title: perSide ? `Select Team: ${sideName2(entry)}` : 'Select Team',
        description: 'Pick the Playing XI.',
        icon: <GroupsOutlinedIcon fontSize="small" />,
        to: leaveTo(selectTeamPath(match.id, (entry.side === 'home' ? homeSide : awaySide)?.id ?? null, entry.side === 'home')),
      }))
  const shareItems: ManageMenuItem[] = noOwnTeam
    ? [{ id: 'share-team-sheet', title: 'Share Team Sheet', description: 'The team sheet as a PDF or message.', icon: <ShareOutlinedIcon fontSize="small" />, disabled: true, reason: NO_CLUB_TEAM_REASON }]
    : own.map((entry) => ({
        id: perSide ? `share-team-sheet-${entry.side}` : 'share-team-sheet',
        title: perSide ? `Share Team Sheet: ${sideName2(entry)}` : 'Share Team Sheet',
        description: 'The team sheet as a PDF or message.',
        icon: <ShareOutlinedIcon fontSize="small" />,
        onClick: shareTeamSheet(entry),
      }))
  const shareMatchItem: ManageMenuItem = { id: 'share-match', title: 'Share Match', description: 'The fixture, team poster, countdown, facts or team sheet.', icon: <ShareOutlinedIcon fontSize="small" />, onClick: share.openShare }
  const manageMenu = (
    <ManageMenu
      label="Manage Match"
      testId="manage-match"
      fixedWidth
      groups={[
        {
          id: 'match',
          heading: 'Match',
          items: [
            { id: 'edit-match', title: 'Edit Match', description: 'Teams, league, season, date, venue and links.', icon: <EditOutlinedIcon fontSize="small" />, to: editTo },
            ...(resultAction
              ? [{ id: 'result', title: titleCase(resultAction.label), description: 'The scorecard and result.', icon: <SportsScoreOutlinedIcon fontSize="small" />, to: leaveTo(resultAction.to) }]
              : []),
            ...(importAction
              ? [{ id: 'import-result', title: titleCase(importAction.label), description: 'Import the scorecard from a file.', icon: <UploadFileOutlinedIcon fontSize="small" />, to: leaveTo(importAction.to) }]
              : []),
            ...selectItems,
            ...availabilityMenuItems(destination, leaveTo, availabilityReason, 'Ask the players if they can play.'),
            ...shareItems,
            shareMatchItem,
          ],
        },
      ]}
    />
  )

  // docs/specs/089, revamped by docs/specs/130 (skeleton as the season page, docs/standards/page-anatomy.md section 1): Back alone on the top
  // row; the title row holds the team logos and "Home vs Away" as the record name, its badges inline, the match's Season pill and the one filled Manage Match
  // menu; Scoring and Watch Live are inline links under the title. Then four static figures and one flat panel per own team.
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <PageHeaderBand>
        <Stack spacing={2}>
          {/* Top row: only the quiet Back link (page-anatomy section 1). */}
          <Box data-testid="match-header-top-row" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
            <MuiButton
              component={RouterLink}
              to={back.to ?? MATCHES_PATH}
              variant="text"
              color="inherit"
              size="small"
              startIcon={<ArrowBackIcon fontSize="small" />}
              sx={{ ...compactButtonSx, ml: -1, color: 'text.secondary' }}
            >
              {back.label}
            </MuiButton>
          </Box>

          <Box data-testid="match-header-title-row" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2, rowGap: 1.5, minWidth: 0 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1.25, rowGap: 0.5, minWidth: 0, flex: '1 1 auto' }}>
              <Typography
                variant="h4"
                component="h1"
                aria-label={title}
                sx={{
                  ...pageTitleSx,
                  fontSize: { xs: 26, md: 32 },
                  lineHeight: 1.1,
                  letterSpacing: '0.02em',
                  textTransform: 'none',
                  overflowWrap: 'anywhere',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  columnGap: { xs: 1, md: 1.25 },
                  rowGap: 0.5,
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
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center" aria-label="Match badges" sx={{ flex: 'none' }}>
                {inactive && <Chip size="small" label={inactive.label} sx={badgeSx(inactive.tone)} data-testid="match-inactive-badge" />}
                {resultBadge && <Chip size="small" label={resultBadge.label} sx={badgeSx(resultBadge.tone)} data-testid="match-result-badge" />}
                {seasonLabel && <Chip size="small" variant="outlined" label={seasonLabel} data-testid="match-season-pill" />}
              </Stack>
            </Box>
            <Box data-testid="match-header-actions" sx={{ display: 'flex', flex: { xs: '1 1 100%', sm: 'none' }, ml: { sm: 'auto' } }}>
              {manageMenu}
            </Box>
          </Box>

          {/* Scoring and Watch Live (only when the match has the link): inline links under the title, on every width. */}
          {(match.scoringUrl || match.streamingUrl) && (
            <Box data-testid="match-header-links" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2.5, rowGap: 0.5 }}>
              {match.scoringUrl && (
                <MuiLink href={match.scoringUrl} target="_blank" rel="noopener noreferrer" aria-label="Scoring link" underline="hover" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontWeight: 600, fontSize: '0.875rem' }}>
                  <ScoreboardOutlinedIcon fontSize="small" />
                  Scoring
                </MuiLink>
              )}
              {match.streamingUrl && (
                <MuiLink href={match.streamingUrl} target="_blank" rel="noopener noreferrer" aria-label="Watch live link" underline="hover" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontWeight: 600, fontSize: '0.875rem' }}>
                  <LiveTvOutlinedIcon fontSize="small" />
                  Watch Live
                </MuiLink>
              )}
            </Box>
          )}
        </Stack>
      </PageHeaderBand>

      <MatchKeyFigures
        matchDate={match.matchDate}
        venue={match.venue}
        playingAreaId={match.playingAreaId}
        playingAreaVerificationStatus={match.playingAreaVerificationStatus}
        fieldTo={match.playingAreaId ? leaveTo(`/manage/fixtures/fields/${match.playingAreaId}`) : undefined}
        leagueName={leagueName}
        seasonLabel={seasonLabel}
        pollsReady={pollsReady}
        polls={overlay.polls}
        pollClosesAt={pollClosesAt}
        resultStatus={match.resultStatus}
        weather={weather.summary}
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
            gap: { xs: 1.5, md: 2 },
            alignItems: 'stretch',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: own.length === 1 ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          {own.map((entry) => {
            const side = entry.side === 'home' ? homeSide : awaySide
            const squadQuery = entry.side === 'home' ? homeSquadQuery : awaySquadQuery
            return (
              <MatchTeamCard
                key={entry.side}
                testId={`match-team-card-${entry.side}`}
                teamName={sideName2(entry)}
                sideLabel={entry.side === 'home' ? 'Home' : 'Away'}
                side={side}
                squad={squadQuery.data ?? []}
                announced={Boolean(side?.announced)}
                announcedReady={sidesReady}
                sidesReady={sidesReady}
                playingXiSize={hasLeague ? (side?.limits?.maxSelected ?? null) : null}
                selectTo={leaveTo(selectTeamPath(match.id, side?.id ?? null, entry.side === 'home'))}
                onShare={shareTeamSheet(entry)}
              />
            )
          })}
        </Box>
      )}

      {share.shareDialog}
    </Box>
  )
}
