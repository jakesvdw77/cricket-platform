import { useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, Button as MuiButton, CircularProgress, FormControlLabel, InputAdornment, MenuItem, Switch, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined'
import FilterListIcon from '@mui/icons-material/FilterList'
import SearchIcon from '@mui/icons-material/Search'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Input } from '../../components/Input'
import { SectionTreeSelect } from '../../components/SectionTreeSelect'
import { listPlayerAvailability } from '../../api/playerAvailabilityApi'
import { listSeasons } from '../../api/seasonApi'
import { listLeagues } from '../../api/leagueApi'
import { listSections } from '../../api/sectionApi'
import { listTeamsForClub } from '../../api/teamApi'
import { usePersistedListFilters } from '../../hooks/usePersistedListFilters'
import { pickDefaultSeasonId } from '../../utils/defaultSeason'
import { filterPanelSx } from '../../utils/filterPanel'
import { AvailabilityGrid } from './playerAvailability/AvailabilityGrid'
import type { AvailabilityGridHandle } from './playerAvailability/AvailabilityGrid'
import { filterPlayers, firstUpcomingGame } from './playerAvailability/gridHelpers'

const FILTERS_REGION_ID = 'player-availability-more-filters'

// docs/specs/068-player-availability-grid.md: a season of availability at a glance. Season,
// League, Section and Team are real server-side filters and persist per club
// (usePersistedListFilters, docs/specs/043); search, Show past games and Hide players with no
// answers do not (a per-visit view choice), exactly as MatchList's switch behaves. There is no
// "All seasons" option: the grid is one season's games by design (the spec bounds it to one season
// and one section), and a multi-season grid would hit the server's hard cap for nothing.
export default function PlayerAvailabilityPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const theme = useTheme()
  const isSmUp = useMediaQuery(theme.breakpoints.up('sm'))
  const gridRef = useRef<AvailabilityGridHandle>(null)

  const [search, setSearch] = useState('')
  const [includePast, setIncludePast] = useState(false)
  const [hideUnanswered, setHideUnanswered] = useState(false)
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  const [filters, setFilters] = usePersistedListFilters(`playerAvailability:filters:${clubId}`, {
    seasonId: null as string | null,
    leagueId: null as string | null,
    sectionId: null as string | null,
    teamId: null as string | null,
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
    queryKey: ['managed-club', clubId, 'teams', { sectionId }],
    queryFn: () => listTeamsForClub(clubId as string, { sectionId: sectionId ?? undefined }),
    enabled: Boolean(clubId),
  })

  const seasons = useMemo(() => seasonsQuery.data ?? [], [seasonsQuery.data])
  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data])

  // The stored choice wins; a missing one (or one for a season that no longer exists) falls back to
  // the default, derived rather than written back, so a stored selection is never overwritten.
  const seasonId = useMemo(() => {
    if (filters.seasonId && seasons.some((season) => season.id === filters.seasonId)) {
      return filters.seasonId
    }
    return pickDefaultSeasonId(seasons)
  }, [filters.seasonId, seasons])
  // Likewise a stored team that is not in the chosen section's teams is treated as "all teams".
  const teamId = filters.teamId && teams.some((team) => team.id === filters.teamId) ? filters.teamId : null

  // Held until the seasons and the team list have finished their first load, so the request
  // carries the derived season default and a validated team. It does NOT wait for the persisted
  // filters: usePersistedListFilters applies them in an effect right after the first render, which
  // always lands before the seasons request resolves, so a stored choice is in place by then.
  const filtersReady = Boolean(clubId) && !seasonsQuery.isLoading && !teamsQuery.isLoading

  const gridQuery = useQuery({
    queryKey: ['managed-club', clubId, 'player-availability', { seasonId, leagueId, sectionId, teamId, includePast }],
    queryFn: () =>
      listPlayerAvailability(clubId as string, {
        seasonId,
        leagueId: leagueId ?? undefined,
        sectionId: sectionId ?? undefined,
        teamId: teamId ?? undefined,
        includePast,
      }),
    enabled: filtersReady,
  })

  const games = useMemo(() => gridQuery.data?.games ?? [], [gridQuery.data])
  const visiblePlayers = useMemo(
    () => filterPlayers(gridQuery.data?.players ?? [], { search, hideUnanswered }),
    [gridQuery.data, search, hideUnanswered],
  )

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  const upcoming = firstUpcomingGame(games, new Date())
  // The grid is replaced by an empty state when there are no games or none has a poll yet.
  const showsGrid = games.some((game) => game.pollType !== null)
  const loading = !gridQuery.data && !gridQuery.isError
  const filtersOpen = isSmUp || moreFiltersOpen

  const seasonField = (
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
  )
  const leagueField = (
    <Input select label="League" value={leagueId ?? ''} onChange={(event) => setFilters({ leagueId: event.target.value || null })}>
      <MenuItem value="">All leagues</MenuItem>
      {(leaguesQuery.data ?? []).map((league) => (
        <MenuItem key={league.id} value={league.id}>
          {league.name}
        </MenuItem>
      ))}
    </Input>
  )
  const sectionField = (
    <SectionTreeSelect
      label="Section"
      sections={sectionsQuery.data ?? []}
      value={sectionId}
      // A team belongs to one section, so changing the section clears the team choice.
      onChange={(value) => setFilters({ sectionId: value, teamId: null })}
      allowClear
    />
  )
  const teamField = (
    <Input select label="Team" value={teamId ?? ''} onChange={(event) => setFilters({ teamId: event.target.value || null })}>
      <MenuItem value="">{sectionId ? 'All teams in section' : 'All teams'}</MenuItem>
      {teams.map((team) => (
        <MenuItem key={team.id} value={team.id}>
          {team.name}
        </MenuItem>
      ))}
    </Input>
  )

  const jumpButton = showsGrid && gridQuery.data && (
    <Button
      variant="secondary"
      size="sm"
      startIcon={<TodayOutlinedIcon fontSize="small" />}
      disabled={!upcoming}
      onClick={() => upcoming && gridRef.current?.scrollToGame(upcoming.matchId)}
      sx={{ whiteSpace: 'nowrap', flex: '0 0 auto' }}
    >
      Jump to today
    </Button>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Same bordered surface as ListToolbar, but two rows (it only supports a single search row):
          row 1 the four server-side filters in the order Season, Section, Team, League; row 2 search,
          the view toggles and Jump to today. */}
      <Box sx={filterPanelSx}>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          }}
        >
          <MuiButton
            variant="outlined"
            color="inherit"
            startIcon={<FilterListIcon fontSize="small" />}
            aria-expanded={moreFiltersOpen}
            aria-controls={FILTERS_REGION_ID}
            onClick={() => setMoreFiltersOpen((open) => !open)}
            sx={{ display: { xs: 'inline-flex', sm: 'none' }, justifySelf: 'start', color: 'text.primary', borderColor: 'divider' }}
          >
            Filters
          </MuiButton>
          {/* Season and Section collapse behind the Filters button on a phone; display: contents lets
              them take part in the parent grid when shown. */}
          <Box id={FILTERS_REGION_ID} sx={{ display: filtersOpen ? 'contents' : 'none' }}>
            <Box sx={{ minWidth: 0 }}>{seasonField}</Box>
            <Box sx={{ minWidth: 0 }}>{sectionField}</Box>
          </Box>
          <Box sx={{ minWidth: 0 }}>{teamField}</Box>
          <Box sx={{ minWidth: 0 }}>{leagueField}</Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2, rowGap: 1 }}>
          <Input
            label="Search"
            placeholder="Search players"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ flex: '1 1 240px', minWidth: 0 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2, flex: '0 1 auto' }}>
            <FormControlLabel
              control={<Switch checked={includePast} onChange={(event) => setIncludePast(event.target.checked)} />}
              label="Show past games"
              sx={{ whiteSpace: 'nowrap', mr: 0 }}
            />
            <FormControlLabel
              control={<Switch checked={hideUnanswered} onChange={(event) => setHideUnanswered(event.target.checked)} />}
              label="Hide players with no answers"
              sx={{ mr: 0 }}
            />
            {jumpButton}
          </Box>
        </Box>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress aria-label="Loading player availability" />
        </Box>
      )}

      {gridQuery.isError && (
        <EmptyState
          title="Couldn't load player availability"
          description="Something went wrong loading the grid. Please try again."
        />
      )}

      {gridQuery.data?.truncated && (
        <Alert severity="info">
          Showing the first {games.length} games and {gridQuery.data.players.length} players. Narrow the filters (season,
          league, section or team) to see the rest.
        </Alert>
      )}

      {gridQuery.data && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {showsGrid && (
            <Typography variant="body2" color="text.secondary">
              {visiblePlayers.length} {visiblePlayers.length === 1 ? 'player' : 'players'} · {games.length}{' '}
              {games.length === 1 ? 'game' : 'games'}
            </Typography>
          )}
          <AvailabilityGrid ref={gridRef} games={games} players={visiblePlayers} />
        </Box>
      )}
    </Box>
  )
}
