import { useCallback, useState } from 'react'
import { Box, Button as MuiButton, Stack, Typography } from '@mui/material'
import { Link as RouterLink, Navigate, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import { MatchForm, MATCH_FORM_ID } from '../../components/MatchForm'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { Button } from '../../components/Button'
import { RecordStatusToggle } from '../../components/RecordStatusToggle'
import { EmptyState } from '../../components/EmptyState'
import {
  getMatch,
  createMatch,
  updateMatch,
  deactivateMatch,
  reactivateMatch,
} from '../../api/matchApi'
import type { Match, MatchPayload } from '../../api/matchApi'
import { listTeamsForClub } from '../../api/teamApi'
import { listSeasons } from '../../api/seasonApi'
import { listLeagues } from '../../api/leagueApi'
import { listLeagueAffiliations } from '../../api/leagueAffiliationApi'
import { leagueTeamsQueryKey, listLeagueTeams } from '../../api/leagueTeamApi'
import { activateSession } from '../../api/meApi'
import { errorDetail } from '../../utils/errorDetail'
import { NO_CLUB_TEAM_REASON } from './matches/matchCardHelpers'
import { selectTeamPath } from './teamSelection/selectionLinks'

// docs/specs/093-team-selection-hub.md: the old deep links into the removed Home XI / Away XI tabs
// (?tab=playing-xi, ?tab=home-xi, ?tab=away-xi, and the pre-076 ?tab=match-squad&side=...) lead to the Select team page
// of the side they named, falling back to the other side when that one is not a team of the club. Null when the address
// names no such tab.
function legacySelectionTarget(search: URLSearchParams, match: Match): string | null {
  const tab = search.get('tab')
  const wantsAway = tab === 'away-xi' || (tab === 'match-squad' && search.get('side') === 'away')
  const isSelectionTab = tab === 'playing-xi' || tab === 'home-xi' || tab === 'away-xi' || tab === 'match-squad'
  if (!isSelectionTab || (!match.homeTeamId && !match.awayTeamId)) {
    return null
  }
  const home = wantsAway ? !match.awayTeamId : Boolean(match.homeTeamId)
  return selectTeamPath(match.id, null, home)
}

// docs/specs/029-league-management.md: RecordFormScreen wrapping MatchForm for create and edit. Team selection moved to
// the Select team page (docs/specs/093); Edit Match is the Details only, with a link to it.
export default function MatchFormPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { matchId } = useParams<{ matchId?: string }>()
  const isEdit = Boolean(matchId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

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
  // docs/specs/093: Select team links to the Select team page of the first side that is a team of the club.
  const hasOwnTeam = Boolean(match?.homeTeamId) || Boolean(match?.awayTeamId)

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

  // The old Playing XI deep links open the Select team page instead.
  const legacyTarget = isEdit && match ? legacySelectionTarget(searchParams, match) : null
  if (legacyTarget) {
    return <Navigate to={legacyTarget} replace />
  }

  return (
    <RecordFormScreen
      title={isEdit ? 'Edit Match' : 'Add Match'}
      backTo="/manage/fixtures/matches"
      backLabel="Back to Matches"
      headerAction={
        isEdit && match ? (
          <Box component="span" title={hasOwnTeam ? undefined : NO_CLUB_TEAM_REASON} sx={{ display: 'inline-flex' }}>
            {hasOwnTeam && match ? (
              <MuiButton
                component={RouterLink}
                to={selectTeamPath(match.id, null, Boolean(match.homeTeamId))}
                variant="outlined"
                startIcon={<GroupsOutlinedIcon fontSize="small" />}
              >
                Select team
              </MuiButton>
            ) : (
              <MuiButton variant="outlined" disabled startIcon={<GroupsOutlinedIcon fontSize="small" />}>
                Select team
              </MuiButton>
            )}
          </Box>
        ) : undefined
      }
      actions={
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          {saveMutation.isError && (
            <Typography variant="body2" color="error.main">
              {errorDetail(saveMutation.error, 'Something went wrong saving this match. Please try again.')}
            </Typography>
          )}

          {/* docs/specs/089 (B): Cancel goes back to the match (edit) or the list (add), without saving. */}
          <MuiButton component={RouterLink} to={isEdit && match ? `/manage/fixtures/matches/${match.id}` : '/manage/fixtures/matches'} variant="outlined">
            Cancel
          </MuiButton>

          <Button type="submit" form={MATCH_FORM_ID} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create match'}
          </Button>

          {/* docs/specs/093: Deactivate / Reactivate is a record action, so it lives with Details, not with selection. */}
          {isEdit && match && (
            <RecordStatusToggle active={match.active} pending={toggle.isPending} onClick={() => toggle.mutate()} />
          )}
        </Stack>
      }
    >
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
    </RecordFormScreen>
  )
}
