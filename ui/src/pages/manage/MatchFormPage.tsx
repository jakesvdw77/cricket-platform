import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Stack, Tab, Tabs, Typography } from '@mui/material'
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MatchForm, MATCH_FORM_ID } from '../../components/MatchForm'
import { PlayingXiBuilder } from '../../components/PlayingXiBuilder'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { getMatch, createMatch, updateMatch } from '../../api/matchApi'
import type { MatchPayload } from '../../api/matchApi'
import { listTeamsForClub } from '../../api/teamApi'
import { listSeasons } from '../../api/seasonApi'
import { listLeagues } from '../../api/leagueApi'
import { listSquad } from '../../api/teamSquadApi'
import {
  listMatchSides,
  createMatchSide,
  updateMatchSide,
  addMatchSidePlayer,
  updateMatchSidePlayerRole,
  removeMatchSidePlayer,
  reorderMatchSidePlayers,
} from '../../api/matchSideApi'
import type { PlayingRole, UpdateMatchSidePayload } from '../../api/matchSideApi'
import { errorDetail } from '../../utils/errorDetail'

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
}: {
  clubId: string
  matchId: string
  teamId: string
  seasonId: string
  cap: number
  label: string
}) {
  const queryClient = useQueryClient()
  const attemptedCreateRef = useRef(false)

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
      .find((message): message is string => Boolean(message)) ?? null

  return (
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
      onChangeCaptain={(id) => updateSideMutation.mutate({ captainPlayerId: id })}
      onChangeWicketKeeper={(id) => updateSideMutation.mutate({ wicketKeeperPlayerId: id })}
      onChangeTwelfthMan={(id) => updateSideMutation.mutate({ twelfthManPlayerId: id })}
      isAddPending={addPlayerMutation.isPending}
      errorMessage={errorMessage}
    />
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

  const match = matchQuery.data
  const league = useMemo(
    () => (match?.leagueId ? (leaguesQuery.data ?? []).find((candidate) => candidate.id === match.leagueId) : undefined),
    [match?.leagueId, leaguesQuery.data],
  )
  const cap = league?.maxPlayingXiSize ?? 11

  const showXiTabs = isEdit && Boolean(match)
  let nextTabIndex = 1
  const homeXiTabIndex = showXiTabs && match?.homeTeamId ? nextTabIndex++ : undefined
  const awayXiTabIndex = showXiTabs && match?.awayTeamId ? nextTabIndex++ : undefined
  const hasXiTabs = homeXiTabIndex !== undefined || awayXiTabIndex !== undefined

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
        activeTab === 0 ? (
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            {saveMutation.isError && (
              <Typography variant="body2" color="error.main">
                {errorDetail(saveMutation.error, 'Something went wrong saving this match. Please try again.')}
              </Typography>
            )}

            <Button type="submit" form={MATCH_FORM_ID} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create match'}
            </Button>
          </Stack>
        ) : null
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
          />
        </Box>
      )}
    </RecordFormScreen>
  )
}
