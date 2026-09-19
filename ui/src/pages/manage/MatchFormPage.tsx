import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { MatchForm, MATCH_FORM_ID } from '../../components/MatchForm'
import { PlayingXiBuilder } from '../../components/PlayingXiBuilder'
import { MatchAvailabilityTab } from '../../components/MatchAvailabilityTab'
import { PollShareDialog } from '../../components/PollShareDialog'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { CreateAndLinkRecordDialog } from '../../components/CreateAndLinkRecordDialog'
import { LinkExistingRecordDialog } from '../../components/LinkExistingRecordDialog'
import { PlayerForm, PLAYER_FORM_ID } from '../../components/PlayerForm'
import { Button } from '../../components/Button'
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
import { listSquad, addToSquad } from '../../api/teamSquadApi'
import { createPlayer } from '../../api/playerApi'
import type { PlayerPayload } from '../../api/playerApi'
import {
  listMatchSides,
  createMatchSide,
  updateMatchSide,
  addMatchSidePlayer,
  updateMatchSidePlayerRole,
  removeMatchSidePlayer,
  reorderMatchSidePlayers,
} from '../../api/matchSideApi'
import type { MatchSide, PlayingRole, UpdateMatchSidePayload } from '../../api/matchSideApi'
import { listPolls, createPoll, openPoll, closePoll, getPollResponses, setPlayerStatus } from '../../api/matchAvailabilityApi'
import type { AvailabilityStatus, MatchAvailabilityPoll } from '../../api/matchAvailabilityApi'
import { errorDetail } from '../../utils/errorDetail'

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
// previous-match candidate in the "Re-select from Previous Match" picker — mirrors
// sideDisplayName above rather than duplicating its team-lookup logic.
function opponentLabel(match: Match, teamId: string, teamsById: Map<string, Team>): string {
  if (match.homeTeamId === teamId) {
    return sideDisplayName(match.awayTeamId, match.awayTeamName, teamsById)
  }
  return sideDisplayName(match.homeTeamId, match.homeTeamName, teamsById)
}

// One Playing XI tab's content — data fetching/mutations live here (React Query, not inside
// PlayingXiBuilder itself, per docs/standards/frontend.md's "server state in the page" rule).
// Creates the MatchSide on first use if none exists yet, per docs/specs/029-league-management.md.
function MatchSideTab({
  clubId,
  matchId,
  teamId,
  seasonId,
  cap,
  label,
  teamsById,
  leagueId,
}: {
  clubId: string
  matchId: string
  teamId: string
  seasonId: string
  cap: number
  label: string
  teamsById: Map<string, Team>
  leagueId: string | null
}) {
  const queryClient = useQueryClient()
  const attemptedCreateRef = useRef(false)
  // docs/specs/037-match-improvements.md item 8: "Add Squad Member" dialog/mutation state — owned
  // here (the page), not inside PlayingXiBuilder, per docs/standards/frontend.md's "server state
  // in the page" rule. addPlayerTab is this dialog's own small local 3-tab bar state (PlayerForm
  // externalizes its Basic/Contact/Cricket Info tab bar to its caller — same pattern
  // PlayerFormPage.tsx already uses).
  const [squadMemberDialogOpen, setSquadMemberDialogOpen] = useState(false)
  const [addPlayerTab, setAddPlayerTab] = useState<0 | 1 | 2>(0)
  // docs/specs/037-match-improvements.md item 9: "Re-select from Previous Match" picker/confirm/
  // copy-summary state — owned here for the same "server state in the page" reason as above.
  const [previousMatchDialogOpen, setPreviousMatchDialogOpen] = useState(false)
  const [pendingSourceMatch, setPendingSourceMatch] = useState<Match | null>(null)
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false)
  const [copySummary, setCopySummary] = useState<{
    copiedCount: number
    totalSourcePlayers: number
    skippedCount: number
  } | null>(null)

  const sidesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId, 'sides'],
    queryFn: () => listMatchSides(clubId, matchId),
  })

  const squadQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', teamId, 'seasons', seasonId, 'squad'],
    queryFn: () => listSquad(clubId, teamId, seasonId),
  })

  const invalidateSides = () =>
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches', matchId, 'sides'] })

  const createSideMutation = useMutation({
    mutationFn: () => createMatchSide(clubId, matchId, teamId),
    onSuccess: invalidateSides,
  })

  const side = (sidesQuery.data ?? []).find((candidate) => candidate.teamId === teamId)

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

  const addPlayerMutation = useMutation({
    mutationFn: ({ playerId, role }: { playerId: string; role: PlayingRole }) =>
      addMatchSidePlayer(clubId, matchId, (side as { id: string }).id, playerId, role),
    onSuccess: invalidateSides,
  })
  const removePlayerMutation = useMutation({
    mutationFn: (playerId: string) => removeMatchSidePlayer(clubId, matchId, (side as { id: string }).id, playerId),
    onSuccess: invalidateSides,
  })
  const roleMutation = useMutation({
    mutationFn: ({ playerId, role }: { playerId: string; role: PlayingRole }) =>
      updateMatchSidePlayerRole(clubId, matchId, (side as { id: string }).id, playerId, role),
    onSuccess: invalidateSides,
  })
  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => reorderMatchSidePlayers(clubId, matchId, (side as { id: string }).id, ids),
    onSuccess: invalidateSides,
  })
  const updateSideMutation = useMutation({
    mutationFn: (payload: UpdateMatchSidePayload) => updateMatchSide(clubId, matchId, (side as { id: string }).id, payload),
    onSuccess: invalidateSides,
  })

  // docs/specs/037-match-improvements.md item 8: creates a brand-new Player then adds them to
  // this side's team/season squad — two sequential calls in one mutation, matching
  // TeamFormPage.tsx's existing createAndLinkContactMutation/createAndLinkSponsorMutation shape.
  const createAndLinkPlayerMutation = useMutation({
    mutationFn: async (payload: PlayerPayload) => {
      const player = await createPlayer(clubId, payload)
      await addToSquad(clubId, teamId, seasonId, player.id)
      return player
    },
    onSuccess: () => {
      // Same query key squadQuery below already uses — the new player becomes selectable in
      // PlayingXiBuilder's "Add player" Autocomplete immediately, without a page reload.
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'teams', teamId, 'seasons', seasonId, 'squad'] })
      setSquadMemberDialogOpen(false)
    },
  })

  // docs/specs/037-match-improvements.md item 9: this side's own previous, identically-scoped
  // matches — fetched only while the picker is open, so opening it is the only trigger for this
  // (potentially per-open-stale) network call.
  const previousMatchesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', teamId, 'seasons', seasonId, 'matches', 'previous', leagueId, matchId],
    queryFn: () => listPreviousMatches(clubId, teamId, seasonId, { leagueId, excludeMatchId: matchId }),
    enabled: previousMatchDialogOpen,
  })

  // docs/specs/037-match-improvements.md item 9: copies a previous match's side onto this one —
  // mirrors createAndLinkPlayerMutation's own "sequential awaited calls inside one mutationFn"
  // shape above. Clears the destination side first (if non-empty), replays the source's players in
  // batting-order, then resolves which of captain/wicketkeeper/twelfth-man actually carried over.
  const copyFromPreviousMatchMutation = useMutation({
    mutationFn: async (sourceMatchId: string) => {
      const sourceSides = await listMatchSides(clubId, sourceMatchId)
      const sourceSide = sourceSides.find((candidate) => candidate.teamId === teamId)
      const destinationSide = side as MatchSide

      if (!sourceSide) {
        return { copiedCount: 0, totalSourcePlayers: 0, skippedCount: 0 }
      }

      const destinationNonEmpty =
        destinationSide.players.length > 0 ||
        Boolean(destinationSide.captainPlayerId) ||
        Boolean(destinationSide.wicketKeeperPlayerId) ||
        Boolean(destinationSide.twelfthManPlayerId)

      if (destinationNonEmpty) {
        for (const player of destinationSide.players) {
          await removeMatchSidePlayer(clubId, matchId, destinationSide.id, player.playerProfileId)
        }
        await updateMatchSide(clubId, matchId, destinationSide.id, {
          captainPlayerId: null,
          wicketKeeperPlayerId: null,
          twelfthManPlayerId: null,
        })
      }

      const copiedIds = new Set<string>()
      let skippedCount = 0

      const orderedSourcePlayers = [...sourceSide.players].sort((a, b) => a.battingOrder - b.battingOrder)
      for (const player of orderedSourcePlayers) {
        try {
          await addMatchSidePlayer(clubId, matchId, destinationSide.id, player.playerProfileId, player.role)
          copiedIds.add(player.playerProfileId)
        } catch (error) {
          if (isAxiosError(error) && error.response?.status === 400) {
            skippedCount += 1
          } else {
            throw error
          }
        }
      }

      const currentSquadIds = new Set((squadQuery.data ?? []).map((member) => member.playerProfileId))

      let captainPlayerId: string | null = null
      if (sourceSide.captainPlayerId) {
        if (copiedIds.has(sourceSide.captainPlayerId)) {
          captainPlayerId = sourceSide.captainPlayerId
        } else {
          skippedCount += 1
        }
      }

      let wicketKeeperPlayerId: string | null = null
      if (sourceSide.wicketKeeperPlayerId) {
        if (copiedIds.has(sourceSide.wicketKeeperPlayerId)) {
          wicketKeeperPlayerId = sourceSide.wicketKeeperPlayerId
        } else {
          skippedCount += 1
        }
      }

      let twelfthManPlayerId: string | null = null
      if (sourceSide.twelfthManPlayerId) {
        if (!copiedIds.has(sourceSide.twelfthManPlayerId) && currentSquadIds.has(sourceSide.twelfthManPlayerId)) {
          twelfthManPlayerId = sourceSide.twelfthManPlayerId
        } else {
          skippedCount += 1
        }
      }

      try {
        await updateMatchSide(clubId, matchId, destinationSide.id, {
          captainPlayerId,
          wicketKeeperPlayerId,
          twelfthManPlayerId,
        })
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 400) {
          // Defensive edge case: one of the resolved ids somehow still fails validation. Don't
          // retry — just count all three as skipped (if they were set) and let the copy finish
          // without captain/WK/12th set, rather than crashing the whole mutation over this.
          skippedCount += [captainPlayerId, wicketKeeperPlayerId, twelfthManPlayerId].filter(Boolean).length
        } else {
          throw error
        }
      }

      return {
        copiedCount: copiedIds.size,
        totalSourcePlayers: sourceSide.players.length,
        skippedCount,
      }
    },
    onSuccess: (result) => {
      invalidateSides()
      setConfirmReplaceOpen(false)
      setPreviousMatchDialogOpen(false)
      setPendingSourceMatch(null)
      setCopySummary(result)
    },
  })

  const handlePickPreviousMatch = (candidate: Match) => {
    const currentSide = side as MatchSide
    const destinationNonEmpty =
      currentSide.players.length > 0 ||
      Boolean(currentSide.captainPlayerId) ||
      Boolean(currentSide.wicketKeeperPlayerId) ||
      Boolean(currentSide.twelfthManPlayerId)

    if (destinationNonEmpty) {
      setPendingSourceMatch(candidate)
      setConfirmReplaceOpen(true)
    } else {
      copyFromPreviousMatchMutation.mutate(candidate.id)
    }
  }

  // docs/specs/033-availability-aware-xi-builder.md: a second, small data fetch mirroring
  // MatchAvailabilityPanel's own shape exactly (identical query-key shape, same match) so an admin
  // building this side's XI sees the same poll responses inline. Deliberately NOT added to the
  // loading guard below — indicators simply appear once/if this resolves, XI building is never
  // blocked or delayed waiting on poll data.
  const pollsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId, 'polls'],
    queryFn: () => listPolls(clubId, matchId),
  })

  const poll = (pollsQuery.data ?? []).find((candidate) => candidate.teamId === teamId) ?? null

  const responsesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId, 'polls', poll?.id, 'responses'],
    queryFn: () => getPollResponses(clubId, matchId, (poll as MatchAvailabilityPoll).id),
    enabled: Boolean(poll),
  })

  const availabilityByPlayerId = useMemo(() => {
    const map = new Map<string, AvailabilityStatus>()
    ;(responsesQuery.data?.responses ?? []).forEach((row) => {
      if (row.status) {
        map.set(row.playerProfileId, row.status)
      }
    })
    return map
  }, [responsesQuery.data])

  if (sidesQuery.isLoading || squadQuery.isLoading || createSideMutation.isPending || !side) {
    return (
      <Typography variant="body2" color="text.secondary">
        Setting up {label}…
      </Typography>
    )
  }

  const errorMessage =
    [addPlayerMutation, removePlayerMutation, roleMutation, reorderMutation, updateSideMutation]
      .map((mutation) =>
        mutation.isError
          ? errorDetail(mutation.error, 'Something went wrong updating the playing XI. Please try again.')
          : null,
      )
      .find((message): message is string => Boolean(message)) ??
    (copyFromPreviousMatchMutation.isError
      ? errorDetail(
          copyFromPreviousMatchMutation.error,
          'Something went wrong re-selecting the team from a previous match. Please try again.',
        )
      : null)

  return (
    <>
      <PlayingXiBuilder
        squad={squadQuery.data ?? []}
        xi={side.players}
        captainPlayerId={side.captainPlayerId}
        wicketKeeperPlayerId={side.wicketKeeperPlayerId}
        twelfthManPlayerId={side.twelfthManPlayerId}
        cap={cap}
        onAddPlayer={(playerId, role) => addPlayerMutation.mutate({ playerId, role })}
        onRemovePlayer={(playerId) => removePlayerMutation.mutate(playerId)}
        onChangeRole={(playerId, role) => roleMutation.mutate({ playerId, role })}
        onReorderPlayers={(ids) => reorderMutation.mutate(ids)}
        // docs/specs/037-match-improvements.md item 5: PUT .../sides/{sideId} is a full 3-field
        // replace, not a partial merge (MatchSideServiceImpl.updateSide unconditionally overwrites
        // all three) — each handler must send the side's own current values for the two fields NOT
        // being changed, or setting one silently clears whichever of the other two was already set.
        onChangeCaptain={(id) =>
          updateSideMutation.mutate({
            captainPlayerId: id,
            wicketKeeperPlayerId: side.wicketKeeperPlayerId,
            twelfthManPlayerId: side.twelfthManPlayerId,
          })
        }
        onChangeWicketKeeper={(id) =>
          updateSideMutation.mutate({
            captainPlayerId: side.captainPlayerId,
            wicketKeeperPlayerId: id,
            twelfthManPlayerId: side.twelfthManPlayerId,
          })
        }
        onChangeTwelfthMan={(id) =>
          updateSideMutation.mutate({
            captainPlayerId: side.captainPlayerId,
            wicketKeeperPlayerId: side.wicketKeeperPlayerId,
            twelfthManPlayerId: id,
          })
        }
        isAddPending={addPlayerMutation.isPending}
        errorMessage={errorMessage}
        availabilityByPlayerId={availabilityByPlayerId}
        onAddSquadMember={() => {
          setAddPlayerTab(0)
          setSquadMemberDialogOpen(true)
        }}
        onReselectFromPreviousMatch={() => setPreviousMatchDialogOpen(true)}
      />

      {/* docs/specs/037-match-improvements.md item 9: same placement convention as the errorMessage
          Alert above (passed into PlayingXiBuilder itself) — this one renders as a sibling since
          it's a MatchSideTab-owned summary, not a per-mutation error. */}
      {copySummary && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            Copied {copySummary.copiedCount} of {copySummary.totalSourcePlayers} players from the previous XI.
          </Typography>
          {copySummary.skippedCount > 0 && (
            <Typography variant="body2">
              {copySummary.skippedCount} couldn't be copied — no longer eligible for this match. Add them manually.
            </Typography>
          )}
        </Alert>
      )}

      {/* docs/specs/037-match-improvements.md item 9: the picker — LinkExistingRecordDialog's
          no-extraField mode, so picking an option fires onLink immediately. */}
      <LinkExistingRecordDialog<Match>
        open={previousMatchDialogOpen}
        onClose={() => setPreviousMatchDialogOpen(false)}
        title="Re-select from Previous Match"
        candidates={previousMatchesQuery.data ?? []}
        loading={previousMatchesQuery.isLoading}
        getOptionLabel={(candidate) => `${new Date(candidate.matchDate).toLocaleDateString()} — vs ${opponentLabel(candidate, teamId, teamsById)}`}
        onLink={(candidate) => handlePickPreviousMatch(candidate)}
      />

      {/* docs/specs/037-match-improvements.md item 9: destructive-replace confirmation — a one-off
          inline Dialog, not a new shared component, since there's no other consumer yet. */}
      <Dialog open={confirmReplaceOpen} onClose={() => setConfirmReplaceOpen(false)}>
        <DialogTitle>Replace the current Playing XI?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This replaces every player, role, and batting-order position currently set for {label}.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            variant="ghost"
            onClick={() => {
              setConfirmReplaceOpen(false)
              setPendingSourceMatch(null)
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => pendingSourceMatch && copyFromPreviousMatchMutation.mutate(pendingSourceMatch.id)}
            disabled={copyFromPreviousMatchMutation.isPending}
          >
            {copyFromPreviousMatchMutation.isPending ? 'Replacing…' : 'Replace'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* docs/specs/037-match-improvements.md item 8: CreateAndLinkRecordDialog/PlayerForm both
          unmodified — since PlayerForm externalizes its own Basic/Contact/Cricket Info tab bar to
          its caller, this dialog wrapper renders that same small local 3-tab bar (mirroring
          PlayerFormPage.tsx's own tab-owning pattern) so the quick-add flow isn't limited to Basic
          Info only. */}
      <CreateAndLinkRecordDialog<PlayerPayload>
        open={squadMemberDialogOpen}
        onClose={() => setSquadMemberDialogOpen(false)}
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
    </>
  )
}

// One Availability tab side's content — data fetching/mutations live here (React Query, not
// inside MatchAvailabilityTab itself, per docs/standards/frontend.md's "server state in the page"
// rule), mirroring MatchSideTab's own shape above. Explicit divergence from MatchSideTab: a poll
// is NOT auto-created on mount — it only gets created when the admin explicitly clicks "Open a
// poll for this side" (docs/specs/032-match-availability-polls.md), since unlike a MatchSide,
// there's no reason every match side needs a poll by default.
function MatchAvailabilityPanel({
  clubId,
  matchId,
  teamId,
  match,
  label,
  teamName,
}: {
  clubId: string
  matchId: string
  teamId: string
  match: Match
  label: string
  teamName: string
}) {
  const queryClient = useQueryClient()
  const [shareDialogOpen, setShareDialogOpen] = useState(false)

  const pollsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId, 'polls'],
    queryFn: () => listPolls(clubId, matchId),
  })

  const poll = (pollsQuery.data ?? []).find((candidate) => candidate.teamId === teamId) ?? null

  const responsesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId, 'polls', poll?.id, 'responses'],
    queryFn: () => getPollResponses(clubId, matchId, (poll as MatchAvailabilityPoll).id),
    enabled: Boolean(poll),
  })

  // Invalidating the base 'polls' key also invalidates the more specific
  // [...'polls', pollId, 'responses'] query below (React Query's default partial-key matching),
  // so a single invalidation covers both the list and the currently-open detail view.
  const invalidatePolls = () =>
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches', matchId, 'polls'] })

  const createMutation = useMutation({
    mutationFn: () => createPoll(clubId, matchId, teamId),
    onSuccess: invalidatePolls,
  })
  const openMutation = useMutation({
    mutationFn: () => openPoll(clubId, matchId, (poll as MatchAvailabilityPoll).id),
    onSuccess: invalidatePolls,
  })
  const closeMutation = useMutation({
    mutationFn: () => closePoll(clubId, matchId, (poll as MatchAvailabilityPoll).id),
    onSuccess: invalidatePolls,
  })
  const setPlayerStatusMutation = useMutation({
    mutationFn: ({ playerProfileId, status }: { playerProfileId: string; status: AvailabilityStatus }) =>
      setPlayerStatus(clubId, matchId, (poll as MatchAvailabilityPoll).id, playerProfileId, status),
    onSuccess: invalidatePolls,
  })

  const errorMessage =
    [createMutation, openMutation, closeMutation, setPlayerStatusMutation]
      .map((mutation) =>
        mutation.isError
          ? errorDetail(mutation.error, 'Something went wrong updating this poll. Please try again.')
          : null,
      )
      .find((message): message is string => Boolean(message)) ?? null

  return (
    <>
      <MatchAvailabilityTab
        label={label}
        poll={poll ? responsesQuery.data ?? null : null}
        isLoading={pollsQuery.isLoading || (Boolean(poll) && responsesQuery.isLoading)}
        onCreate={() => createMutation.mutate()}
        onOpen={() => openMutation.mutate()}
        onClose={() => closeMutation.mutate()}
        onShareInvite={() => setShareDialogOpen(true)}
        onSetPlayerStatus={(playerProfileId, status) => setPlayerStatusMutation.mutate({ playerProfileId, status })}
        isCreatePending={createMutation.isPending}
        isOpenPending={openMutation.isPending}
        isClosePending={closeMutation.isPending}
        settingPlayerId={
          setPlayerStatusMutation.isPending ? setPlayerStatusMutation.variables?.playerProfileId ?? null : null
        }
        errorMessage={errorMessage}
      />
      {poll && (
        <PollShareDialog
          open={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
          match={match}
          teamName={teamName}
          pollId={poll.id}
        />
      )}
    </>
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
  const [activeTab, setActiveTab] = useState(0)
  const [activeAvailabilitySubTab, setActiveAvailabilitySubTab] = useState(0)

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
  const league = useMemo(
    () => (match?.leagueId ? (leaguesQuery.data ?? []).find((candidate) => candidate.id === match.leagueId) : undefined),
    [match?.leagueId, leaguesQuery.data],
  )
  const cap = league?.maxPlayingXiSize ?? 11

  const teamsById = useMemo(() => {
    const map = new Map<string, Team>()
    ;(teamsQuery.data ?? []).forEach((team) => map.set(team.id, team))
    return map
  }, [teamsQuery.data])

  const showXiTabs = isEdit && Boolean(match)
  let nextTabIndex = 1
  const homeXiTabIndex = showXiTabs && match?.homeTeamId ? nextTabIndex++ : undefined
  const awayXiTabIndex = showXiTabs && match?.awayTeamId ? nextTabIndex++ : undefined
  const hasXiTabs = homeXiTabIndex !== undefined || awayXiTabIndex !== undefined
  // docs/specs/032-match-availability-polls.md: Availability gets a fourth top-level tab, gated
  // by the exact same "at least one side is a real Team" rule as the XI tabs above — a poll only
  // ever makes sense for a real-Team side.
  const availabilityTabIndex = hasXiTabs ? nextTabIndex++ : undefined
  const homeAvailabilitySubIndex = match?.homeTeamId ? 0 : undefined
  const awayAvailabilitySubIndex = match?.awayTeamId ? (homeAvailabilitySubIndex !== undefined ? 1 : 0) : undefined

  // SquadPicker's cards route straight into a match's Playing XI tab (?tab=playing-xi) rather
  // than Details — jumps to whichever XI tab exists first (home, else away) once the match (and
  // therefore its real tab indices) has loaded.
  useEffect(() => {
    if (searchParams.get('tab') === 'playing-xi' && hasXiTabs) {
      setActiveTab(homeXiTabIndex ?? (awayXiTabIndex as number))
    }
    // Only re-evaluated when the deep-link target itself becomes available — not on every
    // activeTab change caused by the admin's own tab clicks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, hasXiTabs, homeXiTabIndex, awayXiTabIndex])

  // docs/specs/034-availability-polls-dashboard.md: AvailabilityPollsDashboard's own "Manage
  // responses" action routes straight into this match's Availability tab, on the correct side's
  // sub-tab — the exact same deep-link mechanism as ?tab=playing-xi above, one more recognized
  // query-string shape rather than a new deep-linking system.
  useEffect(() => {
    if (searchParams.get('tab') === 'availability' && availabilityTabIndex !== undefined) {
      setActiveTab(availabilityTabIndex)
      const side = searchParams.get('side')
      if (side === 'home' && homeAvailabilitySubIndex !== undefined) {
        setActiveAvailabilitySubTab(homeAvailabilitySubIndex)
      } else if (side === 'away' && awayAvailabilitySubIndex !== undefined) {
        setActiveAvailabilitySubTab(awayAvailabilitySubIndex)
      }
    }
    // Only re-evaluated when the deep-link target itself becomes available — not on every
    // activeTab/activeAvailabilitySubTab change caused by the admin's own tab clicks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, availabilityTabIndex, homeAvailabilitySubIndex, awayAvailabilitySubIndex])

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
      actions={
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          {activeTab === 0 && (
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
            value={activeTab}
            onChange={(_event, next: number) => setActiveTab(next)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
          >
            <Tab label="Details" />
            {homeXiTabIndex !== undefined && <Tab label="Home XI" />}
            {awayXiTabIndex !== undefined && <Tab label="Away XI" />}
            {availabilityTabIndex !== undefined && <Tab label="Availability" />}
          </Tabs>
        </Box>
      )}

      {activeTab === 0 && (
        <MatchForm
          initialValues={
            match
              ? {
                  homeTeamId: match.homeTeamId,
                  homeTeamName: match.homeTeamName,
                  awayTeamId: match.awayTeamId,
                  awayTeamName: match.awayTeamName,
                  leagueId: match.leagueId,
                  seasonId: match.seasonId,
                  matchDate: match.matchDate,
                  venue: match.venue,
                }
              : undefined
          }
          teams={teamsQuery.data ?? []}
          seasons={seasonsQuery.data ?? []}
          leagues={leaguesQuery.data ?? []}
          onSubmit={(payload) => saveMutation.mutate(payload)}
        />
      )}

      {homeXiTabIndex !== undefined && activeTab === homeXiTabIndex && match && (
        <Box sx={{ gridColumn: '1 / -1' }}>
          <MatchSideTab
            clubId={clubId}
            matchId={match.id}
            teamId={match.homeTeamId as string}
            seasonId={match.seasonId}
            cap={cap}
            label="the home side"
            teamsById={teamsById}
            leagueId={match.leagueId}
          />
        </Box>
      )}

      {awayXiTabIndex !== undefined && activeTab === awayXiTabIndex && match && (
        <Box sx={{ gridColumn: '1 / -1' }}>
          <MatchSideTab
            clubId={clubId}
            matchId={match.id}
            teamId={match.awayTeamId as string}
            seasonId={match.seasonId}
            cap={cap}
            label="the away side"
            teamsById={teamsById}
            leagueId={match.leagueId}
          />
        </Box>
      )}

      {availabilityTabIndex !== undefined && activeTab === availabilityTabIndex && match && (
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Tabs
            value={activeAvailabilitySubTab}
            onChange={(_event, next: number) => setActiveAvailabilitySubTab(next)}
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
          >
            {homeAvailabilitySubIndex !== undefined && <Tab label="Home" />}
            {awayAvailabilitySubIndex !== undefined && <Tab label="Away" />}
          </Tabs>

          {homeAvailabilitySubIndex !== undefined && activeAvailabilitySubTab === homeAvailabilitySubIndex && (
            <MatchAvailabilityPanel
              clubId={clubId}
              matchId={match.id}
              teamId={match.homeTeamId as string}
              match={match}
              label="the home side"
              teamName={sideDisplayName(match.homeTeamId, match.homeTeamName, teamsById)}
            />
          )}

          {awayAvailabilitySubIndex !== undefined && activeAvailabilitySubTab === awayAvailabilitySubIndex && (
            <MatchAvailabilityPanel
              clubId={clubId}
              matchId={match.id}
              teamId={match.awayTeamId as string}
              match={match}
              label="the away side"
              teamName={sideDisplayName(match.awayTeamId, match.awayTeamName, teamsById)}
            />
          )}
        </Box>
      )}
    </RecordFormScreen>
  )
}
