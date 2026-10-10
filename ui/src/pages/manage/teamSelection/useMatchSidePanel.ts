import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import type { SelectionApplyOutcome } from '../../../components/SelectPlayersDialog'
import type { TeamSelectionPlayer } from '../../../components/TeamSelectionList'
import { listPreviousMatches } from '../../../api/matchApi'
import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'
import { addToSquad } from '../../../api/teamSquadApi'
import { createPlayer } from '../../../api/playerApi'
import type { PlayerPayload } from '../../../api/playerApi'
import {
  createMatchSide,
  listMatchSides,
  removeMatchSidePlayer,
  reorderMatchSidePlayers,
  unannounceMatchSide,
  updateMatchSide,
  updateMatchSidePlayerRole,
} from '../../../api/matchSideApi'
import type { MatchSide, PlayingRole, UpdateMatchSidePayload } from '../../../api/matchSideApi'
import { applySelection, getSelectionPool, selectionPoolQueryKey } from '../../../api/matchSelectionApi'
import type { SelectionEntryRequest, SelectionPool, SelectionPoolEntry, SelectionRejectedBody } from '../../../api/matchSelectionApi'
import { setPlayerStatus } from '../../../api/matchAvailabilityApi'
import type { AvailabilityStatus } from '../../../api/matchAvailabilityApi'
import { setRoundPlayerStatus } from '../../../api/sectionAvailabilityApi'
import { getMatchSquad } from '../../../api/matchSquadApi'
import { invalidateAvailabilityCounters } from '../../../api/availabilitySummaryApi'
import { invalidateTeamSelection } from '../../../api/teamSelectionApi'
import { announceWithRoles } from './announceWithRoles'
import type { AnnounceRoleChoices } from './announceWithRoles'
import { errorDetail } from '../../../utils/errorDetail'
import {
  announceBlockedReason,
  opponentLabel,
  playerName,
  withReorder,
  withRemoval,
  withRole,
  withUpdate,
} from './matchSideHelpers'

export type SelectionSource = 'squad' | 'section' | 'previous'

// A mutation on one side that updates the sides cache optimistically and rolls back on error, so a drop or a menu
// action never snaps back before the server answers (docs/specs/076 section 2, Sorting). Every success also refreshes
// the Team selection overview (docs/specs/093), which every view of the hub reads.
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
    onSuccess: () => {
      invalidateTeamSelection(queryClient, clubId)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sidesKey })
      queryClient.invalidateQueries({ queryKey: selectionPoolQueryKey(clubId, matchId, teamId) })
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
    },
  })
}

export interface UseMatchSidePanelOptions {
  clubId: string
  match: Match
  teamId: string
  teamName: string
  teamsById: Map<string, Team>
}

// docs/specs/076-team-selection.md sections 2 to 6, extracted from MatchFormPage's MatchSideTab (docs/specs/093): the
// state and server calls of one team's selection - the side (created on first use, per docs/specs/029), its names and
// availability from the selection pool, the Select players dialog, Announce / Un-announce and the list's mutations.
// Presentational pieces (TeamSelectionList, SelectPlayersDialog, ConfirmDialog) take what this returns.
export function useMatchSidePanel({ clubId, match, teamId, teamName, teamsById }: UseMatchSidePanelOptions) {
  const matchId = match.id
  const seasonId = match.seasonId
  const queryClient = useQueryClient()
  const attemptedCreateRef = useRef(false)

  const [selectOpen, setSelectOpen] = useState(false)
  const [confirmAnnounce, setConfirmAnnounce] = useState(false)
  // The dialog's source switch: the team's squad (or the people who said available), the whole section, or the players
  // of a previous match (chosen in the dialog).
  const [source, setSource] = useState<SelectionSource>('squad')
  const [previousMatchId, setPreviousMatchId] = useState<string | null>(null)
  const wholeSection = source !== 'squad'
  const [search, setSearch] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [addPlayerOpen, setAddPlayerOpen] = useState(false)
  // PlayerForm externalises its Basic/Contact/Cricket Info tab bar to its caller: the Add new player dialog owns its
  // small 3-tab bar state.
  const [addPlayerTab, setAddPlayerTab] = useState<0 | 1 | 2>(0)

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sidesKey })
      invalidateTeamSelection(queryClient, clubId)
    },
  })

  useEffect(() => {
    if (!sidesQuery.isLoading && !side && !attemptedCreateRef.current && !createSideMutation.isPending) {
      attemptedCreateRef.current = true
      createSideMutation.mutate()
    }
    // createSideMutation is intentionally omitted: it is a new object every render, and including it would re-run this
    // effect on every render rather than just when the side's existence actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidesQuery.isLoading, side])

  // The pool read: names and availability for the selected players on the page (the pool always includes them), and
  // the dialog's candidates while it is open. The page's own read is the default pool; the dialog's key differs only
  // once its switch or search changes.
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
    invalidateTeamSelection(queryClient, clubId)
  }

  const reorderMutation = useSideMutation<string[]>(
    clubId,
    matchId,
    teamId,
    sideId,
    (ids) => reorderMatchSidePlayers(clubId, matchId, sideId as string, ids),
    withReorder,
  )
  // PUT .../sides/{sideId} is a full 3-field replace (docs/specs/037 item 5): every handler sends the side's own current
  // values for the fields NOT being changed.
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
    mutationFn: (choices?: AnnounceRoleChoices) =>
      announceWithRoles(
        clubId,
        matchId,
        sideId as string,
        {
          captainPlayerId: side?.captainPlayerId ?? null,
          wicketKeeperPlayerId: side?.wicketKeeperPlayerId ?? null,
          twelfthManPlayerId: side?.twelfthManPlayerId ?? null,
        },
        choices,
      ),
    onSuccess: () => {
      invalidateSelection()
      setConfirmAnnounce(false)
    },
  })
  const unannounceMutation = useMutation({
    mutationFn: () => unannounceMatchSide(clubId, matchId, sideId as string),
    onSuccess: invalidateSelection,
  })

  const applyMutation = useMutation({
    mutationFn: (entries: SelectionEntryRequest[]) => applySelection(clubId, matchId, sideId as string, { players: entries }),
  })

  const closeSelectDialog = () => {
    setSelectOpen(false)
    setSource('squad')
    setPreviousMatchId(null)
    setSearch('')
    setDebouncedQ('')
  }

  // Done: one atomic apply. A 409 with rejections keeps the dialog open with per-row messages.
  const handleApply = async (ids: string[]): Promise<SelectionApplyOutcome> => {
    try {
      // Existing players carry no role or position (the server keeps theirs). Each NEW player (ticked ids not already
      // selected, in tick order) goes to the end of the batting order: the next position after the highest one kept,
      // while it fits in battingPlaces; the rest wait unordered.
      const current = side?.players ?? []
      const currentIds = new Set(current.map((player) => player.playerProfileId))
      const wanted = new Set(ids)
      const keptPositions = current
        .filter((player) => wanted.has(player.playerProfileId) && player.battingOrder != null)
        .map((player) => player.battingOrder as number)
      let nextPosition = keptPositions.length > 0 ? Math.max(...keptPositions) + 1 : 1
      const battingPlaces = side?.limits.battingPlaces ?? 0
      const entries: SelectionEntryRequest[] = ids.map((playerProfileId) => {
        if (currentIds.has(playerProfileId)) {
          return { playerProfileId }
        }
        return nextPosition <= battingPlaces ? { playerProfileId, battingOrder: nextPosition++ } : { playerProfileId }
      })
      await applyMutation.mutateAsync(entries)
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

  // The group poll's override needs the match's own window id; the squad endpoint (the same key the Availability
  // button's coverage read uses) carries it.
  const coverageQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId, 'teams', teamId, 'squad'],
    queryFn: () => getMatchSquad(clubId, matchId, teamId),
  })

  // Set answer (dialog): a manager correction through the same override endpoints the Responses pages use - PUT
  // matches/{matchId}/polls/{pollId}/players/{playerId} {status} for a squad poll, PUT
  // section-availability-rounds/{roundId}/players/{playerId} {windowId, status} for a group poll (the answer is per
  // window, so it covers every match of that slot). Works on a closed poll.
  const handleSetAnswer = async (entry: SelectionPoolEntry, status: AvailabilityStatus) => {
    const poll = dialogQuery.data?.coveringPoll
    if (!poll) {
      return
    }
    if (poll.kind === 'SQUAD' && poll.pollId && poll.matchId) {
      await setPlayerStatus(clubId, poll.matchId, poll.pollId, entry.playerProfileId, status)
    } else if (poll.kind === 'GROUP' && poll.roundId && coverageQuery.data?.windowId) {
      await setRoundPlayerStatus(clubId, poll.roundId, entry.playerProfileId, coverageQuery.data.windowId, status)
    } else {
      throw new Error('No poll window to answer on')
    }
    queryClient.invalidateQueries({ queryKey: selectionPoolQueryKey(clubId, matchId, teamId) })
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'section-availability-rounds'] })
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'availability-polls'] })
    invalidateAvailabilityCounters(queryClient, clubId)
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'player-availability'] })
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
    invalidateTeamSelection(queryClient, clubId)
  }

  // Release: removes the player from the other team's selection without un-announcing that team (keepAnnounced), then
  // refetches; he becomes selectable and is not auto-ticked.
  const handleRelease = async (entry: SelectionPoolEntry) => {
    const taken = entry.taken
    if (!taken) {
      return
    }
    await removeMatchSidePlayer(clubId, taken.matchId, taken.sideId, entry.playerProfileId, true)
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
    invalidateTeamSelection(queryClient, clubId)
  }

  // Add new player: always adds the player to the team's season roster, then switches the dialog to Whole section with
  // his name in the search (a brand-new player has no poll answer).
  const createAndLinkPlayerMutation = useMutation({
    mutationFn: async (payload: PlayerPayload) => {
      const player = await createPlayer(clubId, payload)
      await addToSquad(clubId, teamId, seasonId, player.id)
      return player
    },
    onSuccess: (player) => {
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'teams', teamId, 'seasons', seasonId, 'squad'] })
      queryClient.invalidateQueries({ queryKey: selectionPoolQueryKey(clubId, matchId, teamId) })
      invalidateTeamSelection(queryClient, clubId)
      setAddPlayerOpen(false)
      setSource('section')
      const fullName = `${player.firstName} ${player.lastName}`
      setSearch(fullName)
      setDebouncedQ(fullName)
    },
  })

  // The previous matches of this side, fetched only while the dialog's 'From previous match' chip is chosen.
  const previousMatchesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', teamId, 'seasons', seasonId, 'matches', 'previous', match.leagueId, matchId],
    queryFn: () => listPreviousMatches(clubId, teamId, seasonId, { leagueId: match.leagueId, excludeMatchId: matchId }),
    enabled: selectOpen && source === 'previous',
  })
  // The chosen match's own side gives the players to show and their order (batting order first, then the rest, the 12th
  // man last). Nothing else is carried over.
  const previousSidesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', previousMatchId, 'sides'],
    queryFn: () => listMatchSides(clubId, previousMatchId as string),
    enabled: selectOpen && source === 'previous' && Boolean(previousMatchId),
  })
  const previousOrder = useMemo(() => {
    const previousSide = (previousSidesQuery.data ?? []).find((candidate) => candidate.teamId === teamId)
    if (!previousSide) {
      return null
    }
    const rest = previousSide.players.filter((player) => player.playerProfileId !== previousSide.twelfthManPlayerId)
    const positioned = rest
      .filter((player) => player.battingOrder != null)
      .sort((a, b) => (a.battingOrder as number) - (b.battingOrder as number))
    const waiting = rest.filter((player) => player.battingOrder == null)
    const twelfth = previousSide.players.filter((player) => player.playerProfileId === previousSide.twelfthManPlayerId)
    return [...positioned, ...waiting, ...twelfth].map((player) => player.playerProfileId)
  }, [previousSidesQuery.data, teamId])

  const pool: SelectionPool | undefined = pageQuery.data
  const poolById = useMemo(
    () => new Map((pool?.entries ?? []).map((entry) => [entry.playerProfileId, entry])),
    [pool],
  )

  const settingUp = sidesQuery.isLoading || createSideMutation.isPending || !side

  const nameOf = (playerId: string) => {
    const entry = poolById.get(playerId)
    if (entry) {
      return playerName(entry)
    }
    const own = side?.players.find((player) => player.playerProfileId === playerId)
    return [own?.firstName, own?.lastName].filter(Boolean).join(' ') || 'Unknown player'
  }

  const covered = pool ? pool.coveringPoll.kind !== 'NONE' : false

  const listPlayers: TeamSelectionPlayer[] = (side?.players ?? []).map((player) => {
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

  const countOf = (availability: string) => listPlayers.filter((player) => player.availability === availability).length
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

  const restPlayers = (side?.players ?? []).filter((player) => player.playerProfileId !== side?.twelfthManPlayerId)
  const waitingCount = restPlayers.filter((player) => player.battingOrder == null).length

  const blockedReason = side ? announceBlockedReason(side, teamName, nameOf) : null
  const announcing = announceMutation.isPending || unannounceMutation.isPending
  const announceError = announceMutation.isError
    ? errorDetail(announceMutation.error, "Couldn't announce this team. Please try again.")
    : null

  const listError =
    [reorderMutation, updateSideMutation, removeMutation, roleMutation, unannounceMutation]
      .map((mutation) =>
        mutation.isError ? errorDetail(mutation.error, 'Something went wrong updating the team. Please try again.') : null,
      )
      .find((message): message is string => Boolean(message)) ?? null

  return {
    settingUp,
    side,
    nameOf,
    poolLoading: pageQuery.isLoading,
    covered,
    poolLoaded: Boolean(pool),
    listPlayers,
    selectedCount: side?.players.length ?? 0,
    unconfirmed,
    breakdown,
    lateUnavailable,
    restCount: restPlayers.length,
    waitingCount,
    blockedReason,
    announcing,
    // Any write in flight: the strip's pickers wait for it.
    writing:
      announcing ||
      [reorderMutation, updateSideMutation, removeMutation, roleMutation].some((mutation) => mutation.isPending),
    announceError,
    announcePending: announceMutation.isPending,
    unannouncePending: unannounceMutation.isPending,
    listError,
    // Announce / Un-announce
    confirmAnnounce,
    setConfirmAnnounce,
    announce: (choices?: AnnounceRoleChoices) => announceMutation.mutate(choices),
    closeAnnounce: () => {
      announceMutation.reset()
      setConfirmAnnounce(false)
    },
    unannounce: () => unannounceMutation.mutate(),
    // The list's callbacks (each sends the side's own current values for the fields it does not change)
    onReorder: (ids: string[]) => reorderMutation.mutate(ids),
    onSetCaptain: (id: string | null) =>
      side &&
      updateSideMutation.mutate({
        captainPlayerId: id,
        wicketKeeperPlayerId: side.wicketKeeperPlayerId,
        twelfthManPlayerId: side.twelfthManPlayerId,
      }),
    onSetWicketKeeper: (id: string | null) =>
      side &&
      updateSideMutation.mutate({
        captainPlayerId: side.captainPlayerId,
        wicketKeeperPlayerId: id,
        twelfthManPlayerId: side.twelfthManPlayerId,
      }),
    onMakeTwelfthMan: (id: string) =>
      side &&
      updateSideMutation.mutate({
        captainPlayerId: side.captainPlayerId === id ? null : side.captainPlayerId,
        wicketKeeperPlayerId: side.wicketKeeperPlayerId === id ? null : side.wicketKeeperPlayerId,
        twelfthManPlayerId: id,
      }),
    onChangeRole: (playerId: string, role: PlayingRole) => roleMutation.mutate({ playerId, role }),
    onRemove: (playerId: string) => removeMutation.mutate(playerId),
    // The Select players dialog
    dialog: {
      open: selectOpen,
      openDialog: () => setSelectOpen(true),
      close: closeSelectDialog,
      pool: dialogQuery.data,
      poolLoading: dialogQuery.isLoading,
      poolError: dialogQuery.isError,
      source,
      setSource,
      previousMatches: (previousMatchesQuery.data ?? []).map((candidate) => ({
        id: candidate.id,
        label: `${new Date(candidate.matchDate).toLocaleDateString()} · vs ${opponentLabel(candidate, teamId, teamsById)}`,
      })),
      previousMatchesLoading: previousMatchesQuery.isLoading,
      previousMatchId,
      setPreviousMatchId,
      previousOrder: previousMatchId ? previousOrder : null,
      previousOrderLoading: previousSidesQuery.isLoading,
      search,
      setSearch,
      apply: handleApply,
      release: handleRelease,
      setAnswer: handleSetAnswer,
    },
    // Add new player (nested over the dialog)
    addPlayer: {
      open: addPlayerOpen,
      openDialog: () => {
        setAddPlayerTab(0)
        setAddPlayerOpen(true)
      },
      close: () => setAddPlayerOpen(false),
      tab: addPlayerTab,
      setTab: setAddPlayerTab,
      create: (payload: PlayerPayload) => createAndLinkPlayerMutation.mutate(payload),
      pending: createAndLinkPlayerMutation.isPending,
      isError: createAndLinkPlayerMutation.isError,
      errorMessage: errorDetail(
        createAndLinkPlayerMutation.error,
        "Couldn't create and add this player to the squad. Please try again.",
      ),
    },
  }
}

export type MatchSidePanel = ReturnType<typeof useMatchSidePanel>
