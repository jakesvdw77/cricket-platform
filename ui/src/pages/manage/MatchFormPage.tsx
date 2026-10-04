import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Alert,
  Box,
  Button as MuiButton,
  Chip,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import { MatchForm, MATCH_FORM_ID } from '../../components/MatchForm'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { CreateAndLinkRecordDialog } from '../../components/CreateAndLinkRecordDialog'
import { LinkExistingRecordDialog } from '../../components/LinkExistingRecordDialog'
import { PlayerForm, PLAYER_FORM_ID } from '../../components/PlayerForm'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { CardProgressBar } from '../../components/CardProgressBar'
import { badgeSx } from '../../components/RecordCard'
import { SelectPlayersDialog } from '../../components/SelectPlayersDialog'
import type { SelectionApplyOutcome } from '../../components/SelectPlayersDialog'
import { TeamSelectionList } from '../../components/TeamSelectionList'
import type { TeamSelectionPlayer } from '../../components/TeamSelectionList'
import { RecordStatusToggle } from '../../components/RecordStatusToggle'
import { EmptyState } from '../../components/EmptyState'
import {
  getMatch,
  createMatch,
  updateMatch,
  deactivateMatch,
  reactivateMatch,
  listPreviousMatches,
} from '../../api/matchApi'
import type { Match, MatchPayload } from '../../api/matchApi'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { listSeasons } from '../../api/seasonApi'
import { listLeagues } from '../../api/leagueApi'
import { listLeagueAffiliations } from '../../api/leagueAffiliationApi'
import { leagueTeamsQueryKey, listLeagueTeams } from '../../api/leagueTeamApi'
import { activateSession } from '../../api/meApi'
import { addToSquad } from '../../api/teamSquadApi'
import { createPlayer } from '../../api/playerApi'
import type { PlayerPayload } from '../../api/playerApi'
import {
  listMatchSides,
  createMatchSide,
  updateMatchSide,
  updateMatchSidePlayerRole,
  removeMatchSidePlayer,
  reorderMatchSidePlayers,
  announceMatchSide,
  unannounceMatchSide,
} from '../../api/matchSideApi'
import type { MatchSide, MatchSidePlayer, PlayingRole, UpdateMatchSidePayload } from '../../api/matchSideApi'
import {
  applySelection,
  getSelectionPool,
  selectionPoolQueryKey,
} from '../../api/matchSelectionApi'
import type {
  SelectionPool,
  SelectionPoolEntry,
  SelectionRejectedBody,
} from '../../api/matchSelectionApi'
import { listPolls } from '../../api/matchAvailabilityApi'
import { getMatchSquad } from '../../api/matchSquadApi'
import { errorDetail } from '../../utils/errorDetail'
import { formatMatchDateTime } from '../../utils/matchDateTime'
import { squadDisplayName } from '../../utils/squadDisplayName'
import { announcedBadge, matchPollsFrom, NO_CLUB_TEAM_REASON, pollDestination } from './matches/matchCardHelpers'
import type { MatchSquadCoverage, PollDestination } from './matches/matchCardHelpers'
import { useAvailabilityNavigation } from './matches/useAvailabilityNavigation'

// docs/specs/076-team-selection.md section 1: the edit page's tabs, in tab-bar order. The Match
// Squad tab is gone; a side's team selection lives in its own Home XI / Away XI tab.
type MatchTabKey = 'details' | 'home-xi' | 'away-xi'

// Same "resolve a side's display name" fallback MatchList.tsx already uses: a real Team's own
// name from the club's own team list (cross-club Team references may not resolve here — falls
// back to a generic label, matching MatchList's own precedent), else the match's own free-text
// name.
function sideDisplayName(teamId: string | null, teamName: string | null, teamsById: Map<string, Team>): string {
  if (teamName) {
    return teamName
  }
  if (teamId) {
    return teamsById.get(teamId)?.name ?? 'Unknown team'
  }
  return 'Unknown team'
}

// docs/specs/037-match-improvements.md item 9: resolves the *other* side's display name for a
// previous-match candidate in the "Re-select from previous match" picker — mirrors
// sideDisplayName above rather than duplicating its team-lookup logic.
function opponentLabel(match: Match, teamId: string, teamsById: Map<string, Team>): string {
  if (match.homeTeamId === teamId) {
    return sideDisplayName(match.awayTeamId, match.awayTeamName, teamsById)
  }
  return sideDisplayName(match.homeTeamId, match.homeTeamName, teamsById)
}

// A side counts as "non-empty" (and therefore needs a destructive-replace confirmation before
// "Re-select from previous match" overwrites it) if it has any selected player or any of
// captain/wicketkeeper/twelfth-man set.
function isSideNonEmpty(matchSide: MatchSide): boolean {
  return (
    matchSide.players.length > 0 ||
    Boolean(matchSide.captainPlayerId) ||
    Boolean(matchSide.wicketKeeperPlayerId) ||
    Boolean(matchSide.twelfthManPlayerId)
  )
}

// docs/specs/064-unified-availability-polls.md: the header Availability button reads which poll (if
// any) covers this match for one side, from the squad endpoint (a non-null windowId = a group poll)
// and the match's squad polls. Always enabled for a real-Team side; both queries use the shared
// keys the Match View uses, so React Query dedupes the requests.
function useSideCoverage(clubId: string | undefined, matchId: string | undefined, teamId: string | null | undefined) {
  const enabled = Boolean(clubId) && Boolean(matchId) && Boolean(teamId)

  const matchSquadQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId, 'teams', teamId, 'squad'],
    queryFn: () => getMatchSquad(clubId as string, matchId as string, teamId as string),
    enabled,
  })

  const pollsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId, 'polls'],
    queryFn: () => listPolls(clubId as string, matchId as string),
    enabled,
  })

  return { matchSquadQuery, pollsQuery }
}

// --- Selection helpers (docs/specs/076-team-selection.md) -----------------------------------------

function playerName(entry: SelectionPoolEntry | undefined): string {
  return entry
    ? squadDisplayName({ firstName: entry.firstName, lastName: entry.lastName, squadJerseyNumber: entry.jerseyNumber })
    : 'Unknown player'
}

// Positions are always contiguous: every cache edit that removes or gives a position renumbers the
// positioned players 1..k, as the server does.
function compactPositions(players: MatchSidePlayer[]): MatchSidePlayer[] {
  const ranked = players
    .filter((player) => player.battingOrder != null)
    .sort((a, b) => (a.battingOrder as number) - (b.battingOrder as number))
  const positions = new Map(ranked.map((player, index) => [player.playerProfileId, index + 1]))
  return players.map((player) => ({ ...player, battingOrder: positions.get(player.playerProfileId) ?? null }))
}

function withReorder(side: MatchSide, ids: string[]): MatchSide {
  return {
    ...side,
    twelfthManPlayerId: side.twelfthManPlayerId && ids.includes(side.twelfthManPlayerId) ? null : side.twelfthManPlayerId,
    players: side.players.map((player) => {
      const index = ids.indexOf(player.playerProfileId)
      return { ...player, battingOrder: index === -1 ? null : index + 1 }
    }),
  }
}

function withUpdate(side: MatchSide, payload: UpdateMatchSidePayload): MatchSide {
  const twelfth = payload.twelfthManPlayerId ?? null
  return {
    ...side,
    captainPlayerId: payload.captainPlayerId ?? null,
    wicketKeeperPlayerId: payload.wicketKeeperPlayerId ?? null,
    twelfthManPlayerId: twelfth,
    players: compactPositions(
      side.players.map((player) => (player.playerProfileId === twelfth ? { ...player, battingOrder: null } : player)),
    ),
  }
}

function withRemoval(side: MatchSide, playerId: string): MatchSide {
  return {
    ...side,
    captainPlayerId: side.captainPlayerId === playerId ? null : side.captainPlayerId,
    wicketKeeperPlayerId: side.wicketKeeperPlayerId === playerId ? null : side.wicketKeeperPlayerId,
    twelfthManPlayerId: side.twelfthManPlayerId === playerId ? null : side.twelfthManPlayerId,
    players: compactPositions(side.players.filter((player) => player.playerProfileId !== playerId)),
  }
}

function withRole(side: MatchSide, playerId: string, role: PlayingRole): MatchSide {
  return { ...side, players: side.players.map((player) => (player.playerProfileId === playerId ? { ...player, role } : player)) }
}

// A mutation on one side that updates the sides cache optimistically and rolls back on error, so a
// drop or a menu action never snaps back before the server answers (spec section 2, Sorting).
function useSideMutation<TVars>(
  clubId: string,
  matchId: string,
  teamId: string,
  sideId: string | undefined,
  mutationFn: (variables: TVars) => Promise<MatchSide>,
  optimistic: (side: MatchSide, variables: TVars) => MatchSide,
) {
  const queryClient = useQueryClient()
  const sidesKey = ['managed-club', clubId, 'matches', matchId, 'sides']
  return useMutation({
    mutationFn,
    onMutate: async (variables: TVars) => {
      await queryClient.cancelQueries({ queryKey: sidesKey })
      const previous = queryClient.getQueryData<MatchSide[]>(sidesKey)
      queryClient.setQueryData<MatchSide[]>(sidesKey, (current) =>
        current?.map((candidate) => (candidate.id === sideId ? optimistic(candidate, variables) : candidate)),
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(sidesKey, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sidesKey })
      queryClient.invalidateQueries({ queryKey: selectionPoolQueryKey(clubId, matchId, teamId) })
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
    },
  })
}

// "A, B, C and 4 more": the server's own shape for a long list of names.
function nameList(names: string[]): string {
  const sorted = [...names].sort()
  if (sorted.length <= 3) {
    return sorted.join(', ')
  }
  return `${sorted.slice(0, 3).join(', ')} and ${sorted.length - 3} more`
}

// The section 8 announce rule, with the server's own check order and wording
// (MatchSideServiceImpl.announce), so the disabled button's tooltip carries the text the server
// would return. Null when the rule is met.
function announceBlockedReason(
  side: MatchSide,
  teamName: string,
  nameOf: (playerId: string) => string,
): string | null {
  const total = side.players.length
  if (total === 0) {
    return `Side ${side.id} has no players to announce`
  }
  const prefix = `Cannot announce ${teamName}: `
  if (total > side.limits.maxSelected) {
    return `${prefix}${total} players are selected; the most allowed is ${side.limits.maxSelected}.`
  }
  const unpositioned = side.players.filter(
    (player) => player.battingOrder == null && player.playerProfileId !== side.twelfthManPlayerId,
  )
  if (unpositioned.length > 0) {
    const names = nameList(unpositioned.map((player) => nameOf(player.playerProfileId)))
    return `${prefix}${unpositioned.length} ${unpositioned.length === 1 ? 'player has' : 'players have'} no batting position (${names}).`
  }
  const positioned = side.players.filter((player) => player.battingOrder != null).length
  if (positioned > side.limits.battingPlaces) {
    return `${prefix}${positioned} players are selected but only ${side.limits.battingPlaces} places exist; choose the 12th man or remove one.`
  }
  return null
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

const VISUALLY_HIDDEN_SX = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const

interface ReselectSummary {
  copied: number
  total: number
  lines: string[]
  // Set when a step failed: the message to show (and, after a clear, the side is now empty).
  failure: string | null
}

// docs/specs/076-team-selection.md sections 2 to 6: one team's selection page (the content of its
// Home XI / Away XI tab). State and server calls live here (React Query, per docs/standards/
// frontend.md); TeamSelectionList and SelectPlayersDialog are presentational. Creates the MatchSide
// on first use, per docs/specs/029-league-management.md.
function MatchSideTab({
  clubId,
  match,
  teamId,
  sideLabel,
  teamName,
  opponentName,
  teamsById,
}: {
  clubId: string
  match: Match
  teamId: string
  sideLabel: 'Home' | 'Away'
  teamName: string
  opponentName: string
  teamsById: Map<string, Team>
}) {
  const matchId = match.id
  const seasonId = match.seasonId
  const queryClient = useQueryClient()
  const attemptedCreateRef = useRef(false)

  const [selectOpen, setSelectOpen] = useState(false)
  const [wholeSection, setWholeSection] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [addPlayerOpen, setAddPlayerOpen] = useState(false)
  // PlayerForm externalizes its Basic/Contact/Cricket Info tab bar to its caller (PlayerFormPage's
  // pattern): the Add new player dialog owns its small 3-tab bar state.
  const [addPlayerTab, setAddPlayerTab] = useState<0 | 1 | 2>(0)
  const [previousMatchDialogOpen, setPreviousMatchDialogOpen] = useState(false)
  const [pendingSourceMatch, setPendingSourceMatch] = useState<Match | null>(null)
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false)
  const [reselectSummary, setReselectSummary] = useState<ReselectSummary | null>(null)

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(search.trim()), 300)
    return () => clearTimeout(handle)
  }, [search])

  const sidesKey = ['managed-club', clubId, 'matches', matchId, 'sides']
  const sidesQuery = useQuery({
    queryKey: sidesKey,
    queryFn: () => listMatchSides(clubId, matchId),
  })
  const side = (sidesQuery.data ?? []).find((candidate) => candidate.teamId === teamId)
  const sideId = side?.id

  const createSideMutation = useMutation({
    mutationFn: () => createMatchSide(clubId, matchId, teamId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sidesKey }),
  })

  useEffect(() => {
    if (!sidesQuery.isLoading && !side && !attemptedCreateRef.current && !createSideMutation.isPending) {
      attemptedCreateRef.current = true
      createSideMutation.mutate()
    }
    // createSideMutation is intentionally omitted — it's a new object every render, and including
    // it would re-run this effect on every render rather than just when the side's existence
    // actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidesQuery.isLoading, side])

  // The pool read: names and availability for the selected players on the page (the pool always
  // includes them), and the dialog's candidates while it is open. The page's own read is the
  // default pool; the dialog's key differs only once its switch or search changes.
  const pageLimits = { wholeSection: false, q: '' }
  const pageKey = [...selectionPoolQueryKey(clubId, matchId, teamId), pageLimits]
  const pageQuery = useQuery({
    queryKey: pageKey,
    queryFn: () => getSelectionPool(clubId, matchId, teamId, pageLimits),
  })
  const dialogParams = { wholeSection, q: debouncedQ }
  const dialogQuery = useQuery({
    queryKey: [...selectionPoolQueryKey(clubId, matchId, teamId), dialogParams],
    queryFn: () => getSelectionPool(clubId, matchId, teamId, dialogParams),
    enabled: selectOpen,
    refetchOnWindowFocus: true,
  })

  const invalidateSelection = () => {
    queryClient.invalidateQueries({ queryKey: sidesKey })
    queryClient.invalidateQueries({ queryKey: selectionPoolQueryKey(clubId, matchId, teamId) })
    // The match card's picked counts live in the matches list queries.
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
  }

  const reorderMutation = useSideMutation<string[]>(
    clubId,
    matchId,
    teamId,
    sideId,
    (ids) => reorderMatchSidePlayers(clubId, matchId, sideId as string, ids),
    withReorder,
  )
  // PUT .../sides/{sideId} is a full 3-field replace (docs/specs/037 item 5): every handler sends
  // the side's own current values for the fields NOT being changed.
  const updateSideMutation = useSideMutation<UpdateMatchSidePayload>(
    clubId,
    matchId,
    teamId,
    sideId,
    (payload) => updateMatchSide(clubId, matchId, sideId as string, payload),
    withUpdate,
  )
  const removeMutation = useSideMutation<string>(
    clubId,
    matchId,
    teamId,
    sideId,
    (playerId) => removeMatchSidePlayer(clubId, matchId, sideId as string, playerId),
    withRemoval,
  )
  const roleMutation = useSideMutation<{ playerId: string; role: PlayingRole }>(
    clubId,
    matchId,
    teamId,
    sideId,
    ({ playerId, role }) => updateMatchSidePlayerRole(clubId, matchId, sideId as string, playerId, role),
    (current, { playerId, role }) => withRole(current, playerId, role),
  )

  // docs/specs/040-announce-team.md
  const announceMutation = useMutation({
    mutationFn: () => announceMatchSide(clubId, matchId, sideId as string),
    onSuccess: invalidateSelection,
  })
  const unannounceMutation = useMutation({
    mutationFn: () => unannounceMatchSide(clubId, matchId, sideId as string),
    onSuccess: invalidateSelection,
  })

  const applyMutation = useMutation({
    mutationFn: (ids: string[]) =>
      applySelection(clubId, matchId, sideId as string, { players: ids.map((playerProfileId) => ({ playerProfileId })) }),
  })

  const closeSelectDialog = () => {
    setSelectOpen(false)
    setWholeSection(false)
    setSearch('')
    setDebouncedQ('')
  }

  // Done: one atomic apply. A 409 with rejections keeps the dialog open with per-row messages.
  const handleApply = async (ids: string[]): Promise<SelectionApplyOutcome> => {
    try {
      await applyMutation.mutateAsync(ids)
      invalidateSelection()
      closeSelectDialog()
      return { ok: true }
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) {
        const body = (error.response.data ?? {}) as SelectionRejectedBody
        queryClient.invalidateQueries({ queryKey: selectionPoolQueryKey(clubId, matchId, teamId) })
        return {
          ok: false,
          message: body.detail ?? "Some players can't be selected.",
          rejections: body.rejections ?? [],
        }
      }
      return { ok: false, message: errorDetail(error, "Couldn't save the selection. Please try again."), rejections: [] }
    }
  }

  // Release: removes the player from the other team's selection without un-announcing that team
  // (keepAnnounced), then refetches; he becomes selectable and is not auto-ticked.
  const handleRelease = async (entry: SelectionPoolEntry) => {
    const taken = entry.taken
    if (!taken) {
      return
    }
    await removeMatchSidePlayer(clubId, taken.matchId, taken.sideId, entry.playerProfileId, true)
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
  }

  // Add new player: always adds the player to the team's season roster, then switches the dialog to
  // Whole section with his name in the search (a brand-new player has no poll answer).
  const createAndLinkPlayerMutation = useMutation({
    mutationFn: async (payload: PlayerPayload) => {
      const player = await createPlayer(clubId, payload)
      await addToSquad(clubId, teamId, seasonId, player.id)
      return player
    },
    onSuccess: (player) => {
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'teams', teamId, 'seasons', seasonId, 'squad'] })
      queryClient.invalidateQueries({ queryKey: selectionPoolQueryKey(clubId, matchId, teamId) })
      setAddPlayerOpen(false)
      setWholeSection(true)
      const fullName = `${player.firstName} ${player.lastName}`
      setSearch(fullName)
      setDebouncedQ(fullName)
    },
  })

  // The previous matches of this side, fetched only while the picker is open.
  const previousMatchesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', teamId, 'seasons', seasonId, 'matches', 'previous', match.leagueId, matchId],
    queryFn: () => listPreviousMatches(clubId, teamId, seasonId, { leagueId: match.leagueId, excludeMatchId: matchId }),
    enabled: previousMatchDialogOpen,
  })

  // Re-select from previous match (spec section 5): load the whole-section pool, skip source players
  // who are now blocked (with the reason), clear a non-empty side with one empty apply, apply the
  // rest once with positions renumbered 1..k and their roles, then restore captain, wicketkeeper and
  // 12th man with one update. The three calls are not one transaction.
  const reselectMutation = useMutation({
    mutationFn: async (sourceMatchId: string): Promise<ReselectSummary> => {
      const destination = side as MatchSide
      const [sourceSides, pool] = await Promise.all([
        listMatchSides(clubId, sourceMatchId),
        getSelectionPool(clubId, matchId, teamId, { wholeSection: true }),
      ])
      const source = sourceSides.find((candidate) => candidate.teamId === teamId)
      if (!source) {
        return { copied: 0, total: 0, lines: [], failure: null }
      }

      const entries = new Map(pool.entries.map((entry) => [entry.playerProfileId, entry]))
      const lines: string[] = []
      // Why a source player cannot be copied, or null. A player currently on this side is
      // selectable now but would be blocked once the clear releases him, so those cases count too.
      const blockedLine = (playerId: string): string | null => {
        const entry = entries.get(playerId)
        if (!entry) {
          const own = source.players.find((player) => player.playerProfileId === playerId)
          const ownName = [own?.firstName, own?.lastName].filter(Boolean).join(' ') || 'A player'
          return pool.truncated
            ? `${ownName} could not be checked: the player list was too long.`
            : `${ownName} is not on this team's roster or in its section.`
        }
        const name = `${entry.firstName} ${entry.lastName}`
        const reason = entry.reason ?? (entry.selected && entry.taken ? 'TAKEN_FOR_SLOT' : null) ??
          (entry.selected && entry.availability === 'UNAVAILABLE' ? 'SAID_UNAVAILABLE' : null)
        if (reason === 'TAKEN_FOR_SLOT') {
          return entry.taken ? `${name} is in ${entry.taken.teamName}'s selection for that slot.` : `${name} is already selected elsewhere.`
        }
        if (reason === 'SAID_UNAVAILABLE') {
          return `${name} said he is unavailable.`
        }
        if (reason === 'AGE_INELIGIBLE') {
          return entry.reasonText ?? `${name} is not eligible for this match.`
        }
        return null
      }

      const sourceRest = source.players.filter((player) => player.playerProfileId !== source.twelfthManPlayerId)
      const ordered = [
        ...sourceRest
          .filter((player) => player.battingOrder != null)
          .sort((a, b) => (a.battingOrder as number) - (b.battingOrder as number)),
        ...sourceRest.filter((player) => player.battingOrder == null),
      ]
      let carried: MatchSidePlayer[] = []
      ordered.forEach((player) => {
        const line = blockedLine(player.playerProfileId)
        if (line) {
          lines.push(line)
        } else {
          carried.push(player)
        }
      })

      let carriedTwelfth: MatchSidePlayer | null = null
      if (source.twelfthManPlayerId) {
        const twelfthPlayer = source.players.find((player) => player.playerProfileId === source.twelfthManPlayerId)
        const twelfthName = playerName(entries.get(source.twelfthManPlayerId))
        const line = blockedLine(source.twelfthManPlayerId)
        if (line) {
          lines.push(line)
        } else if (!destination.limits.twelfthManAllowed) {
          lines.push(`${twelfthName} was the 12th man, but this match has no 12th man place.`)
        } else if (carried.length + 1 > destination.limits.maxSelected) {
          lines.push(`${twelfthName} was the 12th man, but the team is full.`)
        } else if (twelfthPlayer) {
          carriedTwelfth = twelfthPlayer
        }
      }

      const room = destination.limits.maxSelected - (carriedTwelfth ? 1 : 0)
      if (carried.length > room) {
        carried.slice(room).forEach((player) => {
          lines.push(`${playerName(entries.get(player.playerProfileId))} doesn't fit: the team is full.`)
        })
        carried = carried.slice(0, room)
      }

      let position = 0
      const players = [
        ...carried.map((player) => ({
          playerProfileId: player.playerProfileId,
          role: player.role,
          battingOrder:
            player.battingOrder != null && position < destination.limits.battingPlaces ? ++position : null,
        })),
        ...(carriedTwelfth
          ? [{ playerProfileId: carriedTwelfth.playerProfileId, role: carriedTwelfth.role, battingOrder: null }]
          : []),
      ]
      const total = source.players.length

      let cleared = false
      try {
        if (isSideNonEmpty(destination)) {
          await applySelection(clubId, matchId, destination.id, { players: [] })
          cleared = true
        }
        if (players.length > 0) {
          await applySelection(clubId, matchId, destination.id, { players })
        }
      } catch (error) {
        const reason = errorDetail(error, 'Something went wrong re-selecting the team.')
        return {
          copied: 0,
          total,
          lines,
          failure: cleared ? `${reason} The team is now empty.` : reason,
        }
      }

      const carriedIds = new Set(players.map((player) => player.playerProfileId))
      const captainPlayerId =
        source.captainPlayerId && carriedIds.has(source.captainPlayerId) ? source.captainPlayerId : null
      const wicketKeeperPlayerId =
        source.wicketKeeperPlayerId && carriedIds.has(source.wicketKeeperPlayerId) ? source.wicketKeeperPlayerId : null
      const twelfthManPlayerId = carriedTwelfth?.playerProfileId ?? null
      if (captainPlayerId || wicketKeeperPlayerId || twelfthManPlayerId) {
        try {
          await updateMatchSide(clubId, matchId, destination.id, {
            captainPlayerId,
            wicketKeeperPlayerId,
            twelfthManPlayerId,
          })
        } catch {
          lines.push("The captain, wicketkeeper and 12th man couldn't be restored.")
        }
      }

      return { copied: players.length, total, lines, failure: null }
    },
    onSuccess: (summary) => {
      invalidateSelection()
      setConfirmReplaceOpen(false)
      setPreviousMatchDialogOpen(false)
      setPendingSourceMatch(null)
      setReselectSummary(summary)
    },
    // A failure before anything was written (a network drop loading the pool) closes the dialogs so
    // the error Alert behind the backdrop becomes visible; the side is refetched in case a clear ran.
    onError: () => {
      invalidateSelection()
      setConfirmReplaceOpen(false)
      setPreviousMatchDialogOpen(false)
      setPendingSourceMatch(null)
    },
  })

  const handlePickPreviousMatch = (candidate: Match) => {
    if (side && isSideNonEmpty(side)) {
      setPendingSourceMatch(candidate)
      setConfirmReplaceOpen(true)
    } else {
      reselectMutation.mutate(candidate.id)
    }
  }

  const pool: SelectionPool | undefined = pageQuery.data
  const poolById = useMemo(
    () => new Map((pool?.entries ?? []).map((entry) => [entry.playerProfileId, entry])),
    [pool],
  )

  if (sidesQuery.isLoading || createSideMutation.isPending || !side) {
    return (
      <Typography variant="body2" color="text.secondary">
        Setting up {teamName}…
      </Typography>
    )
  }

  const nameOf = (playerId: string) => {
    const entry = poolById.get(playerId)
    if (entry) {
      return playerName(entry)
    }
    const own = side.players.find((player) => player.playerProfileId === playerId)
    return [own?.firstName, own?.lastName].filter(Boolean).join(' ') || 'Unknown player'
  }
  const limits = side.limits
  const selectedCount = side.players.length
  const covered = pool ? pool.coveringPoll.kind !== 'NONE' : false

  const listPlayers: TeamSelectionPlayer[] = side.players.map((player) => {
    const entry = poolById.get(player.playerProfileId)
    return {
      playerProfileId: player.playerProfileId,
      name: nameOf(player.playerProfileId),
      battingOrder: player.battingOrder,
      role: player.role,
      availability: covered && entry ? entry.availability : null,
      alsoIn: entry?.selected && entry.taken ? entry.taken.teamName : null,
    }
  })

  const countOf = (availability: string) =>
    listPlayers.filter((player) => player.availability === availability).length
  const unsure = countOf('UNSURE')
  const noResponse = countOf('NO_RESPONSE')
  const notPolled = countOf('NOT_POLLED')
  const unconfirmed = unsure + noResponse + notPolled
  const lateUnavailable = countOf('UNAVAILABLE')
  const breakdown = [
    unsure > 0 ? `${unsure} unsure` : null,
    noResponse > 0 ? `${noResponse} no response` : null,
    notPolled > 0 ? `${notPolled} not polled` : null,
  ]
    .filter(Boolean)
    .join(', ')

  const restPlayers = side.players.filter((player) => player.playerProfileId !== side.twelfthManPlayerId)
  const waitingCount = restPlayers.filter((player) => player.battingOrder == null).length

  const blockedReason = announceBlockedReason(side, teamName, nameOf)
  const announcing = announceMutation.isPending || unannounceMutation.isPending
  const announceError = announceMutation.isError
    ? errorDetail(announceMutation.error, "Couldn't announce this team. Please try again.")
    : null

  const listError =
    [reorderMutation, updateSideMutation, removeMutation, roleMutation, unannounceMutation]
      .map((mutation) =>
        mutation.isError
          ? errorDetail(mutation.error, 'Something went wrong updating the team. Please try again.')
          : null,
      )
      .find((message): message is string => Boolean(message)) ??
    (reselectMutation.isError
      ? errorDetail(reselectMutation.error, 'Something went wrong re-selecting the team from a previous match. Please try again.')
      : null)

  const announcedChip = announcedBadge(side.announced, '')
  const blockedReasonId = `announce-blocked-${side.id}`

  return (
    <Stack spacing={2}>
      <Box
        data-testid="selection-header"
        sx={{
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          px: 2,
          py: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="subtitle1" component="h2" fontWeight={700} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            {`${teamName} · ${sideLabel} · vs ${opponentName}`}
          </Typography>
          <Chip
            size="small"
            label={announcedChip.label}
            variant={announcedChip.tone === 'neutral' ? 'outlined' : 'filled'}
            sx={badgeSx(announcedChip.tone)}
          />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="body2" fontWeight={700}>
            Selected
          </Typography>
          <Typography variant="body2" color="text.secondary">{`${selectedCount} of ${limits.maxSelected}`}</Typography>
        </Box>
        <CardProgressBar
          value={selectedCount}
          max={limits.maxSelected}
          ariaLabel={`${teamName} selection`}
          valueText={`${selectedCount} of ${limits.maxSelected} selected`}
        />

        {pool && !covered && selectedCount > 0 && (
          <NoticeLine tone="warning">
            No availability poll covers this match, so nobody's availability is confirmed.
          </NoticeLine>
        )}
        {unconfirmed > 0 && (
          <NoticeLine tone="warning">
            <b>
              {unconfirmed === 1
                ? "1 selected player hasn't confirmed"
                : `${unconfirmed} selected players haven't confirmed`}
            </b>
            {` (${breakdown}).`}
          </NoticeLine>
        )}
        {lateUnavailable > 0 && (
          <NoticeLine tone="error">
            {lateUnavailable === 1
              ? '1 selected player has since said they are unavailable'
              : `${lateUnavailable} selected players have since said they are unavailable`}
          </NoticeLine>
        )}

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', gap: 1, position: 'relative' }}>
          <Button
            startIcon={<GroupsOutlinedIcon fontSize="small" />}
            onClick={() => setSelectOpen(true)}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Select players
          </Button>
          <Button
            variant="secondary"
            onClick={() => setPreviousMatchDialogOpen(true)}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Re-select from previous match
          </Button>
          {side.announced ? (
            <Button
              variant="secondary"
              onClick={() => unannounceMutation.mutate()}
              disabled={announcing}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              {unannounceMutation.isPending ? 'Un-announcing…' : 'Un-announce'}
            </Button>
          ) : (
            <Tooltip title={blockedReason ?? ''} disableHoverListener={!blockedReason} disableFocusListener={!blockedReason}>
              <Box component="span" sx={{ display: 'flex', width: { xs: '100%', sm: 'auto' } }}>
                <Button
                  variant="secondary"
                  onClick={() => announceMutation.mutate()}
                  disabled={Boolean(blockedReason) || announcing}
                  aria-describedby={blockedReason ? blockedReasonId : undefined}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  {announceMutation.isPending ? 'Announcing…' : 'Announce team'}
                </Button>
              </Box>
            </Tooltip>
          )}
          {blockedReason && !side.announced && (
            <Box id={blockedReasonId} sx={VISUALLY_HIDDEN_SX}>
              {blockedReason}
            </Box>
          )}
        </Box>
        {announceError && <Alert severity="error">{announceError}</Alert>}
      </Box>

      {listError && <Alert severity="error">{listError}</Alert>}

      {reselectSummary && (
        <Alert severity={reselectSummary.failure ? 'error' : 'info'} onClose={() => setReselectSummary(null)}>
          {reselectSummary.failure ? (
            <Typography variant="body2">{reselectSummary.failure}</Typography>
          ) : (
            <Typography variant="body2">
              {`Copied ${reselectSummary.copied} of ${reselectSummary.total} players from the previous team.`}
            </Typography>
          )}
          {reselectSummary.lines.map((line) => (
            <Typography key={line} variant="body2">
              {line}
            </Typography>
          ))}
        </Alert>
      )}

      {waitingCount > 0 && (
        <NoticeLine tone="warning">
          <b>
            {waitingCount === restPlayers.length
              ? `${waitingCount} ${waitingCount === 1 ? 'player is' : 'players are'} selected but the batting order is not set.`
              : `${waitingCount} ${waitingCount === 1 ? 'player is' : 'players are'} not in the batting order yet.`}
          </b>
          {' Drag them into order or open a player and type a position.'}
        </NoticeLine>
      )}

      {pageQuery.isLoading && selectedCount > 0 ? (
        <Typography variant="body2" color="text.secondary">
          Loading players…
        </Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary">
            Tap a player's name for captain, wicketkeeper, batting position and more. Drag the handle to reorder.
          </Typography>
        <TeamSelectionList
          players={listPlayers}
          captainPlayerId={side.captainPlayerId}
          wicketKeeperPlayerId={side.wicketKeeperPlayerId}
          twelfthManPlayerId={side.twelfthManPlayerId}
          limits={limits}
          dragDisabled={side.announced}
          onReorder={(ids) => reorderMutation.mutate(ids)}
          onSetCaptain={(id) =>
            updateSideMutation.mutate({
              captainPlayerId: id,
              wicketKeeperPlayerId: side.wicketKeeperPlayerId,
              twelfthManPlayerId: side.twelfthManPlayerId,
            })
          }
          onSetWicketKeeper={(id) =>
            updateSideMutation.mutate({
              captainPlayerId: side.captainPlayerId,
              wicketKeeperPlayerId: id,
              twelfthManPlayerId: side.twelfthManPlayerId,
            })
          }
          onMakeTwelfthMan={(id) =>
            updateSideMutation.mutate({
              captainPlayerId: side.captainPlayerId === id ? null : side.captainPlayerId,
              wicketKeeperPlayerId: side.wicketKeeperPlayerId === id ? null : side.wicketKeeperPlayerId,
              twelfthManPlayerId: id,
            })
          }
          onChangeRole={(playerId, role) => roleMutation.mutate({ playerId, role })}
          onRemove={(playerId) => removeMutation.mutate(playerId)}
        />
        </>
      )}

      {selectOpen && (
        <SelectPlayersDialog
          teamName={teamName}
          kickoffLabel={formatMatchDateTime(match.matchDate)}
          maxSelected={limits.maxSelected}
          initialSelectedIds={side.players.map((player) => player.playerProfileId)}
          pool={dialogQuery.data}
          poolLoading={dialogQuery.isLoading}
          poolError={dialogQuery.isError}
          wholeSection={wholeSection}
          onWholeSectionChange={setWholeSection}
          search={search}
          onSearchChange={setSearch}
          onApply={handleApply}
          onRelease={handleRelease}
          onAddNewPlayer={() => {
            setAddPlayerTab(0)
            setAddPlayerOpen(true)
          }}
          onClose={closeSelectDialog}
        />
      )}

      {/* The picker: LinkExistingRecordDialog's no-extraField mode, so picking fires onLink at once. */}
      <LinkExistingRecordDialog<Match>
        open={previousMatchDialogOpen}
        onClose={() => setPreviousMatchDialogOpen(false)}
        title="Re-select from previous match"
        candidates={previousMatchesQuery.data ?? []}
        loading={previousMatchesQuery.isLoading}
        getOptionLabel={(candidate) => `${new Date(candidate.matchDate).toLocaleDateString()} — vs ${opponentLabel(candidate, teamId, teamsById)}`}
        onLink={(candidate) => handlePickPreviousMatch(candidate)}
      />

      <ConfirmDialog
        open={confirmReplaceOpen}
        title="Replace the current Playing XI?"
        description={`This replaces every player, role, and batting-order position currently set for ${teamName}.`}
        confirmLabel="Replace"
        pendingLabel="Replacing…"
        pending={reselectMutation.isPending}
        onConfirm={() => pendingSourceMatch && reselectMutation.mutate(pendingSourceMatch.id)}
        onClose={() => {
          setConfirmReplaceOpen(false)
          setPendingSourceMatch(null)
        }}
      />

      {/* CreateAndLinkRecordDialog/PlayerForm unmodified: PlayerForm externalizes its tab bar, so
          this wrapper renders the same small local 3-tab bar PlayerFormPage does. Nested over the
          Select players dialog. */}
      <CreateAndLinkRecordDialog<PlayerPayload>
        open={addPlayerOpen}
        onClose={() => setAddPlayerOpen(false)}
        title="New player"
        formId={PLAYER_FORM_ID}
        renderForm={(onSubmit) => (
          <>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Tabs
                value={addPlayerTab}
                onChange={(_event, next: number) => setAddPlayerTab(next as 0 | 1 | 2)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
              >
                <Tab label="Basic Info" />
                <Tab label="Contact Info" />
                <Tab label="Cricket Info" />
              </Tabs>
            </Box>
            <PlayerForm activeTab={addPlayerTab} onSubmit={onSubmit} />
          </>
        )}
        onCreateAndLink={(payload) => createAndLinkPlayerMutation.mutate(payload)}
        isPending={createAndLinkPlayerMutation.isPending}
        isError={createAndLinkPlayerMutation.isError}
        errorMessage={errorDetail(
          createAndLinkPlayerMutation.error,
          "Couldn't create and add this player to the squad. Please try again.",
        )}
      />
    </Stack>
  )
}

// docs/specs/029-league-management.md: RecordFormScreen wrapping MatchForm for create; in edit
// mode, a tabbed layout (027's Details/Contacts/Sponsors precedent) gains one Playing XI tab per
// side that's currently a real Team reference.
export default function MatchFormPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { matchId } = useParams<{ matchId?: string }>()
  const isEdit = Boolean(matchId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  // docs/specs/075-match-view-and-edit.md: tabs are keyed by string, not computed index.
  const [activeTab, setActiveTab] = useState<MatchTabKey>('details')

  const matchQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId],
    queryFn: () => getMatch(clubId as string, matchId as string),
    enabled: Boolean(clubId) && Boolean(matchId) && isEdit,
  })

  const teamsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId as string),
    enabled: Boolean(clubId),
  })

  const seasonsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId),
  })

  const leaguesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues'],
    queryFn: () => listLeagues(clubId as string),
    enabled: Boolean(clubId),
  })

  // docs/specs/029-league-management.md left "season options/filtering exact behaviour" for
  // MatchForm's Home/Away team pickers unresolved at build time — they've always listed every one
  // of the club's teams regardless of the selected League/Season, even though LeagueAffiliation
  // (which teams are actually entered into which League for which Season) already exists and is
  // already exposed per-league. Fetched club-wide here (one call per already-loaded League,
  // affiliations endpoints are nested under their own League per 029's own design) rather than via
  // a new endpoint — the club's League count is small, and this matches the existing
  // eagerly-load-everything-then-narrow-client-side pattern teams/seasons/leagues above already use.
  const affiliationsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', 'affiliations', (leaguesQuery.data ?? []).map((l) => l.id)],
    queryFn: () =>
      Promise.all((leaguesQuery.data ?? []).map((l) => listLeagueAffiliations(clubId as string, l.id))).then(
        (results) => results.flat(),
      ),
    enabled: Boolean(clubId) && Boolean(leaguesQuery.data),
  })

  // docs/specs/070-league-teams.md: the League team option (and its list endpoint) is club-admin
  // only. MeAccess.clubAdminClubIds holds only CLUB-scope CLUB_ADMIN assignments (MeServiceImpl), so
  // a section manager never matches. Same query key ManagerHome/PostLoginRedirect use.
  const meQuery = useQuery({ queryKey: ['me', 'activate'], queryFn: activateSession })
  const canUseLeagueTeams = Boolean(
    clubId && meQuery.data && (meQuery.data.platformAdmin || meQuery.data.clubAdminClubIds.includes(clubId)),
  )

  // MatchForm owns the chosen League/Season; it reports them so the matching league teams (all,
  // including inactive, so an already-held inactive pick still shows) can be fetched here.
  const [formScope, setFormScope] = useState({ leagueId: '', seasonId: '' })
  const handleScopeChange = useCallback(
    (leagueId: string, seasonId: string) =>
      setFormScope((prev) => (prev.leagueId === leagueId && prev.seasonId === seasonId ? prev : { leagueId, seasonId })),
    [],
  )
  const leagueTeamsQuery = useQuery({
    queryKey: leagueTeamsQueryKey(clubId as string, formScope.leagueId, formScope.seasonId),
    queryFn: () => listLeagueTeams(clubId as string, formScope.leagueId, formScope.seasonId),
    enabled: Boolean(clubId) && canUseLeagueTeams && Boolean(formScope.leagueId) && Boolean(formScope.seasonId),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: MatchPayload) => {
      if (isEdit && matchId) {
        return updateMatch(clubId as string, matchId, payload)
      }
      return createMatch(clubId as string, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
      navigate('/manage/fixtures/matches')
    },
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md: relocated verbatim from MatchList.tsx's own
  // MatchCard — same mutation fn/onSuccess invalidation (prefix-matches both MatchList's paginated
  // query and this page's own single-record query), now rendered in this screen's actions bar
  // instead of the list card's footer.
  const invalidateMatches = () => queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })

  const deactivate = useMutation({
    mutationFn: () => deactivateMatch(clubId as string, matchId as string),
    onSuccess: invalidateMatches,
  })

  const reactivate = useMutation({
    mutationFn: () => reactivateMatch(clubId as string, matchId as string),
    onSuccess: invalidateMatches,
  })

  const match = matchQuery.data
  const toggle = match?.active ? deactivate : reactivate

  // docs/specs/050-league-schedule-and-fixtures.md: LeagueFormPage's Schedule tab's own "Add
  // Match" shortcut pre-fills League and Season via query params on this same create route
  // (/manage/fixtures/matches/new?leagueId=&seasonId=), read here rather than router `state` so
  // the prefill survives a refresh — matching this codebase's existing ?tab=playing-xi/
  // ?tab=match-squad query-param deep-linking convention above. Create mode only — an existing
  // edit's own values (from `match`) are never overridden by a stray query param.
  const prefillLeagueId = !isEdit ? searchParams.get('leagueId') : null
  const prefillSeasonId = !isEdit ? searchParams.get('seasonId') : null
  const teamsById = useMemo(() => {
    const map = new Map<string, Team>()
    ;(teamsQuery.data ?? []).forEach((team) => map.set(team.id, team))
    return map
  }, [teamsQuery.data])

  const showXiTabs = isEdit && Boolean(match)
  const hasHomeXiTab = showXiTabs && Boolean(match?.homeTeamId)
  const hasAwayXiTab = showXiTabs && Boolean(match?.awayTeamId)
  const hasXiTabs = hasHomeXiTab || hasAwayXiTab

  // The header Availability button reads the coverage of each side (docs/specs/064).
  const homeCoverage = useSideCoverage(clubId, matchId, match?.homeTeamId)
  const awayCoverage = useSideCoverage(clubId, matchId, match?.awayTeamId)

  // The tab bar's entries, in order: Details, Home XI, Away XI.
  const availableTabs: MatchTabKey[] = [
    'details',
    ...(hasHomeXiTab ? (['home-xi'] as const) : []),
    ...(hasAwayXiTab ? (['away-xi'] as const) : []),
  ]
  // A tab that stopped existing (e.g. coverage changed) falls back to Details.
  const currentTab: MatchTabKey = availableTabs.includes(activeTab) ? activeTab : 'details'

  // docs/specs/075 section 3: the header Availability button follows the card's destination rule.
  // getMatch returns no polls, so they are rebuilt from the coverage and polls queries this page
  // already runs (no new request).
  const ownTeamIds = [match?.homeTeamId, match?.awayTeamId].filter((id): id is string => Boolean(id))
  const coverageByTeamId = new Map<string, MatchSquadCoverage | undefined>()
  if (match?.homeTeamId) coverageByTeamId.set(match.homeTeamId, homeCoverage.matchSquadQuery.data)
  if (match?.awayTeamId) coverageByTeamId.set(match.awayTeamId, awayCoverage.matchSquadQuery.data)
  const squadPolls = homeCoverage.pollsQuery.data ?? awayCoverage.pollsQuery.data ?? []
  // A failed query is NOT ready: the poll state is unknown, so Availability stays disabled rather
  // than offering the New poll flow for a match that may have a poll.
  const pollsReady = [
    homeCoverage.matchSquadQuery,
    awayCoverage.matchSquadQuery,
    homeCoverage.pollsQuery,
    awayCoverage.pollsQuery,
  ].every((query) => !query.isLoading && !query.isError)
  const availabilityDestination: PollDestination = match
    ? pollDestination({ ...match, polls: matchPollsFrom(ownTeamIds, squadPolls, coverageByTeamId) }, teamsById)
    : { kind: 'link', to: '' }
  const { openAvailability, menu: availabilityMenu } = useAvailabilityNavigation(availabilityDestination)
  const noOwnTeam = ownTeamIds.length === 0

  // SquadPicker's cards route straight into a match's Playing XI tab (?tab=playing-xi) rather
  // than Details — jumps to whichever XI tab exists first (home, else away) once the match has
  // loaded.
  useEffect(() => {
    if (searchParams.get('tab') === 'playing-xi' && hasXiTabs) {
      setActiveTab(hasHomeXiTab ? 'home-xi' : 'away-xi')
    }
    // Only re-evaluated when the deep-link target itself becomes available — not on every
    // activeTab change caused by the admin's own tab clicks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, hasXiTabs, hasHomeXiTab, hasAwayXiTab])

  // docs/specs/076-team-selection.md section 1: ?tab=match-squad&side=home|away (old bookmarks and
  // the removed Pick match squad button) now selects that side's XI tab, falling back to the other
  // XI tab when that side has no team id. (docs/specs/075: ?tab=availability is not a tab.)
  useEffect(() => {
    if (searchParams.get('tab') === 'match-squad' && hasXiTabs) {
      const side = searchParams.get('side')
      if (side === 'away' && hasAwayXiTab) {
        setActiveTab('away-xi')
      } else if (side === 'home' && hasHomeXiTab) {
        setActiveTab('home-xi')
      } else {
        setActiveTab(hasHomeXiTab ? 'home-xi' : 'away-xi')
      }
    }
    // Only re-evaluated when the deep-link target itself becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, hasXiTabs, hasHomeXiTab, hasAwayXiTab])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isEdit && matchQuery.isLoading) {
    return null
  }

  if (isEdit && (matchQuery.isError || !match)) {
    return (
      <EmptyState
        title="Couldn't load this match"
        description="Something went wrong loading this match. Please try again."
      />
    )
  }

  return (
    <RecordFormScreen
      title={isEdit ? 'Edit Match' : 'Add Match'}
      backTo="/manage/fixtures/matches"
      backLabel="Back to Matches"
      headerAction={
        isEdit && match ? (
          <>
            <Box component="span" title={noOwnTeam ? NO_CLUB_TEAM_REASON : undefined} sx={{ display: 'inline-flex' }}>
              <MuiButton
                variant="outlined"
                disabled={noOwnTeam || !pollsReady}
                onClick={openAvailability}
                startIcon={<EventAvailableOutlinedIcon fontSize="small" />}
              >
                Availability
              </MuiButton>
            </Box>
            {availabilityMenu}
          </>
        ) : undefined
      }
      actions={
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          {currentTab === 'details' && (
            <>
              {saveMutation.isError && (
                <Typography variant="body2" color="error.main">
                  {errorDetail(saveMutation.error, 'Something went wrong saving this match. Please try again.')}
                </Typography>
              )}

              <Button type="submit" form={MATCH_FORM_ID} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create match'}
              </Button>
            </>
          )}

          {isEdit && match && (
            <RecordStatusToggle active={match.active} pending={toggle.isPending} onClick={() => toggle.mutate()} />
          )}
        </Stack>
      }
    >
      {hasXiTabs && (
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Tabs
            value={currentTab}
            onChange={(_event, next: MatchTabKey) => setActiveTab(next)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
          >
            <Tab label="Details" value="details" />
            {hasHomeXiTab && <Tab label="Home XI" value="home-xi" />}
            {hasAwayXiTab && <Tab label="Away XI" value="away-xi" />}
          </Tabs>
        </Box>
      )}

      {currentTab === 'details' && (
        <MatchForm
          initialValues={
            match
              ? {
                  homeTeamId: match.homeTeamId,
                  homeTeamName: match.homeTeamName,
                  homeTeamLogoUrl: match.homeTeamLogoUrl,
                  awayTeamId: match.awayTeamId,
                  awayTeamName: match.awayTeamName,
                  awayTeamLogoUrl: match.awayTeamLogoUrl,
                  homeLeagueTeamId: match.homeLeagueTeamId,
                  awayLeagueTeamId: match.awayLeagueTeamId,
                  leagueId: match.leagueId,
                  seasonId: match.seasonId,
                  matchDate: match.matchDate,
                  venue: match.venue,
                  scoringUrl: match.scoringUrl,
                  streamingUrl: match.streamingUrl,
                }
              : prefillLeagueId || prefillSeasonId
                ? { leagueId: prefillLeagueId ?? undefined, seasonId: prefillSeasonId ?? undefined }
                : undefined
          }
          teams={teamsQuery.data ?? []}
          seasons={seasonsQuery.data ?? []}
          leagues={leaguesQuery.data ?? []}
          affiliations={affiliationsQuery.data ?? []}
          leagueTeams={leagueTeamsQuery.data ?? []}
          leagueTeamsLoading={leagueTeamsQuery.isFetching}
          canUseLeagueTeams={canUseLeagueTeams}
          onScopeChange={handleScopeChange}
          onSubmit={(payload) => saveMutation.mutate(payload)}
        />
      )}

      {hasHomeXiTab && currentTab === 'home-xi' && match && (
        <Box sx={{ gridColumn: '1 / -1' }}>
          <MatchSideTab
            clubId={clubId}
            match={match}
            teamId={match.homeTeamId as string}
            sideLabel="Home"
            teamName={sideDisplayName(match.homeTeamId, match.homeTeamName, teamsById)}
            opponentName={sideDisplayName(match.awayTeamId, match.awayTeamName, teamsById)}
            teamsById={teamsById}
          />
        </Box>
      )}

      {hasAwayXiTab && currentTab === 'away-xi' && match && (
        <Box sx={{ gridColumn: '1 / -1' }}>
          <MatchSideTab
            clubId={clubId}
            match={match}
            teamId={match.awayTeamId as string}
            sideLabel="Away"
            teamName={sideDisplayName(match.awayTeamId, match.awayTeamName, teamsById)}
            opponentName={sideDisplayName(match.homeTeamId, match.homeTeamName, teamsById)}
            teamsById={teamsById}
          />
        </Box>
      )}
    </RecordFormScreen>
  )
}
