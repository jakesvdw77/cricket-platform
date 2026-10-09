import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, CircularProgress, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { CompactSwitch } from '../../components/CompactSwitch'
import { ContentControlsLine } from '../../components/ContentControlsLine'
import { EmptyState } from '../../components/EmptyState'
import { listPlayerAvailability } from '../../api/playerAvailabilityApi'
import { SlotNavigator } from './playerAvailability/SlotNavigator'
import { AvailabilityGrid } from './playerAvailability/AvailabilityGrid'
import { useChangeAnswer } from './playerAvailability/useChangeAnswer'
import { PlayersPhoneLists } from './playerAvailability/PlayersPhoneLists'
import type { AvailabilityGridHandle } from './playerAvailability/AvailabilityGrid'
import { filterPlayers, firstUpcomingGame } from './playerAvailability/gridHelpers'
import { AvailabilityFilterBar } from './availability/AvailabilityFilterBar'
import { useAvailabilityHub } from './availability/hubContext'

// docs/specs/068-player-availability-grid.md: a season of availability at a glance. docs/specs/083:
// League, Section and Team are the hub's shared filters (saved per club and mirrored in the address),
// shown in the shared FilterBar with search; the season is always the default one (no season control), also
// from the hub. Search, Show past games and Hide players with no answers are a per-visit view choice
// (not persisted), the two toggles on the line above the grid (in the Filters sheet on a phone). There is
// no "All seasons" option: the grid is one season's games by design (the spec bounds it to one season
// and one section), and a multi-season grid would hit the server's hard cap for nothing.
export default function PlayerAvailabilityPage() {
  const { clubId, filters, seasonId, seasonsLoading, teams, teamsLoading, teamsError, validTeamId: teamId, scopeText, setJumpToToday } =
    useAvailabilityHub()
  const gridRef = useRef<AvailabilityGridHandle>(null)
  const [scrollBox, setScrollBox] = useState<HTMLElement | null>(null)
  const theme = useTheme()
  // Same idiom as FilterBar and ContentControlsLine: the phone has no Jump to today in the header.
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })

  const { handlers: changeAnswer, error: changeError } = useChangeAnswer(clubId)

  const [search, setSearch] = useState('')
  const [includePast, setIncludePast] = useState(false)
  const [hideUnanswered, setHideUnanswered] = useState(false)
  const { leagueId, sectionId } = filters

  // Held until the seasons and the team list have finished their first load (and not at all if the team list
  // failed), so the request carries the derived season default and a validated team.
  const filtersReady = Boolean(clubId) && !seasonsLoading && !teamsLoading && !teamsError

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

  const upcoming = firstUpcomingGame(games, new Date())
  // The grid is replaced by an empty state when there are no games or none has a poll yet.
  const showsGrid = games.some((game) => game.pollType !== null)
  const loading = !gridQuery.data && !gridQuery.isError && !teamsError

  // docs/specs/085 (D2): Jump to today lives in the hub header, not on this page: this view registers it with the hub
  // (shown only where the grid is shown) and takes it away again when it goes.
  const upcomingMatchId = upcoming?.matchId
  const showJump = Boolean(showsGrid && gridQuery.data && !isPhone)
  useEffect(() => {
    setJumpToToday(
      showJump ? { disabled: !upcomingMatchId, onClick: () => upcomingMatchId && gridRef.current?.scrollToGame(upcomingMatchId) } : null,
    )
    return () => setJumpToToday(null)
  }, [showJump, upcomingMatchId, setJumpToToday])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  const toggles = (
    <>
      <CompactSwitch checked={includePast} onChange={setIncludePast} label="Show past games" />
      <CompactSwitch checked={hideUnanswered} onChange={setHideUnanswered} label="Hide players with no answers" />
    </>
  )

  const scopeFilters = scopeText({ withTeam: true })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <AvailabilityFilterBar
        show={{ league: true, section: true, team: true }}
        teams={teams}
        teamId={teamId}
        teamAllLabel={sectionId ? 'All teams in section' : 'All teams'}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search players"
        viewControls={toggles}
      />

      <ContentControlsLine
        scope={!showsGrid ? '' : `Showing ${visiblePlayers.length} ${visiblePlayers.length === 1 ? 'player' : 'players'} · ${games.length} ${games.length === 1 ? 'game' : 'games'}${scopeFilters ? ` · ${scopeFilters}` : ''}`}
        controls={toggles}
        pinned={!isPhone ? <SlotNavigator scrollBox={scrollBox} /> : undefined}
      />

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress aria-label="Loading player availability" />
        </Box>
      )}

      {(gridQuery.isError || teamsError) && (
        <EmptyState
          title="Couldn't load player availability"
          description="Something went wrong loading the grid. Please try again."
        />
      )}

      {gridQuery.data?.truncated && (
        <Alert severity="info">
          Showing the first {games.length} games and {gridQuery.data.players.length} players. Narrow the filters (league,
          section or team) to see the rest.
        </Alert>
      )}

      {changeError && (
        <Typography variant="body2" color="error.main" role="alert">
          {changeError}
        </Typography>
      )}

      {gridQuery.data && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* docs/specs/085 (E): below the tablet breakpoint the grid gives way to two vertical lists. */}
          {isPhone ? (
            <PlayersPhoneLists games={games} players={visiblePlayers} changeAnswer={changeAnswer} />
          ) : (
            <AvailabilityGrid ref={gridRef} onScrollBox={setScrollBox} games={games} players={visiblePlayers} changeAnswer={changeAnswer} />
          )}
        </Box>
      )}
    </Box>
  )
}
