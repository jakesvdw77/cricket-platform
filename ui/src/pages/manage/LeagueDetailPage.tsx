import { useEffect, useMemo, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box, MenuItem, Stack, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined'
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { RecordDetailScreen, DetailFieldRow, DetailFieldGrid } from '../../components/RecordDetailScreen'
import { RecordCard } from '../../components/RecordCard'
import { EmptyState } from '../../components/EmptyState'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { LeagueFixtures } from '../../components/LeagueFixtures'
import { NextMatchCountdown } from '../../components/NextMatchCountdown'
import { ShareScheduleDialog } from '../../components/ShareScheduleDialog'
import type { ShareScheduleTeamOption } from '../../components/ShareScheduleDialog'
import { listLeagues } from '../../api/leagueApi'
import { listSeasons } from '../../api/seasonApi'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { listLeagueAffiliations } from '../../api/leagueAffiliationApi'
import { listMatches } from '../../api/matchApi'
import { getPlayingConditions } from '../../api/leaguePlayingConditionsApi'
import { pickDefaultSeasonId } from '../../utils/defaultSeason'
import { initialsFromName } from '../../utils/initials'
import { resolveNextMatchCountdown } from '../../utils/nextMatchCountdown'
import { generateLeagueSchedulePdf } from '../../utils/leagueSchedulePdf'
import { generateLeagueSchedulePoster } from '../../utils/leagueSchedulePoster'
import { generateLeagueScheduleIcs } from '../../utils/leagueScheduleIcs'
import { triggerDownload } from '../../utils/triggerDownload'
import { badgeFor } from './LeagueList'

// docs/specs/036-view-first-record-detail-screens.md: the read-only counterpart to
// LeagueFormPage.tsx — same data-fetch shape (list + find-by-id), same badgeFor mapping (imported
// from LeagueList.tsx, not duplicated). LeagueFormPage's Details/Affiliations tabs collapse into 2
// stacked sections; Affiliations keeps its season Select as a plain, non-edit filtering control
// and renders each affiliated Team as a read-only RecordCard with viewTo into TeamDetailPage (not
// the unaffiliate/link editing UI, which stays on LeagueFormPage's own tab).
export default function LeagueDetailPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { leagueId } = useParams<{ leagueId?: string }>()
  const theme = useTheme()
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [shareOpen, setShareOpen] = useState(false)

  const {
    data: league,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'leagues'],
    queryFn: () => listLeagues(clubId as string),
    enabled: Boolean(clubId),
    select: (leagues) => leagues.find((candidate) => candidate.id === leagueId),
  })

  const seasonsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId),
  })

  const teamsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId as string),
    enabled: Boolean(clubId),
  })

  const affiliationsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'affiliations'],
    queryFn: () => listLeagueAffiliations(clubId as string, leagueId as string),
    enabled: Boolean(clubId) && Boolean(leagueId),
  })

  // docs/specs/050-league-schedule-and-fixtures.md: the Fixtures section's own season-scoped match
  // list, rendered via the reusable LeagueFixtures component — reuses the existing
  // listMatches(leagueId, seasonId) filter combination, no new endpoint.
  const matchesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'matches', selectedSeasonId],
    queryFn: () => listMatches(clubId as string, { page: 0, leagueId: leagueId as string, seasonId: selectedSeasonId }),
    enabled: Boolean(clubId) && Boolean(leagueId) && Boolean(selectedSeasonId),
  })

  // docs/specs/050-league-schedule-and-fixtures.md: the selected season's own Playing Conditions
  // document, surfaced as a link in the page's shared season-picker row — mirrors LeagueList.tsx's
  // own card action, just season-scoped to whichever season is currently selected here rather than
  // only ever the club's "current" season.
  const playingConditionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues', leagueId, 'playing-conditions', selectedSeasonId],
    queryFn: () => getPlayingConditions(clubId as string, leagueId as string, selectedSeasonId),
    enabled: Boolean(clubId) && Boolean(leagueId) && Boolean(selectedSeasonId),
  })

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

  // docs/specs/051-league-schedule-sharing.md: neither host page previously computed a plain
  // season label string — only selectedSeasonId was held in state. Shared by the Share Schedule
  // dialog's caption and every generator's header/footer subtitle.
  const seasonLabel = useMemo(
    () => seasonsQuery.data?.find((season) => season.id === selectedSeasonId)?.label ?? '',
    [seasonsQuery.data, selectedSeasonId],
  )

  // Computed once per match-list change (e.g. a season switch triggers a refetch), never on a
  // timer — this widget is deliberately static, per the spec's own Non-goals.
  const nextMatchCountdown = useMemo(
    () => resolveNextMatchCountdown(matchesQuery.data?.content ?? [], new Date()),
    [matchesQuery.data],
  )

  const shareTeams: ShareScheduleTeamOption[] = affiliationsForSeason.map((affiliation) => ({
    teamId: affiliation.teamId,
    teamName: teamsById.get(affiliation.teamId)?.name ?? 'Unknown team',
  }))

  const handleSharePdf = async (teamFilter: ShareScheduleTeamOption | null) => {
    const url = await generateLeagueSchedulePdf(
      matchesQuery.data?.content ?? [],
      teamsById,
      league?.name ?? '',
      seasonLabel,
      teamFilter,
    )
    window.open(url, '_blank')
  }

  const handleSharePoster = async (teamFilter: ShareScheduleTeamOption | null) => {
    const url = await generateLeagueSchedulePoster(
      matchesQuery.data?.content ?? [],
      teamsById,
      league?.name ?? '',
      seasonLabel,
      teamFilter,
      theme.palette.primary.main,
    )
    triggerDownload(url, `${league?.name ?? 'schedule'}-poster.png`)
  }

  const handleShareCalendar = async (team: ShareScheduleTeamOption) => {
    const url = generateLeagueScheduleIcs(matchesQuery.data?.content ?? [], teamsById, league?.name ?? '', seasonLabel, team)
    triggerDownload(url, `${team.teamName}-schedule.ics`)
  }

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !league) {
    return (
      <EmptyState
        title="Couldn't load this league"
        description="Something went wrong loading this league. Please try again."
      />
    )
  }

  return (
    <>
      <RecordDetailScreen
        title={league.name}
        backTo="/manage/fixtures/leagues"
        backLabel="Back to Leagues"
        avatar={{ fallback: <EmojiEventsOutlinedIcon fontSize="small" />, shape: 'rounded' }}
        badge={badgeFor(league)}
        editTo={`/manage/fixtures/leagues/${league.id}/edit`}
        headerNote={
          (seasonsQuery.data ?? []).length > 0 ? (
            <Stack direction="row" spacing={2} alignItems="flex-end" flexWrap="wrap" useFlexGap>
              <Input
                select
                label="Season"
                value={selectedSeasonId}
                onChange={(event) => setSelectedSeasonId(event.target.value)}
                sx={{ maxWidth: 280 }}
              >
                {(seasonsQuery.data ?? []).map((season) => (
                  <MenuItem key={season.id} value={season.id}>
                    {season.label}
                  </MenuItem>
                ))}
              </Input>

              {playingConditionsQuery.data && (
                <Button
                  variant="ghost"
                  size="sm"
                  startIcon={<DescriptionOutlinedIcon fontSize="small" />}
                  onClick={() => window.open(playingConditionsQuery.data!.documentUrl, '_blank')}
                >
                  Playing Conditions
                </Button>
              )}
            </Stack>
          ) : undefined
        }
        sections={[
          {
            heading: 'Details',
            content: (
              <DetailFieldGrid>
                <DetailFieldRow
                  icon={<GroupsOutlinedIcon />}
                  label="Playing XI size"
                  value={league.maxPlayingXiSize}
                />
                {(league.minAge != null || league.maxAge != null) && (
                  <DetailFieldRow
                    icon={<CakeOutlinedIcon />}
                    label="Age range"
                    value={`${league.minAge ?? 'Any'}–${league.maxAge ?? 'Any'}`}
                  />
                )}
                <DetailFieldRow
                  icon={<SwapHorizOutlinedIcon />}
                  label="Substitutions allowed"
                  value={league.allowSubstitutions ? 'Yes' : 'No'}
                />
              </DetailFieldGrid>
            ),
          },
          {
            heading: 'Teams',
            content:
              (seasonsQuery.data ?? []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No seasons yet — teams are affiliated to a league for a specific season.
                </Typography>
              ) : affiliationsForSeason.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No teams affiliated for this season yet.
                </Typography>
              ) : (
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
                  {affiliationsForSeason.map((affiliation) => {
                    const team = teamsById.get(affiliation.teamId)
                    if (!team) {
                      return null
                    }
                    return (
                      <RecordCard
                        key={affiliation.id}
                        title={team.name}
                        avatar={{ imageUrl: team.logoUrl, fallback: initialsFromName(team.name), shape: 'rounded' }}
                        viewTo={`/manage/sections/${team.sectionId}/teams/${team.id}`}
                        editTo={`/manage/sections/${team.sectionId}/teams/${team.id}/edit`}
                      />
                    )
                  })}
                </Box>
              ),
          },
          {
            heading: 'Fixtures',
            note: (
              <Button
                variant="ghost"
                size="sm"
                startIcon={<ShareOutlinedIcon fontSize="small" />}
                onClick={() => setShareOpen(true)}
              >
                Share
              </Button>
            ),
            content:
              (seasonsQuery.data ?? []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No seasons yet — matches are scheduled for a league and a specific season.
                </Typography>
              ) : (
                <Stack spacing={3}>
                  <NextMatchCountdown countdown={nextMatchCountdown} teamsById={teamsById} />
                  <LeagueFixtures matches={matchesQuery.data?.content ?? []} teamsById={teamsById} />
                </Stack>
              ),
          },
        ]}
      />

      <ShareScheduleDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        leagueName={league.name}
        seasonLabel={seasonLabel}
        teams={shareTeams}
        onSharePdf={handleSharePdf}
        onSharePoster={handleSharePoster}
        onShareCalendar={handleShareCalendar}
      />
    </>
  )
}
