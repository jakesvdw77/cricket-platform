import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Link as RouterLink, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, Button as MuiButton, Stack, ToggleButton, Tooltip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import IosShareOutlinedIcon from '@mui/icons-material/IosShareOutlined'
import PanToolOutlinedIcon from '@mui/icons-material/PanToolOutlined'
import StarBorderOutlinedIcon from '@mui/icons-material/StarBorderOutlined'
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined'
import { Button } from '../../../components/Button'
import { CompactToggleGroup } from '../../../components/CompactToggleGroup'
import { EmptyState } from '../../../components/EmptyState'
import { HeaderSeasonSelect } from '../../../components/HeaderSeasonSelect'
import { KeyFigureTile } from '../../../components/KeyFigureTile'
import { PageHeaderBand } from '../../../components/PageHeaderBand'
import { TeamSelectionList } from '../../../components/TeamSelectionList'
import { getMatch } from '../../../api/matchApi'
import type { Match } from '../../../api/matchApi'
import { listTeamsForClub } from '../../../api/teamApi'
import type { Team } from '../../../api/teamApi'
import { listSeasons } from '../../../api/seasonApi'
import { listLeagues } from '../../../api/leagueApi'
import { listMatchSides } from '../../../api/matchSideApi'
import type { MatchSide } from '../../../api/matchSideApi'
import { listPolls } from '../../../api/matchAvailabilityApi'
import { getMatchSquad } from '../../../api/matchSquadApi'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { formatMatchDateTime } from '../../../utils/matchDateTime'
import { matchPollsFrom, pollDestination } from '../matches/matchCardHelpers'
import type { MatchSquadCoverage, PollDestination } from '../matches/matchCardHelpers'
import { TeamLogo } from '../matches/TeamLogo'
import { logoFor } from '../matches/teamLogoHelpers'
import { useAvailabilityNavigation } from '../matches/useAvailabilityNavigation'
import { RolePickerTile } from './RolePickerTile'
import { SelectTeamDialogs } from './SelectTeamDialogs'
import { sideDisplayName, sideStatus } from './matchSideHelpers'
import { STATUS_LABELS } from './selectionStatus'
import { selectTeamPath } from './selectionLinks'
import { useMatchSidePanel } from './useMatchSidePanel'
import { useShareAnnouncedSide } from './useShareAnnouncedSide'

const HUB_PATH = '/manage/team-selection/matches'

type SideLabel = 'Home' | 'Away'

// docs/specs/064-unified-availability-polls.md: the Availability button reads which poll (if any) covers this match for
// one side, from the squad endpoint (a non-null windowId = a group poll) and the match's squad polls. Both queries use
// the shared keys the Match View uses, so React Query dedupes the requests.
function useSideCoverage(clubId: string, matchId: string, teamId: string | null) {
  const enabled = Boolean(teamId)
  const matchSquadQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId, 'teams', teamId, 'squad'],
    queryFn: () => getMatchSquad(clubId, matchId, teamId as string),
    enabled,
  })
  const pollsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId, 'polls'],
    queryFn: () => listPolls(clubId, matchId),
    enabled,
  })
  return { matchSquadQuery, pollsQuery }
}

function NoticeLine({ tone, children }: { tone: 'warning' | 'error' | 'info'; children: ReactNode }) {
  return (
    <Box
      role="status"
      sx={{
        bgcolor: (theme: Theme) => alpha(theme.palette[tone].main, 0.12),
        border: 1,
        borderColor: (theme: Theme) => alpha(theme.palette[tone].main, 0.4),
        borderRadius: 2,
        px: 1.5,
        py: 1,
        fontSize: 13,
      }}
    >
      {children}
    </Box>
  )
}

// docs/specs/093-team-selection-hub.md, Select team page: replaces the Home XI / Away XI tabs of Edit Match. The route
// is /manage/team-selection/matches/:matchId/sides/:sideId; :sideId is a real side id, or "home" / "away" while the
// club's side does not exist yet (the side is then created on first use, as the tabs did). This outer component loads
// the match and lookups and resolves which team the page is about.
export default function SelectTeamPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { matchId, sideId } = useParams<{ matchId: string; sideId: string }>()

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
  const sidesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId, 'sides'],
    queryFn: () => listMatchSides(clubId as string, matchId as string),
    enabled: Boolean(clubId) && Boolean(matchId),
  })

  const teamsById = useMemo(() => new Map((teamsQuery.data ?? []).map((team): [string, Team] => [team.id, team])), [teamsQuery.data])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }
  if (matchQuery.isLoading || sidesQuery.isLoading) {
    return null
  }
  const match = matchQuery.data
  if (matchQuery.isError || !match) {
    return <EmptyState title="Couldn't load this match" description="Something went wrong loading this match. Please try again." />
  }
  if (!match.homeTeamId && !match.awayTeamId) {
    return (
      <EmptyState
        title="No team to select"
        description="None of your teams is playing in this match, so there is no team to select."
      />
    )
  }

  const sides = sidesQuery.data ?? []
  // A real side id decides the team; the placeholders "home" / "away" (and an id that matches nothing) fall back to the
  // named side, then to the only own team.
  const known = sides.find((candidate) => candidate.id === sideId)
  const wantAway = known ? known.teamId === match.awayTeamId && known.teamId !== match.homeTeamId : sideId === 'away'
  const teamId = (wantAway ? (match.awayTeamId ?? match.homeTeamId) : (match.homeTeamId ?? match.awayTeamId)) as string
  const sideLabel: SideLabel = teamId === match.awayTeamId && (wantAway || !match.homeTeamId) ? 'Away' : 'Home'
  const leagueName = match.leagueId ? ((leaguesQuery.data ?? []).find((league) => league.id === match.leagueId)?.name ?? null) : null
  const season = (seasonsQuery.data ?? []).find((candidate) => candidate.id === match.seasonId)

  return (
    <SelectTeamContent
      key={teamId}
      clubId={clubId}
      match={match}
      teamId={teamId}
      sideLabel={sideLabel}
      sides={sides}
      teamsById={teamsById}
      leagueName={leagueName}
      seasonName={season?.label ?? null}
    />
  )
}

interface ContentProps {
  clubId: string
  match: Match
  teamId: string
  sideLabel: SideLabel
  sides: MatchSide[]
  teamsById: Map<string, Team>
  leagueName: string | null
  seasonName: string | null
}

function SelectTeamContent({ clubId, match, teamId, sideLabel, sides, teamsById, leagueName, seasonName }: ContentProps) {
  const navigate = useNavigate()
  const homeName = sideDisplayName(match.homeTeamId, match.homeTeamName, teamsById)
  const awayName = sideDisplayName(match.awayTeamId, match.awayTeamName, teamsById)
  const teamName = sideLabel === 'Home' ? homeName : awayName
  const title = `${homeName} v ${awayName}`
  useDocumentTitle(`Select team · ${title}`)

  const panel = useMatchSidePanel({ clubId, match, teamId, teamName, teamsById })
  const { side } = panel
  const shareSide = useShareAnnouncedSide(clubId)

  // The header Availability button follows the match card's destination rule (docs/specs/075 section 3): getMatch returns
  // no polls, so they are rebuilt from the coverage and polls queries this page already runs.
  const homeCoverage = useSideCoverage(clubId, match.id, match.homeTeamId)
  const awayCoverage = useSideCoverage(clubId, match.id, match.awayTeamId)
  const ownTeamIds = [match.homeTeamId, match.awayTeamId].filter((id): id is string => Boolean(id))
  const coverageByTeamId = new Map<string, MatchSquadCoverage | undefined>()
  if (match.homeTeamId) coverageByTeamId.set(match.homeTeamId, homeCoverage.matchSquadQuery.data)
  if (match.awayTeamId) coverageByTeamId.set(match.awayTeamId, awayCoverage.matchSquadQuery.data)
  const squadPolls = homeCoverage.pollsQuery.data ?? awayCoverage.pollsQuery.data ?? []
  // A failed query is NOT ready: the poll state is unknown, so Availability stays disabled rather than offering the New
  // poll flow for a match that may have a poll.
  const pollsReady = [homeCoverage.matchSquadQuery, awayCoverage.matchSquadQuery, homeCoverage.pollsQuery, awayCoverage.pollsQuery]
    .every((query) => !query.isLoading && !query.isError)
  const availabilityDestination: PollDestination = pollDestination(
    { ...match, polls: matchPollsFrom(ownTeamIds, squadPolls, coverageByTeamId) },
    teamsById,
  )
  const { openAvailability, menu: availabilityMenu } = useAvailabilityNavigation(availabilityDestination)

  const hasBothSides = Boolean(match.homeTeamId) && Boolean(match.awayTeamId)
  const logos = [
    logoFor(match.homeTeamId, match.homeTeamLogoUrl, homeName, teamsById),
    logoFor(match.awayTeamId, match.awayTeamLogoUrl, awayName, teamsById),
  ]
  const sideTo = (target: SideLabel) => {
    const targetTeamId = target === 'Home' ? match.homeTeamId : match.awayTeamId
    const existing = sides.find((candidate) => candidate.teamId === targetTeamId)
    return selectTeamPath(match.id, existing?.id ?? null, target === 'Home')
  }

  const status = side ? sideStatus(side) : 'NOT_STARTED'
  const nameOfCaptain = side?.captainPlayerId ? panel.nameOf(side.captainPlayerId) : null
  const nameOfKeeper = side?.wicketKeeperPlayerId ? panel.nameOf(side.wicketKeeperPlayerId) : null
  const limits = side?.limits
  // A role can go to any picked player except the 12th man.
  const rolePlayers = (side?.players ?? [])
    .filter((player) => player.playerProfileId !== side?.twelfthManPlayerId)
    .map((player) => ({ playerId: player.playerProfileId, name: panel.nameOf(player.playerProfileId) }))
  const blockedReasonId = side ? `announce-blocked-${side.id}` : undefined
  const subtitle = [formatMatchDateTime(match.matchDate), leagueName].filter(Boolean).join(' · ')

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.75, md: 2 } }}>
      <PageHeaderBand>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
            <MuiButton
              component={RouterLink}
              to={HUB_PATH}
              variant="text"
              color="inherit"
              size="small"
              startIcon={<ArrowBackIcon fontSize="small" />}
              sx={{ ml: -1, color: 'text.secondary' }}
            >
              Back to Team selection
            </MuiButton>
            {/* The season of the match (the page is about one match, so it is shown, not changed). */}
            {seasonName && (
              <HeaderSeasonSelect
                seasons={[{ id: match.seasonId, name: seasonName }]}
                value={match.seasonId}
                onChange={() => undefined}
                showAll={false}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 1.5 }, flex: '1 1 320px', minWidth: 0 }}>
              {(logos[0].src || logos[1].src) && (
                <Box sx={{ display: 'flex', gap: 0.5, flex: 'none' }}>
                  {logos[0].src && <TeamLogo logo={logos[0]} testId="select-logo-home" />}
                  {logos[1].src && <TeamLogo logo={logos[1]} testId="select-logo-away" />}
                </Box>
              )}
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="h5"
                  component="h1"
                  fontWeight={700}
                  sx={{ lineHeight: 1.2, overflowWrap: 'anywhere' }}
                >
                  {title}
                </Typography>
                <Typography variant="body2" color="text.secondary" data-testid="select-subtitle">
                  {subtitle}
                </Typography>
              </Box>
            </Box>

            {/* The one action group: Availability, Announce team and Share team (outlined), Select players (filled). */}
            <Box
              data-testid="select-actions"
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, auto)' },
                width: { xs: '100%', md: 'auto' },
                justifyContent: { md: 'end' },
              }}
            >
              <MuiButton
                variant="outlined"
                disabled={!pollsReady}
                onClick={openAvailability}
                startIcon={<EventAvailableOutlinedIcon fontSize="small" />}
                sx={{ justifyContent: 'center', minWidth: 0 }}
              >
                Availability
              </MuiButton>
              {side?.announced ? (
                <MuiButton
                  variant="outlined"
                  onClick={panel.unannounce}
                  disabled={panel.announcing}
                  sx={{ justifyContent: 'center', minWidth: 0 }}
                >
                  {panel.unannouncePending ? 'Un-announcing…' : 'Un-announce'}
                </MuiButton>
              ) : (
                <Tooltip
                  title={panel.blockedReason ?? ''}
                  disableHoverListener={!panel.blockedReason}
                  disableFocusListener={!panel.blockedReason}
                >
                  <Box component="span" sx={{ display: 'flex', minWidth: 0 }}>
                    <MuiButton
                      variant="outlined"
                      onClick={() => panel.setConfirmAnnounce(true)}
                      disabled={!side || Boolean(panel.blockedReason) || panel.announcing}
                      aria-describedby={panel.blockedReason ? blockedReasonId : undefined}
                      sx={{ justifyContent: 'center', minWidth: 0, flex: 1 }}
                    >
                      {panel.announcePending ? 'Announcing…' : 'Announce team'}
                    </MuiButton>
                  </Box>
                </Tooltip>
              )}
              <Tooltip title={side?.announced ? '' : 'Announce the team to share it'}>
                <Box component="span" sx={{ display: 'flex', minWidth: 0 }}>
                  <MuiButton
                    variant="outlined"
                    onClick={() => shareSide.share(match.id, sideLabel === 'Home')}
                    disabled={!side?.announced || shareSide.loadingMatchId === match.id}
                    startIcon={<IosShareOutlinedIcon fontSize="small" />}
                    sx={{ justifyContent: 'center', minWidth: 0, flex: 1 }}
                  >
                    Share team
                  </MuiButton>
                </Box>
              </Tooltip>
              <Button
                startIcon={<GroupsOutlinedIcon fontSize="small" />}
                onClick={panel.dialog.openDialog}
                disabled={!side}
                sx={{ justifyContent: 'center' }}
              >
                Select players
              </Button>
            </Box>
          </Box>
          {availabilityMenu}
          {panel.blockedReason && !side?.announced && (
            <Typography id={blockedReasonId} variant="caption" color="text.secondary" sx={{ textAlign: { md: 'right' } }}>
              {panel.blockedReason}
            </Typography>
          )}
          {panel.announceError && <Alert severity="error">{panel.announceError}</Alert>}
        </Stack>
      </PageHeaderBand>

      {hasBothSides && (
        <CompactToggleGroup<SideLabel>
          value={sideLabel}
          onChange={(next) => navigate(sideTo(next))}
          ariaLabel="Side"
          fullWidthOnPhone
        >
          <ToggleButton value="Home" aria-label="Home XI">
            Home XI
          </ToggleButton>
          <ToggleButton value="Away" aria-label="Away XI">
            Away XI
          </ToggleButton>
        </CompactToggleGroup>
      )}

      <Box
        data-testid="select-strip"
        sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}
      >
        <KeyFigureTile
          testId="select-selected"
          icon={<GroupsOutlinedIcon fontSize="small" />}
          value={limits ? `${panel.selectedCount} of ${limits.maxSelected}` : '–'}
          label="Selected"
        />
        <RolePickerTile
          testId="select-captain"
          icon={<StarBorderOutlinedIcon fontSize="small" />}
          label="Captain"
          currentId={side?.captainPlayerId ?? null}
          currentName={nameOfCaptain}
          players={rolePlayers}
          disabled={!side || panel.writing}
          onChange={panel.onSetCaptain}
        />
        <RolePickerTile
          testId="select-keeper"
          icon={<PanToolOutlinedIcon fontSize="small" />}
          label="Wicketkeeper"
          currentId={side?.wicketKeeperPlayerId ?? null}
          currentName={nameOfKeeper}
          players={rolePlayers}
          disabled={!side || panel.writing}
          onChange={panel.onSetWicketKeeper}
        />
        <KeyFigureTile
          testId="select-status"
          icon={<TaskAltOutlinedIcon fontSize="small" />}
          value={STATUS_LABELS[status]}
          label="Status"
          tone={status === 'NOT_STARTED' ? 'warning' : 'neutral'}
          textValue
        />
      </Box>

      {panel.settingUp || !side || !limits ? (
        <Typography variant="body2" color="text.secondary">
          {`Setting up ${teamName}…`}
        </Typography>
      ) : (
        <Stack spacing={2} data-testid="selection-panel">
          {panel.poolLoaded && !panel.covered && panel.selectedCount > 0 && (
            <NoticeLine tone="warning">No availability poll covers this match, so nobody's availability is confirmed.</NoticeLine>
          )}
          {panel.unconfirmed > 0 && (
            <NoticeLine tone="warning">
              <b>
                {panel.unconfirmed === 1
                  ? '1 selected player is not confirmed available'
                  : `${panel.unconfirmed} selected players are not confirmed available`}
              </b>
              {` (${panel.breakdown}).`}
            </NoticeLine>
          )}
          {panel.lateUnavailable > 0 && (
            <NoticeLine tone="error">
              {panel.lateUnavailable === 1
                ? '1 selected player has since said they are unavailable'
                : `${panel.lateUnavailable} selected players have since said they are unavailable`}
            </NoticeLine>
          )}

          {panel.listError && <Alert severity="error">{panel.listError}</Alert>}

          {panel.waitingCount > 0 && (
            <NoticeLine tone="warning">
              <b>
                {panel.waitingCount === panel.restCount
                  ? `${panel.waitingCount} ${panel.waitingCount === 1 ? 'player is' : 'players are'} selected but the batting order is not set.`
                  : `${panel.waitingCount} ${panel.waitingCount === 1 ? 'player is' : 'players are'} not in the batting order yet.`}
              </b>
              {' Drag them into order or open a player and type a position.'}
            </NoticeLine>
          )}

          {panel.poolLoading && panel.selectedCount > 0 ? (
            <Typography variant="body2" color="text.secondary">
              Loading players…
            </Typography>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                Tap a player's name for captain, wicketkeeper, batting position and more. Drag the handle to reorder.
              </Typography>
              <TeamSelectionList
                players={panel.listPlayers}
                captainPlayerId={side.captainPlayerId}
                wicketKeeperPlayerId={side.wicketKeeperPlayerId}
                twelfthManPlayerId={side.twelfthManPlayerId}
                limits={limits}
                dragDisabled={side.announced}
                onReorder={panel.onReorder}
                onSetCaptain={panel.onSetCaptain}
                onSetWicketKeeper={panel.onSetWicketKeeper}
                onMakeTwelfthMan={panel.onMakeTwelfthMan}
                onChangeRole={panel.onChangeRole}
                onRemove={panel.onRemove}
              />
            </>
          )}
        </Stack>
      )}

      {shareSide.dialog}
      <SelectTeamDialogs panel={panel} teamName={teamName} matchDate={match.matchDate} />
    </Box>
  )
}
