import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button as MuiButton, Stack, Typography } from '@mui/material'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import { Link as RouterLink, useLocation, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LeagueForm, LEAGUE_FORM_ID } from '../../components/LeagueForm'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { HeaderSeasonSelect } from '../../components/HeaderSeasonSelect'
import { LeagueAgeReferenceLine } from '../../components/LeagueAgeReferenceLine'
import { Button, compactButtonSx } from '../../components/Button'
import { RecordStatusToggle } from '../../components/RecordStatusToggle'
import { EmptyState } from '../../components/EmptyState'
import { LinkExistingRecordDialog } from '../../components/LinkExistingRecordDialog'
import { ShareLeagueDialog } from '../../components/ShareLeagueDialog'
import type { LeagueContent } from '../../utils/share/leagueShareFormats'
import { DuplicateLeagueDialog } from './leagues/DuplicateLeagueDialog'
import { LeagueEditTabs } from './leagueEdit/LeagueEditTabs'
import { resolveLeagueEditTab } from './leagueEdit/leagueEditTabConfig'
import { LeagueEditTeamsTab } from './leagueEdit/LeagueEditTeamsTab'
import { LeagueEditScheduleTab } from './leagueEdit/LeagueEditScheduleTab'
import { LeagueSeasonDatesBlock } from './leagueEdit/LeagueSeasonDatesBlock'
import { LeagueEditConditionsTab } from './leagueEdit/LeagueEditConditionsTab'
import { LeagueEditContactsTab } from './leagueEdit/LeagueEditContactsTab'
import { listLeagues, createLeague, updateLeague, deactivateLeague, reactivateLeague } from '../../api/leagueApi'
import type { LeaguePayload } from '../../api/leagueApi'
import { listSeasons } from '../../api/seasonApi'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { listAllMatches } from '../../api/matchApi'
import { listLeagueAffiliations, createLeagueAffiliation } from '../../api/leagueAffiliationApi'
import {
  getPlayingConditions,
  uploadPlayingConditions,
  updatePlayingConditions,
} from '../../api/leaguePlayingConditionsApi'
import type { PlayingConditionsPayload } from '../../api/leaguePlayingConditionsApi'
import { listLeagueContacts } from '../../api/leagueContactApi'
import { pickDefaultSeasonId } from '../../utils/defaultSeason'
import { errorDetail } from '../../utils/errorDetail'
import { resolvePlayingConditionsPayload } from '../../utils/playingConditions'

// docs/specs/029-league-management.md and docs/specs/095-league-edit-gold-standard.md: the standard list/create/update CRUD
// anatomy, extended in edit mode with a tab strip (?tab=details|teams|schedule|conditions|contacts), each tab in its own
// file under ./leagueEdit. This page keeps the page-level queries, the season state, the Details save and deactivate
// mutations and the three dialogs the tabs open.
// The tabs whose content is scoped to a season, so the header Season pill shows on them only.
const SEASON_TABS: readonly string[] = ['teams', 'schedule', 'conditions']

export default function LeagueFormPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { leagueId } = useParams<{ leagueId?: string }>()
  const isEdit = Boolean(leagueId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const location = useLocation()

  // Create mode has no tab strip, so ?tab= is ignored there.
  const activeTab = isEdit ? resolveLeagueEditTab(searchParams.get('tab')) : 'details'
  const seasonParam = searchParams.get('seasonId')
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  // docs/specs/122-league-sharing.md: the one Share League dialog; the Schedule tab opens it on Schedule, the Conditions tab on
  // Playing conditions.
  const [sharePreselected, setSharePreselected] = useState<LeagueContent[] | null>(null)
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  // docs/specs/096-duplicate-league.md: the success notice a Duplicate league navigation carries in router state. Read once
  // on mount, shown until dismissed, and the router state is then cleared so a reload or Back does not show it again.
  const [notice, setNotice] = useState<string | null>(() => {
    const carried = (location.state as { notice?: unknown } | null)?.notice
    return typeof carried === 'string' ? carried : null
  })
  useEffect(() => {
    if ((location.state as { notice?: unknown } | null)?.notice) {
      navigate(location.pathname + location.search, { replace: true, state: null })
    }
  }, [location, navigate])

  const {
    data: league,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'leagues'],
    queryFn: () => listLeagues(clubId as string),
    enabled: Boolean(clubId) && isEdit,
    select: (leagues) => leagues.find((candidate) => candidate.id === leagueId),
  })

  const seasonsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId) && isEdit,
  })

  const teamsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId as string),
    enabled: Boolean(clubId) && isEdit,
  })

  const affiliationsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'affiliations'],
    queryFn: () => listLeagueAffiliations(clubId as string, leagueId as string),
    enabled: Boolean(clubId) && Boolean(leagueId) && isEdit,
  })

  // docs/specs/054-league-contacts.md: the Contacts tab's own contact list, a league's contacts
  // are a small, bounded collection, deliberately not paginated (same as listSponsorContacts).
  const contactsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'contacts'],
    queryFn: () => listLeagueContacts(clubId as string, leagueId as string),
    enabled: Boolean(clubId) && Boolean(leagueId) && isEdit,
  })

  // docs/specs/050-league-schedule-and-fixtures.md: the Schedule tab's own season-scoped match
  // list, rendered by LeagueFixturesTable (see LeagueEditScheduleTab), reuses the existing
  // listAllMatches (docs/specs/072-league-view-pages.md: every page of the season, not just the first
  // 20) filter combination, no new endpoint.
  const matchesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'matches', selectedSeasonId],
    queryFn: () => listAllMatches(clubId as string, { leagueId: leagueId as string, seasonId: selectedSeasonId }),
    enabled: Boolean(clubId) && Boolean(leagueId) && Boolean(selectedSeasonId) && isEdit,
  })

  const playingConditionsQueryKey = [
    'managed-club',
    clubId,
    'leagues',
    leagueId,
    'seasons',
    selectedSeasonId,
    'playing-conditions',
  ]

  const playingConditionsQuery = useQuery({
    queryKey: playingConditionsQueryKey,
    queryFn: () => getPlayingConditions(clubId as string, leagueId as string, selectedSeasonId),
    enabled: Boolean(clubId) && Boolean(leagueId) && Boolean(selectedSeasonId) && isEdit,
  })

  // Starts the Season pill on ?seasonId= (carried by the league page's Edit link) when it names one of the club's seasons,
  // else on whichever season contains today, else the most recently created, same rule as TeamFormPage's Squad tab.
  useEffect(() => {
    if (!selectedSeasonId && seasonsQuery.data && seasonsQuery.data.length > 0) {
      const requested = seasonParam && seasonsQuery.data.some((season) => season.id === seasonParam) ? seasonParam : null
      const defaultId = requested ?? pickDefaultSeasonId(seasonsQuery.data)
      if (defaultId) {
        setSelectedSeasonId(defaultId)
      }
    }
  }, [seasonsQuery.data, selectedSeasonId, seasonParam])

  const seasons = useMemo(() => seasonsQuery.data ?? [], [seasonsQuery.data])

  const teamsById = useMemo(() => {
    const map = new Map<string, Team>()
    ;(teamsQuery.data ?? []).forEach((team) => map.set(team.id, team))
    return map
  }, [teamsQuery.data])

  const affiliationsForSeason = (affiliationsQuery.data ?? []).filter(
    (affiliation) => affiliation.seasonId === selectedSeasonId,
  )

  // docs/specs/051-league-schedule-sharing.md: same seasonLabel derivation as
  // the league Schedule view (LeagueScheduleView.tsx), neither host page previously computed a plain season label string.
  const seasonLabel = useMemo(
    () => seasonsQuery.data?.find((season) => season.id === selectedSeasonId)?.label ?? '',
    [seasonsQuery.data, selectedSeasonId],
  )

  // docs/specs/052-league-playing-conditions.md UI Requirements item 4, `maxOversPerInnings !=
  // null` is the "has this league+season's structured Playing Conditions ever been saved" signal;
  // shared by PlayingConditionsForm's own initialValues and the share dialog's
  // hasStructuredFields/conditions props below.
  const playingConditionsPayload = resolvePlayingConditionsPayload(playingConditionsQuery.data)

  const updatePlayingConditionsMutation = useMutation({
    mutationFn: (payload: PlayingConditionsPayload) =>
      updatePlayingConditions(clubId as string, leagueId as string, selectedSeasonId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: playingConditionsQueryKey }),
  })

  const affiliatedTeamIds = new Set(affiliationsForSeason.map((affiliation) => affiliation.teamId))
  const linkableTeams: Team[] = (teamsQuery.data ?? []).filter(
    (team) => team.active && !affiliatedTeamIds.has(team.id),
  )

  const invalidateAffiliations = () =>
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'leagues', leagueId, 'affiliations'] })

  const linkMutation = useMutation({
    mutationFn: (teamId: string) =>
      createLeagueAffiliation(clubId as string, leagueId as string, teamId, selectedSeasonId),
    onSuccess: () => {
      invalidateAffiliations()
      setLinkOpen(false)
    },
  })

  const saveMutation = useMutation({
    mutationFn: (payload: LeaguePayload) => {
      if (isEdit && leagueId) {
        return updateLeague(clubId as string, leagueId, payload)
      }
      return createLeague(clubId as string, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'leagues'] })
      navigate('/manage/fixtures/leagues')
    },
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md: relocated verbatim from LeagueList.tsx's own
  // LeagueCard, same mutation fn/onSuccess invalidation, now rendered in this screen's actions
  // bar instead of the list card's footer.
  const invalidateLeagues = () => queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'leagues'] })

  const deactivate = useMutation({
    mutationFn: () => deactivateLeague(clubId as string, leagueId as string),
    onSuccess: invalidateLeagues,
  })

  const reactivate = useMutation({
    mutationFn: () => reactivateLeague(clubId as string, leagueId as string),
    onSuccess: invalidateLeagues,
  })

  const toggle = league?.active ? deactivate : reactivate

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isEdit && isLoading) {
    return null
  }

  if (isEdit && (isError || !league)) {
    return (
      <EmptyState
        title="Couldn't load this league"
        description="Something went wrong loading this league. Please try again."
      />
    )
  }

  return (
    <>
      <RecordFormScreen
        title={isEdit ? 'Edit League' : 'Add League'}
        backTo="/manage/fixtures/leagues"
        backLabel="Back to Leagues"
        tabs={
          isEdit ? (
            <Stack spacing={1.5}>
              {notice && (
                <Alert severity="success" onClose={() => setNotice(null)}>
                  {notice}
                </Alert>
              )}
              <LeagueEditTabs />
            </Stack>
          ) : undefined
        }
        headerAction={
          isEdit && SEASON_TABS.includes(activeTab) && seasons.length > 0 ? (
            <HeaderSeasonSelect
              seasons={seasons.map((season) => ({ id: season.id, name: season.label }))}
              value={selectedSeasonId}
              showAll={false}
              onChange={(seasonId) => {
                if (seasonId) {
                  setSelectedSeasonId(seasonId)
                }
              }}
            />
          ) : undefined
        }
        actions={
          activeTab === 'details' ? (
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              {saveMutation.isError && (
                <Typography variant="body2" color="error.main">
                  {errorDetail(saveMutation.error, 'Something went wrong saving this league. Please try again.')}
                </Typography>
              )}

              {/* docs/specs/091 (D): Cancel goes back to the league (edit) or the list (add), without saving. */}
              <MuiButton component={RouterLink} to={isEdit && league ? `/manage/fixtures/leagues/${league.id}/schedule` : '/manage/fixtures/leagues'} variant="outlined" size="small" sx={compactButtonSx}>
                Cancel
              </MuiButton>

              <Button size="compact" type="submit" form={LEAGUE_FORM_ID} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create league'}
              </Button>

              {/* docs/specs/096: Duplicate league sits beside the status toggle, edit mode only. */}
              {isEdit && league && (
                <Button
                  size="compact"
                  variant="secondary"
                  startIcon={<ContentCopyOutlinedIcon fontSize="small" />}
                  onClick={() => setDuplicateOpen(true)}
                >
                  Duplicate league
                </Button>
              )}

              {/* docs/specs/095: Deactivate / Reactivate lives with Details only. */}
              {isEdit && league && (
                <RecordStatusToggle active={league.active} pending={toggle.isPending} onClick={() => toggle.mutate()} />
              )}
            </Stack>
          ) : undefined
        }
      >
        {/* docs/specs/110: the date ages are judged on this season, from the server. Sits above the form it describes. */}
        {isEdit && activeTab === 'details' && league && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            <LeagueAgeReferenceLine
              clubId={clubId}
              leagueId={league.id}
              seasonId={selectedSeasonId}
              hasAgeLimit={league.minAge != null || league.maxAge != null}
            />
          </Box>
        )}

        {/* docs/specs/111: Details has no header pill, so the block carries its own Season select, sharing the page's selected season. */}
        {isEdit && activeTab === 'details' && seasons.length > 0 && selectedSeasonId && (
          <LeagueSeasonDatesBlock
            clubId={clubId}
            leagueId={leagueId as string}
            seasonId={selectedSeasonId}
            seasonLabel={seasonLabel}
            seasons={seasons}
            onSeasonChange={setSelectedSeasonId}
          />
        )}

        {activeTab === 'details' && (
          <LeagueForm
            initialValues={
              league
                ? {
                    name: league.name,
                    maxPlayingXiSize: league.maxPlayingXiSize,
                    minAge: league.minAge,
                    maxAge: league.maxAge,
                    ageCutoffMonth: league.ageCutoffMonth,
                    ageCutoffDay: league.ageCutoffDay,
                    format: league.format,
                    logoUrl: league.logoUrl,
                    phone: league.phone,
                    website: league.website,
                    email: league.email,
                    socialLinks: league.socialLinks,
                  }
                : undefined
            }
            onSubmit={(payload) => saveMutation.mutate(payload)}
          />
        )}

        {/* docs/specs/111: when the league runs in the chosen season, above the season-scoped tabs (the header pill picks the season). */}
        {isEdit && SEASON_TABS.includes(activeTab) && seasons.length > 0 && selectedSeasonId && (
          <LeagueSeasonDatesBlock
            clubId={clubId}
            leagueId={leagueId as string}
            seasonId={selectedSeasonId}
            seasonLabel={seasonLabel}
          />
        )}

        {isEdit && activeTab === 'teams' && (
          <LeagueEditTeamsTab
            clubId={clubId}
            leagueId={leagueId as string}
            hasSeasons={seasons.length > 0}
            selectedSeasonId={selectedSeasonId}
            seasonLabel={seasonLabel}
            contextLabel={`${league?.name ?? ''} · ${seasonLabel}`}
            affiliationsForSeason={affiliationsForSeason}
            teamsById={teamsById}
            onAddTeam={() => setLinkOpen(true)}
            onUnlinked={invalidateAffiliations}
          />
        )}

        {isEdit && activeTab === 'schedule' && (
          <LeagueEditScheduleTab
            leagueId={leagueId as string}
            hasSeasons={seasons.length > 0}
            selectedSeasonId={selectedSeasonId}
            seasonLabel={seasonLabel}
            matches={matchesQuery.data ?? []}
            matchesLoading={matchesQuery.isLoading}
            teamsById={teamsById}
            onShare={() => setSharePreselected(['SCHEDULE'])}
          />
        )}

        {isEdit && activeTab === 'conditions' && (
          <LeagueEditConditionsTab
            hasSeasons={seasons.length > 0}
            selectedSeasonId={selectedSeasonId}
            seasonLabel={seasonLabel}
            document={
              playingConditionsQuery.data?.documentUrl
                ? {
                    documentUrl: playingConditionsQuery.data.documentUrl,
                    uploadedAt: playingConditionsQuery.data.uploadedAt as string,
                  }
                : null
            }
            onUpload={(file) =>
              uploadPlayingConditions(clubId as string, leagueId as string, selectedSeasonId, file).then(
                (response) => response.documentUrl,
              )
            }
            onUploaded={() => queryClient.invalidateQueries({ queryKey: playingConditionsQueryKey })}
            initialValues={playingConditionsPayload}
            onSubmit={(payload) => updatePlayingConditionsMutation.mutate(payload)}
            pending={updatePlayingConditionsMutation.isPending}
            error={updatePlayingConditionsMutation.isError ? updatePlayingConditionsMutation.error : undefined}
            onShare={() => setSharePreselected(['CONDITIONS'])}
          />
        )}

        {isEdit && activeTab === 'contacts' && (
          <LeagueEditContactsTab leagueId={leagueId as string} contacts={contactsQuery.data ?? []} />
        )}
      </RecordFormScreen>

      {isEdit && (
        <LinkExistingRecordDialog<Team>
          open={linkOpen}
          onClose={() => setLinkOpen(false)}
          title="Affiliate a team for this season"
          candidates={linkableTeams}
          loading={teamsQuery.isFetching}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          searchLabel="Search teams"
          searchPlaceholder="Search by name"
          onLink={(option) => linkMutation.mutate(option.id)}
        />
      )}

      {isEdit && league && sharePreselected && (
        <ShareLeagueDialog
          open
          onClose={() => setSharePreselected(null)}
          clubId={clubId as string}
          league={league}
          seasonId={selectedSeasonId || null}
          preselected={sharePreselected}
        />
      )}

      {isEdit && league && duplicateOpen && (
        <DuplicateLeagueDialog
          open
          clubId={clubId}
          league={{ id: league.id, name: league.name }}
          seasons={seasons}
          defaultSeasonId={selectedSeasonId}
          onClose={() => setDuplicateOpen(false)}
        />
      )}
    </>
  )
}
