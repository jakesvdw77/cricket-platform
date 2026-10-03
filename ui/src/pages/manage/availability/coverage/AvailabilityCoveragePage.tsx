import { useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, CircularProgress, FormControlLabel, MenuItem, Switch, Typography } from '@mui/material'
import { Button } from '../../../../components/Button'
import { EmptyState } from '../../../../components/EmptyState'
import { Input } from '../../../../components/Input'
import { SectionTreeSelect } from '../../../../components/SectionTreeSelect'
import { listPlayerAvailability } from '../../../../api/playerAvailabilityApi'
import { listSeasons } from '../../../../api/seasonApi'
import { listLeagues } from '../../../../api/leagueApi'
import { listSections } from '../../../../api/sectionApi'
import { listTeamsForClub } from '../../../../api/teamApi'
import { usePersistedListFilters } from '../../../../hooks/usePersistedListFilters'
import { cardGridSx } from '../../../../utils/cardGrid'
import { pickDefaultSeasonId } from '../../../../utils/defaultSeason'
import { filterPanelSx } from '../../../../utils/filterPanel'
import { CoverageLegend } from './CoverageLegend'
import { SlotCoverageCard } from './SlotCoverageCard'
import { computeSlotCoverage } from './slotCoverage'

// docs/specs/074-availability-coverage.md: the Coverage view of the Availability hub. One card per
// time slot, computed in the browser from the Players grid response plus the leagues' playing XI
// sizes. Season, Section and League are real server-side filters and persist per club under their
// own key (not the Players view's); Show past slots does not persist.
export default function AvailabilityCoveragePage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()

  const [includePast, setIncludePast] = useState(false)
  const [filters, setFilters] = usePersistedListFilters(`availabilityCoverage:filters:${clubId}`, {
    seasonId: null as string | null,
    leagueId: null as string | null,
    sectionId: null as string | null,
  })
  const { leagueId, sectionId } = filters

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
  const sectionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId as string),
    enabled: Boolean(clubId),
  })
  const teamsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId as string),
    enabled: Boolean(clubId),
  })

  const seasons = useMemo(() => seasonsQuery.data ?? [], [seasonsQuery.data])

  // The Players page's rule: the stored choice wins while it is still one of the club's seasons,
  // else the default; derived, never written back.
  const seasonId = useMemo(() => {
    if (filters.seasonId && seasons.some((season) => season.id === filters.seasonId)) {
      return filters.seasonId
    }
    return pickDefaultSeasonId(seasons)
  }, [filters.seasonId, seasons])

  // Held until the seasons have loaded so the one request carries the derived season default.
  const filtersReady = Boolean(clubId) && !seasonsQuery.isLoading

  const gridQuery = useQuery({
    // The Players page's key shape with teamId null, so both views share one cache entry per filter set.
    queryKey: ['managed-club', clubId, 'player-availability', { seasonId, leagueId, sectionId, teamId: null, includePast }],
    queryFn: () =>
      listPlayerAvailability(clubId as string, {
        seasonId,
        leagueId: leagueId ?? undefined,
        sectionId: sectionId ?? undefined,
        includePast,
      }),
    enabled: filtersReady,
  })

  const xiSizeByLeagueId = useMemo(() => {
    const map = new Map<string, number>()
    for (const league of leaguesQuery.data ?? []) {
      if (typeof league.maxPlayingXiSize === 'number') map.set(league.id, league.maxPlayingXiSize)
    }
    return map
  }, [leaguesQuery.data])

  const slots = useMemo(
    () =>
      gridQuery.data
        ? computeSlotCoverage({ games: gridQuery.data.games, players: gridQuery.data.players, xiSizeByLeagueId })
        : [],
    [gridQuery.data, xiSizeByLeagueId],
  )
  const playersById = useMemo(
    () => new Map((gridQuery.data?.players ?? []).map((player) => [player.playerProfileId, player])),
    [gridQuery.data],
  )
  const teamNames = useMemo(() => new Map((teamsQuery.data ?? []).map((team) => [team.id, team.name])), [teamsQuery.data])
  const teamName = (teamId: string) => teamNames.get(teamId) ?? 'Unknown team'

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  // Cards render only once the leagues (XI sizes) and teams (names) are in, so a slot never flashes
  // "No XI size" / "Unknown team", and a failed leagues or teams load is an error, not a wrong verdict.
  const loadError = gridQuery.isError || leaguesQuery.isError || teamsQuery.isError
  const metaLoading = leaguesQuery.isLoading || teamsQuery.isLoading
  const ready = Boolean(gridQuery.data) && !metaLoading && !loadError
  const loading = !loadError && (!gridQuery.data || metaLoading)
  const anyPoll = slots.some((slot) => slot.teams.some((team) => team.hasPoll))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={filterPanelSx}>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Input
              select
              label="Season"
              value={seasonId ?? ''}
              onChange={(event) => setFilters({ seasonId: event.target.value || null })}
            >
              {seasons.map((season) => (
                <MenuItem key={season.id} value={season.id}>
                  {season.label}
                </MenuItem>
              ))}
            </Input>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <SectionTreeSelect
              label="Section"
              sections={sectionsQuery.data ?? []}
              value={sectionId}
              onChange={(value) => setFilters({ sectionId: value })}
              allowClear
            />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Input
              select
              label="League"
              value={leagueId ?? ''}
              onChange={(event) => setFilters({ leagueId: event.target.value || null })}
            >
              <MenuItem value="">All leagues</MenuItem>
              {(leaguesQuery.data ?? []).map((league) => (
                <MenuItem key={league.id} value={league.id}>
                  {league.name}
                </MenuItem>
              ))}
            </Input>
          </Box>
        </Box>
        <FormControlLabel
          control={<Switch checked={includePast} onChange={(event) => setIncludePast(event.target.checked)} />}
          label="Show past slots"
          sx={{ mr: 0, alignSelf: 'flex-start' }}
        />
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress aria-label="Loading coverage" />
        </Box>
      )}

      {loadError && (
        <EmptyState
          title="Couldn't load availability coverage"
          description="Something went wrong loading availability. Please try again."
        />
      )}

      {ready && gridQuery.data?.truncated && (
        <Alert severity="info">
          Showing the first {gridQuery.data.games.length} games and {gridQuery.data.players.length} players, so some slots
          or counts may be incomplete. Narrow the filters (season, league or section) to see the rest.
        </Alert>
      )}

      {ready && slots.length === 0 && (
        <EmptyState
          title="No games to cover"
          description="No games match the current filters. Try another season, section or league, or show past slots."
        />
      )}

      {ready && slots.length > 0 && !anyPoll && (
        <EmptyState
          title="No polls yet"
          description="Open a poll for these games to see how many players you have."
          action={<Button onClick={() => navigate('/manage/availability')}>Go to Polls</Button>}
        />
      )}

      {ready && slots.length > 0 && anyPoll && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            {slots.length} {slots.length === 1 ? 'slot' : 'slots'}
          </Typography>
          <Box sx={cardGridSx}>
            {slots.map((slot) => (
              <SlotCoverageCard key={slot.key} slot={slot} teamName={teamName} playersById={playersById} />
            ))}
          </Box>
          <CoverageLegend />
        </Box>
      )}
    </Box>
  )
}
