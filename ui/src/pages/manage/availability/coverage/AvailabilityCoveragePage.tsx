import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, CircularProgress, FormControlLabel, Switch } from '@mui/material'
import { Button } from '../../../../components/Button'
import { ContentControlsLine } from '../../../../components/ContentControlsLine'
import { EmptyState } from '../../../../components/EmptyState'
import { listPlayerAvailability } from '../../../../api/playerAvailabilityApi'
import { listTeamsForClub } from '../../../../api/teamApi'
import { cardGridSx } from '../../../../utils/cardGrid'
import { AvailabilityFilterBar } from '../AvailabilityFilterBar'
import { useAvailabilityHub } from '../hubContext'
import { CoverageLegend } from './CoverageLegend'
import { SlotCoverageCard } from './SlotCoverageCard'
import { computeSlotCoverage } from './slotCoverage'

// docs/specs/074-availability-coverage.md: the Coverage view of the Availability hub. One card per
// time slot, computed in the browser from the Players grid response plus the leagues' playing XI
// sizes. docs/specs/083: League and Section are the hub's shared filters (the same ones the Polls and
// Players views use, in the shared FilterBar; there is no Team here) and the season is always the default one; Show past slots is a per-visit toggle on the line above the cards, not persisted.
export default function AvailabilityCoveragePage() {
  const { clubId, filters, seasonId, seasonsLoading, leagues, leaguesLoading, leaguesError, scopeText } = useAvailabilityHub()
  const navigate = useNavigate()

  const [includePast, setIncludePast] = useState(false)
  const { leagueId, sectionId } = filters

  const teamsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId as string),
    enabled: Boolean(clubId),
  })

  // Held until the seasons have loaded so the one request carries the derived season default.
  const filtersReady = Boolean(clubId) && !seasonsLoading

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
    for (const league of leagues) {
      if (typeof league.maxPlayingXiSize === 'number') map.set(league.id, league.maxPlayingXiSize)
    }
    return map
  }, [leagues])

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
  const loadError = gridQuery.isError || leaguesError || teamsQuery.isError
  const metaLoading = leaguesLoading || teamsQuery.isLoading
  const ready = Boolean(gridQuery.data) && !metaLoading && !loadError
  const loading = !loadError && (!gridQuery.data || metaLoading)
  const anyPoll = slots.some((slot) => slot.teams.some((team) => team.hasPoll))

  const pastToggle = (
    <FormControlLabel
      control={<Switch checked={includePast} onChange={(event) => setIncludePast(event.target.checked)} />}
      label="Show past slots"
      sx={{ mr: 0, whiteSpace: 'nowrap' }}
    />
  )
  const scopeFilters = scopeText()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <AvailabilityFilterBar show={{ league: true, section: true }} viewControls={pastToggle} />

      <ContentControlsLine
        scope={`Showing ${ready ? slots.length : 0} ${ready && slots.length === 1 ? 'slot' : 'slots'}${scopeFilters ? ` · ${scopeFilters}` : ''}`}
        controls={pastToggle}
      />

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
          or counts may be incomplete. Narrow the filters (league or section) to see the rest.
        </Alert>
      )}

      {ready && slots.length === 0 && (
        <EmptyState
          title="No games to cover"
          description="No games match the current filters. Try another section or league, or show past slots."
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
