import { useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { ReactNode } from 'react'
import { Link as RouterLink, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, Chip, Menu, MenuItem, Stack, Link as MuiLink, ToggleButton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { CompactToggleGroup } from '../../../components/CompactToggleGroup'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import { CardTimeStrip } from '../../../components/CardTimeStrip'
import { EmptyState } from '../../../components/EmptyState'
import { CardForecastStrip } from '../../../components/CardForecastStrip'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import { Button } from '../../../components/Button'
import { HeaderActions, HeaderShareButton } from '../../../components/HeaderShareButton'
import { KeyFigureTile } from '../../../components/KeyFigureTile'
import { ManageMenu } from '../../../components/ManageMenu'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { badgeSx } from '../../../components/RecordCard'
import { TeamSelectionList } from '../../../components/TeamSelectionList'
import { getMatch } from '../../../api/matchApi'
import type { Match } from '../../../api/matchApi'
import { listTeamsForClub } from '../../../api/teamApi'
import type { Team } from '../../../api/teamApi'
import { listLeagues } from '../../../api/leagueApi'
import { listMatchSides } from '../../../api/matchSideApi'
import type { MatchSide } from '../../../api/matchSideApi'
import { listPolls } from '../../../api/matchAvailabilityApi'
import { getMatchSquad } from '../../../api/matchSquadApi'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { useMatchLocationItems } from '../../../hooks/useMatchLocationItems'
import { formatMatchDateTime } from '../../../utils/matchDateTime'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { matchPollsFrom, pollDestination } from '../matches/matchCardHelpers'
import type { MatchSquadCoverage, PollDestination } from '../matches/matchCardHelpers'
import { TeamLogo } from '../matches/TeamLogo'
import { logoFor } from '../matches/teamLogoHelpers'
import { useAvailabilityNavigation } from '../matches/useAvailabilityNavigation'
import { AvailablePlayersSection } from './AvailablePlayersSection'
import { RolePickerTile } from './RolePickerTile'
import { SelectTeamDialogs } from './SelectTeamDialogs'
import { sideDisplayName, sideStatus } from './matchSideHelpers'
import { STATUS_LABELS, STATUS_TONES } from './selectionStatus'
import { sideMenuItems } from './sideMenuItems'
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
      leagueFormat={match.leagueId ? ((leaguesQuery.data ?? []).find((league) => league.id === match.leagueId)?.format ?? null) : null}
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
  leagueFormat: string | null
}

function SelectTeamContent({ clubId, match, teamId, sideLabel, sides, teamsById, leagueName, leagueFormat }: ContentProps) {
  const navigate = useNavigate()
  const location = useLocation()
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

  const manageAnchor = useRef<HTMLDivElement>(null)
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null)
  const location_ = useMatchLocationItems(clubId, match, { title, leagueFormat })
  // docs/specs/137: ONE Manage Team menu, built by the same function as the Matches row kebab so they cannot drift.
  const manageItems = sideMenuItems({
    // The page decides readiness itself (panel.blockedReason), as it always did; the list views use the overview's status.
    side: { status: side && !panel.blockedReason ? 'READY_TO_ANNOUNCE' : status, announced: Boolean(side?.announced), sideId: side?.id ?? null },
    selectTo: undefined,
    onSelectPlayers: panel.dialog.openDialog,
    selectDisabled: !side,
    // The availability menu (when several polls cover the match) opens under the Manage Team button.
    onAvailability: () => openAvailability({ currentTarget: manageAnchor.current } as unknown as MouseEvent<HTMLElement>),
    availabilityDisabled: !pollsReady,
    onAnnounce: () => panel.setConfirmAnnounce(true),
    announcing: panel.announcing,
    announceBlockedReason: panel.blockedReason ?? undefined,
    onUnannounce: panel.unannounce,
    onShare: () => shareSide.share(match.id, sideLabel === 'Home'),
    sharing: shareSide.loadingMatchId === match.id,
    locationItems: location_.items,
  })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.75, md: 2 } }}>
      <ManageScreenHeader
        title={title}
        backTo={HUB_PATH}
        backLabel="Back to Team Selection"
        // docs/specs/137: the logos and the Announced badge sit beside the title; the page is about one match, so there is no Season pill.
        titleAdornment={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {(logos[0].src || logos[1].src) && (
              <Box sx={{ display: 'flex', gap: 0.5, flex: 'none' }}>
                {logos[0].src && <TeamLogo logo={logos[0]} testId="select-logo-home" />}
                {logos[1].src && <TeamLogo logo={logos[1]} testId="select-logo-away" />}
              </Box>
            )}
            <Chip size="small" label={side?.announced ? STATUS_LABELS.ANNOUNCED : 'Not Announced'} variant="filled" sx={badgeSx(side?.announced ? STATUS_TONES.ANNOUNCED : 'neutral')} />
          </Box>
        }
        subtitle={
          <Box>
            <Typography variant="subtitle1" fontWeight={600} color="text.primary" component="span" data-testid="select-subtitle">
              {formatMatchDateTime(match.matchDate)}
              {leagueName && match.leagueId ? (
                <>
                  {' · '}
                  <MuiLink component={RouterLink} to={withReturnTo(`/manage/fixtures/leagues/${match.leagueId}`, currentOrigin(location), 'Team Selection')} color="inherit" underline="hover">
                    {leagueName}
                  </MuiLink>
                </>
              ) : null}
              {/* docs/specs/137 (owner, 2026-11-05): the venue is simply part of the one sub-header line, no directions button here. */}
              {(match.playingAreaName ?? match.venue) ? ` · ${match.playingAreaName ?? match.venue}` : null}
            </Typography>
          </Box>
        }
        action={
          <Box ref={manageAnchor}>
            <HeaderActions
              beside={
                <>
                {/* docs/specs/138 (owner, 2026-11-05): beside Manage Team, an announced side offers Share; a side that can be announced offers Announce Team instead. */}
                {side?.announced ? (
                  <HeaderShareButton onClick={() => shareSide.share(match.id, sideLabel === 'Home')} testId="select-share" />
                ) : side && !panel.blockedReason ? (
                  <Button variant="secondary" size="compact" startIcon={<CampaignOutlinedIcon fontSize="small" />} onClick={() => panel.setConfirmAnnounce(true)} disabled={panel.announcing} data-testid="select-announce">
                    {panel.announcing ? 'Announcing…' : 'Announce Team'}
                  </Button>
                ) : null}
                </>
              }
            >
              <ManageMenu label="Manage Team" fixedWidth testId="manage-team" groups={[{ id: 'team', heading: 'Team', items: manageItems }]} />
            </HeaderActions>
          </Box>
        }
      />
      {availabilityMenu}
      {location_.dialogs}
      {panel.announceError && <Alert severity="error">{panel.announceError}</Alert>}

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
        sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}
      >
        <KeyFigureTile
          testId="select-selected"
          counter
          value={limits ? `${panel.selectedCount} of ${limits.maxSelected}` : '–'}
          label="Selected"
        />
        <RolePickerTile
          testId="select-captain"
          counter
          label="Captain"
          currentId={side?.captainPlayerId ?? null}
          currentName={nameOfCaptain}
          players={rolePlayers}
          disabled={!side || panel.writing}
          onChange={panel.onSetCaptain}
        />
        <RolePickerTile
          testId="select-keeper"
          counter
          label="Wicketkeeper"
          currentId={side?.wicketKeeperPlayerId ?? null}
          currentName={nameOfKeeper}
          players={rolePlayers}
          disabled={!side || panel.writing}
          onChange={panel.onSetWicketKeeper}
        />
        {/* docs/specs/137 (owner, 2026-11-05): the Status figure is a picker like Captain and Wicketkeeper: a click offers Announce Team, or
            Un-announce Team once announced, with the reason when it cannot be announced yet. */}
        <KeyFigureTile
          testId="select-status"
          counter
          value={STATUS_LABELS[status]}
          label="Status"
          tone={status === 'NOT_STARTED' ? 'warning' : 'neutral'}
          textValue
          onClick={(event) => setStatusAnchor(event.currentTarget)}
          ariaLabel={`Status: ${STATUS_LABELS[status]}, change`}
          expanded={Boolean(statusAnchor)}
          disabled={!side}
        />
        <Menu anchorEl={statusAnchor} open={Boolean(statusAnchor)} onClose={() => setStatusAnchor(null)} MenuListProps={{ 'aria-label': 'Status' }}>
          {manageItems
            .filter((item) => item.id === 'announce' || item.id === 'unannounce')
            .map((item) => (
              <MenuItem
                key={item.id}
                disabled={item.disabled}
                onClick={() => {
                  setStatusAnchor(null)
                  item.onClick?.()
                }}
                sx={{ minHeight: 44, display: 'block' }}
              >
                <Typography variant="body2" fontWeight={600}>
                  {item.title}
                </Typography>
                {item.disabled && item.reason && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'normal', maxWidth: 280 }}>
                    {item.reason}
                  </Typography>
                )}
              </MenuItem>
            ))}
        </Menu>
      </Box>

      {/* docs/specs/137: the forecast (within the forecast window) and the Team Manager (a placeholder until a team can have one) as strip cards. */}
      <Box sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        <CardForecastStrip testId="select-weather" weather={location_.weather} matchDate={match.matchDate} />
        <CardTimeStrip testId="select-manager" icon={<PersonOutlineOutlinedIcon fontSize="small" />} label="Team Manager" value={<Box component="span" sx={{ color: 'text.secondary' }}>–</Box>} />
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
                onSelectPlayers={panel.dialog.openDialog}
              />
              {/* The hint sits under the list (owner, 2026-11-05). */}
              <Typography variant="body2" color="text.secondary">
                Tap a player's name for captain, wicketkeeper, batting position and more. Drag the handle to reorder.
              </Typography>
              {panel.pool && (
                <AvailablePlayersSection
                  entries={panel.pool.entries}
                  selectedCount={panel.selectedCount}
                  maxSelected={limits.maxSelected}
                  onSelectOtherPlayer={panel.dialog.openDialogOnWholeSection}
                  onCreatePlayer={panel.addPlayer.openDialog}
                  onAddPlayer={panel.addAvailablePlayer}
                  addingId={panel.addingId}
                  addError={panel.addError}
                />
              )}
            </>
          )}
        </Stack>
      )}

      {shareSide.dialog}
      <SelectTeamDialogs panel={panel} teamName={teamName} matchDate={match.matchDate} />
    </Box>
  )
}
