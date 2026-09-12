import { useEffect, useMemo, useState } from 'react'
import { Box, MenuItem, Stack, Tab, Tabs, Typography } from '@mui/material'
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LeagueForm, LEAGUE_FORM_ID } from '../../components/LeagueForm'
import { RecordFormScreen } from '../../components/RecordFormScreen'
import { RecordCard } from '../../components/RecordCard'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { EmptyState } from '../../components/EmptyState'
import { LinkExistingRecordDialog } from '../../components/LinkExistingRecordDialog'
import { listLeagues, createLeague, updateLeague } from '../../api/leagueApi'
import type { LeaguePayload } from '../../api/leagueApi'
import { listSeasons } from '../../api/seasonApi'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import {
  listLeagueAffiliations,
  createLeagueAffiliation,
  unaffiliateLeagueTeam,
} from '../../api/leagueAffiliationApi'
import type { LeagueAffiliation } from '../../api/leagueAffiliationApi'
import { pickDefaultSeasonId } from '../../utils/defaultSeason'
import { errorDetail } from '../../utils/errorDetail'
import { initialsFromName } from '../../utils/initials'

// One affiliated team, with its own unlink mutation — mirrors TeamFormPage's TeamSponsorCard
// isolation pattern, so one card's pending state never leaks onto another's.
function AffiliatedTeamCard({
  clubId,
  leagueId,
  affiliation,
  team,
  onUnlinked,
}: {
  clubId: string
  leagueId: string
  affiliation: LeagueAffiliation
  team: Team
  onUnlinked: () => void
}) {
  const unlink = useMutation({
    mutationFn: () => unaffiliateLeagueTeam(clubId, leagueId, affiliation.id),
    onSuccess: onUnlinked,
  })

  return (
    <RecordCard
      title={team.name}
      avatar={{ imageUrl: team.logoUrl, fallback: initialsFromName(team.name), shape: 'rounded' }}
      editLabel="Edit"
      editTo={`/manage/sections/${team.sectionId}/teams/${team.id}/edit`}
      secondaryAction={{
        label: 'Unaffiliate',
        pendingLabel: 'Removing…',
        pending: unlink.isPending,
        onClick: () => unlink.mutate(),
        icon: <LinkOffOutlinedIcon fontSize="small" />,
      }}
    />
  )
}

// docs/specs/029-league-management.md: the standard list/create/update CRUD anatomy, extended in
// edit mode (mirroring 027's TeamFormPage tab precedent) with an Affiliations tab — a Season
// picker plus a RecordCard grid of teams currently affiliated for that season.
export default function LeagueFormPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { leagueId } = useParams<{ leagueId?: string }>()
  const isEdit = Boolean(leagueId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState(0)
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)

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

  // Defaults the Season picker to whichever season contains today, else the most recently
  // created — same rule as TeamFormPage's Squad tab.
  useEffect(() => {
    if (!selectedSeasonId && seasonsQuery.data && seasonsQuery.data.length > 0) {
      const defaultId = pickDefaultSeasonId(seasonsQuery.data)
      if (defaultId) {
        setSelectedSeasonId(defaultId)
      }
    }
  }, [seasonsQuery.data, selectedSeasonId])

  const teamsById = useMemo(() => {
    const map = new Map<string, Team>()
    ;(teamsQuery.data ?? []).forEach((team) => map.set(team.id, team))
    return map
  }, [teamsQuery.data])

  const affiliationsForSeason = (affiliationsQuery.data ?? []).filter(
    (affiliation) => affiliation.seasonId === selectedSeasonId,
  )

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
        actions={
          activeTab === 0 ? (
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
              {saveMutation.isError && (
                <Typography variant="body2" color="error.main">
                  {errorDetail(saveMutation.error, 'Something went wrong saving this league. Please try again.')}
                </Typography>
              )}

              <Button type="submit" form={LEAGUE_FORM_ID} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create league'}
              </Button>
            </Stack>
          ) : null
        }
      >
        {isEdit && (
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
              <Tab label="Affiliations" />
            </Tabs>
          </Box>
        )}

        {activeTab === 0 && (
          <LeagueForm
            initialValues={
              league
                ? {
                    name: league.name,
                    maxPlayingXiSize: league.maxPlayingXiSize,
                    allowSubstitutions: league.allowSubstitutions,
                    minAge: league.minAge,
                    maxAge: league.maxAge,
                    ageCutoffDate: league.ageCutoffDate,
                  }
                : undefined
            }
            onSubmit={(payload) => saveMutation.mutate(payload)}
          />
        )}

        {isEdit && activeTab === 1 && (
          <Box sx={{ gridColumn: '1 / -1' }}>
            {(seasonsQuery.data ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Create a season first — teams are affiliated to a league for a specific season.
              </Typography>
            ) : (
              <>
                <Input
                  select
                  label="Season"
                  value={selectedSeasonId}
                  onChange={(event) => setSelectedSeasonId(event.target.value)}
                  sx={{ maxWidth: 280, mb: 2 }}
                >
                  {(seasonsQuery.data ?? []).map((season) => (
                    <MenuItem key={season.id} value={season.id}>
                      {season.label}
                    </MenuItem>
                  ))}
                </Input>

                {affiliationsForSeason.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    No teams affiliated for this season yet.
                  </Typography>
                )}

                {affiliationsForSeason.length > 0 && (
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 2,
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                      mb: 2,
                    }}
                  >
                    {affiliationsForSeason.map((affiliation) => {
                      const team = teamsById.get(affiliation.teamId)
                      if (!team) {
                        return null
                      }
                      return (
                        <AffiliatedTeamCard
                          key={affiliation.id}
                          clubId={clubId}
                          leagueId={leagueId as string}
                          affiliation={affiliation}
                          team={team}
                          onUnlinked={invalidateAffiliations}
                        />
                      )
                    })}
                  </Box>
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  startIcon={<GroupsOutlinedIcon fontSize="small" />}
                  onClick={() => setLinkOpen(true)}
                  disabled={!selectedSeasonId}
                >
                  Add team
                </Button>
              </>
            )}
          </Box>
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
    </>
  )
}
