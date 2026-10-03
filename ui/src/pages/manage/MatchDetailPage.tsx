import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Link as RouterLink, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Avatar,
  Box,
  Button as MuiButton,
  Card as MuiCard,
  Chip,
  Divider,
  Link as MuiLink,
  Stack,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import ScoreboardOutlinedIcon from '@mui/icons-material/ScoreboardOutlined'
import LiveTvOutlinedIcon from '@mui/icons-material/LiveTvOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { avatarSx, badgeSx } from '../../components/RecordCard'
import type { RecordCardBadge } from '../../components/RecordCard'
import { CardProgressBar } from '../../components/CardProgressBar'
import { EmptyState } from '../../components/EmptyState'
import { PageHeaderBand } from '../../components/PageHeaderBand'
import { PlayingXiSummary } from '../../components/PlayingXiSummary'
import { getMatch } from '../../api/matchApi'
import type { Match } from '../../api/matchApi'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { listLeagues } from '../../api/leagueApi'
import type { League } from '../../api/leagueApi'
import { listSeasons } from '../../api/seasonApi'
import type { Season } from '../../api/seasonApi'
import { listSquad } from '../../api/teamSquadApi'
import type { SquadMember } from '../../api/teamSquadApi'
import { listMatchSides } from '../../api/matchSideApi'
import type { MatchSide } from '../../api/matchSideApi'
import { listPolls } from '../../api/matchAvailabilityApi'
import { getMatchSquad } from '../../api/matchSquadApi'
import { initialsFromName } from '../../utils/initials'
import { formatMatchDateTime } from './availability/pollHelpers'
import { useAvailabilityNavigation } from './matches/useAvailabilityNavigation'
import { useTeamSheetShare } from './matches/useTeamSheetShare'
import {
  announcedBadge,
  badgeFor,
  matchLeagueValue,
  matchPollsFrom,
  NO_CLUB_TEAM_REASON,
  ownSides,
  pickedLegend,
  pollBadgeFor,
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
  const bothOwn = own.length === 2

  const badges: RecordCardBadge[] = []
  if (sidesReady) {
    own.forEach((entry) => {
      const name = entry.side === 'home' ? homeName : awayName
      const announced = entry.side === 'home' ? overlay.homeSideAnnounced : overlay.awaySideAnnounced
      badges.push(announcedBadge(announced, bothOwn ? `${name}: ` : ''))
    })
  }
  const inactive = badgeFor(match)
  if (inactive) badges.push(inactive)
  if (pollsReady) badges.push(pollBadgeFor(overlay.polls))

  const logos = [
    logoFor(match.homeTeamId, match.homeTeamLogoUrl, homeName, teamsById),
    logoFor(match.awayTeamId, match.awayTeamLogoUrl, awayName, teamsById),
  ]
  const anyLogo = logos.some((logo) => Boolean(logo.src))

  const leagueValue = matchLeagueValue(match, leaguesById, seasonsById)
  const noOwnTeam = own.length === 0
  // docs/specs/076-team-selection.md section 7: a league match's M is each side's own
  // limits.maxSelected (a 12th man counts); a match with no league keeps 075's rule (no bar).
  const hasLeague = Boolean(match.leagueId)
  const editTo = `${MATCHES_PATH}/${match.id}/edit`

  const detailItems: { label: string; icon: ReactNode; value: string }[] = [
    { label: 'When', icon: <EventOutlinedIcon fontSize="small" />, value: formatMatchDateTime(match.matchDate) },
    ...(match.venue
      ? [{ label: 'Venue', icon: <PlaceOutlinedIcon fontSize="small" />, value: match.venue }]
      : []),
    ...(leagueValue
      ? [{ label: 'League', icon: <EmojiEventsOutlinedIcon fontSize="small" />, value: leagueValue }]
      : []),
  ]

  const linkSx = { fontSize: 13, fontWeight: 600, overflowWrap: 'anywhere' } as const

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeaderBand>
        <Stack spacing={2}>
          {/* Row 1: Back on the left, the match's badges right-aligned. */}
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

            <Stack
              direction="row"
              spacing={0.75}
              flexWrap="wrap"
              useFlexGap
              role="group"
              aria-label="Match badges"
              sx={{ justifyContent: { xs: 'flex-start', md: 'flex-end' }, width: { xs: '100%', md: 'auto' }, minWidth: 0 }}
            >
              {badges.map((badge) => (
                <Chip
                  key={badge.label}
                  size="small"
                  label={badge.label}
                  variant={badge.tone === 'neutral' || badge.tone === 'noPoll' ? 'outlined' : 'filled'}
                  sx={badgeSx(badge.tone)}
                />
              ))}
            </Stack>
          </Box>

          {/* Row 2: the title (with team logos) on the left, Edit right on the same row. The title
              wraps before Edit ever drops to a second line. */}
          <Box
            data-testid="match-header-title-row"
            sx={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: '1 1 auto', minWidth: 0 }}>
              {!anyLogo && (
                <Avatar variant="rounded" sx={avatarSx(44)} data-testid="match-header-avatar">
                  <SportsCricketOutlinedIcon fontSize="small" />
                </Avatar>
              )}
              <Typography
                variant="h6"
                component="h1"
                aria-label={title}
                sx={{
                  fontWeight: 700,
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  columnGap: 1,
                  rowGap: 0.5,
                }}
              >
                <TeamTitle name={homeName} logo={anyLogo ? logos[0] : null} testId="match-logo-home" />
                <Box component="span" sx={{ fontSize: 14, fontWeight: 500, color: 'text.secondary' }}>
                  vs
                </Box>
                <TeamTitle name={awayName} logo={anyLogo ? logos[1] : null} testId="match-logo-away" />
              </Typography>
            </Box>

            <MuiButton
              component={RouterLink}
              to={editTo}
              variant="outlined"
              startIcon={<EditOutlinedIcon fontSize="small" />}
              sx={{
                flex: 'none',
                bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                color: 'primary.dark',
                borderColor: 'transparent',
                '&:hover': {
                  borderColor: 'transparent',
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.2),
                },
              }}
            >
              Edit
            </MuiButton>
          </Box>

          <Divider />

          {/* Details, then the optional links; one per line on a phone. */}
          <Box
            data-testid="match-header-details"
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              flexWrap: 'wrap',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: { xs: 0.75, sm: '6px 28px' },
              minWidth: 0,
            }}
          >
            {detailItems.map((item) => (
              <Box
                key={item.label}
                role="group"
                aria-label={item.label}
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minWidth: 0, fontSize: 13 }}
              >
                <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }} aria-hidden>
                  {item.icon}
                </Box>
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, color: 'text.secondary', fontSize: 12 }}>
                  {item.label}
                </Box>
                <Box component="span" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                  {item.value}
                </Box>
              </Box>
            ))}
            {match.scoringUrl && (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                <ScoreboardOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} aria-hidden />
                <MuiLink
                  href={match.scoringUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  aria-label="Scoring link"
                  sx={linkSx}
                >
                  Scoring
                </MuiLink>
              </Box>
            )}
            {match.streamingUrl && (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                <LiveTvOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} aria-hidden />
                <MuiLink
                  href={match.streamingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  aria-label="Watch live link"
                  sx={linkSx}
                >
                  Watch live
                </MuiLink>
              </Box>
            )}
          </Box>

          {/* Actions: three equal parts on a phone; all disabled with a reason when none of the club's
              teams plays. */}
          <Box data-testid="match-header-actions" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <ActionSlot disabled={noOwnTeam}>
              {noOwnTeam ? (
                <MuiButton variant="outlined" disabled startIcon={<GroupsOutlinedIcon fontSize="small" />} sx={ACTION_SX}>
                  Select team
                </MuiButton>
              ) : (
                <MuiButton
                  component={RouterLink}
                  to={`${editTo}?tab=playing-xi`}
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
        </Stack>
      </PageHeaderBand>

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
            alignItems: 'stretch',
            gridTemplateColumns:
              own.length === 1 ? 'minmax(0, 640px)' : 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))',
          }}
        >
          {own.map((entry) => {
            const side = entry.side === 'home' ? homeSide : awaySide
            const squadQuery = entry.side === 'home' ? homeSquadQuery : awaySquadQuery
            return (
              <TeamCard
                key={entry.side}
                matchId={match.id}
                entry={entry}
                teamName={entry.side === 'home' ? homeName : awayName}
                side={side}
                squad={squadQuery.data ?? []}
                announced={Boolean(side?.announced)}
                announcedReady={sidesReady}
                sidesReady={sidesReady}
                playingXiSize={hasLeague ? (side?.limits?.maxSelected ?? null) : null}
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

interface SideLogo {
  src: string | null
  initials: string
}

// Source per side (spec 1a): a real team's logo is Team.logoUrl; a free-text or league-team
// opponent's is the match's copied side logo. No logo shows initials: the team's abbreviation when
// it has one, else the name's initials.
function logoFor(
  teamId: string | null,
  sideLogoUrl: string | null,
  name: string,
  teamsById: Map<string, Team>,
): SideLogo {
  const team = teamId ? teamsById.get(teamId) : undefined
  const src = teamId ? (team?.logoUrl ?? null) : sideLogoUrl
  return { src, initials: team?.abbreviation || initialsFromName(name) }
}

function TeamTitle({ name, logo, testId }: { name: string; logo: SideLogo | null; testId: string }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      {logo && (
        <Avatar
          variant="rounded"
          src={logo.src ?? undefined}
          alt=""
          aria-hidden
          data-testid={testId}
          sx={{
            width: { xs: 30, sm: 36 },
            height: { xs: 30, sm: 36 },
            flex: 'none',
            fontSize: 11,
            fontWeight: 700,
            bgcolor: 'background.paper',
            color: 'primary.main',
            border: 1,
            borderColor: 'divider',
          }}
        >
          {logo.initials}
        </Avatar>
      )}
      <Box component="span" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        {name}
      </Box>
    </Box>
  )
}

interface TeamCardProps {
  matchId: string
  entry: OwnSide
  teamName: string
  side: MatchSide | undefined
  squad: SquadMember[]
  announced: boolean
  announcedReady: boolean
  sidesReady: boolean
  playingXiSize: number | null
}

function TeamCard({
  matchId,
  entry,
  teamName,
  side,
  squad,
  announced,
  announcedReady,
  sidesReady,
  playingXiSize,
}: TeamCardProps) {
  const sideLabel = entry.side === 'home' ? 'Home' : 'Away'
  const players = side?.players ?? []
  const picked = players.length
  const nothingSelected = players.length === 0 && !side?.twelfthManPlayerId
  const editBase = `${MATCHES_PATH}/${matchId}/edit`
  const announcedChip = announcedBadge(announced, '')

  return (
    <MuiCard
      variant="outlined"
      data-testid={`match-team-card-${entry.side}`}
      sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, bgcolor: 'background.paper', boxShadow: 2 }}
    >
      <Stack spacing={1} sx={{ px: 2, pt: 1.75, pb: 1 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="subtitle1" component="h2" fontWeight={700} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            {`${teamName} · ${sideLabel}`}
          </Typography>
          {announcedReady && (
            <Chip
              size="small"
              label={announcedChip.label}
              variant={announcedChip.tone === 'neutral' ? 'outlined' : 'filled'}
              sx={badgeSx(announcedChip.tone)}
            />
          )}
        </Box>

        {sidesReady && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="body2" fontWeight={700}>
            Playing XI
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {playingXiSize === null ? `${picked} picked` : `${picked} of ${playingXiSize} picked`}
          </Typography>
        </Box>
        )}
        {sidesReady && playingXiSize !== null && (
          <>
            <CardProgressBar
              value={picked}
              max={playingXiSize}
              ariaLabel={`${teamName} selection`}
              valueText={`${picked} of ${playingXiSize} picked`}
            />
            <Typography variant="caption" color="text.secondary">
              {pickedLegend(picked, playingXiSize)}
            </Typography>
          </>
        )}
      </Stack>

      <Box sx={{ px: 2, pb: 2, pt: 0.5, minWidth: 0 }}>
        {!sidesReady ? null : nothingSelected ? (
          <Stack spacing={1.25} alignItems="flex-start" sx={{ py: 1 }}>
            <Typography variant="body2" color="text.secondary">
              No players selected yet.
            </Typography>
            <MuiButton
              component={RouterLink}
              to={`${editBase}?tab=playing-xi`}
              variant="outlined"
              size="small"
              startIcon={<GroupsOutlinedIcon fontSize="small" />}
            >
              Select team
            </MuiButton>
          </Stack>
        ) : (
          <PlayingXiSummary
            squad={squad}
            xi={players}
            captainPlayerId={side?.captainPlayerId ?? null}
            wicketKeeperPlayerId={side?.wicketKeeperPlayerId ?? null}
            twelfthManPlayerId={side?.twelfthManPlayerId ?? null}
          />
        )}
      </Box>
    </MuiCard>
  )
}
