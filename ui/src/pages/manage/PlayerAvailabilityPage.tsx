import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, CircularProgress, Link, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useUrlFlag } from '../../hooks/useUrlFlag'
import { ToolbarCard, ToolbarToggle } from '../../components/ToolbarCard'
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
// from the hub. Search, View entire season and Hide players with no answers are a per-visit view choice
// (not persisted), the two toggles on the line above the grid (in the Filters sheet on a phone). There is
// no "All seasons" option: the grid is one season's games by design (the spec bounds it to one season
// and one section), and a multi-season grid would hit the server's hard cap for nothing.
export default function PlayerAvailabilityPage() {
  const { clubId, filters, seasonId, seasonsLoading, teams, teamsLoading, teamsError, validTeamId: teamId } =
    useAvailabilityHub()
  const gridRef = useRef<AvailabilityGridHandle>(null)
  const [scrollBox, setScrollBox] = useState<HTMLElement | null>(null)
  const theme = useTheme()
  // Same idiom as FilterBar and ContentControlsLine: the phone has no Jump to today in the header.
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })

  const { handlers: changeAnswer, error: changeError } = useChangeAnswer(clubId)

  const [search, setSearch] = useState('')
  // In the address (docs/specs/136), so Back from a player's page returns with them as they were.
  const [includePast, setIncludePast] = useUrlFlag('past')
  const [hideUnanswered, setHideUnanswered] = useUrlFlag('noanswer')
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

  // docs/specs/136: Jump To Today sits in the legend row above the grid, right-aligned, before the slot navigator (not on a phone, where
  // the grid has no such button), shown only where the grid is shown.
  const upcomingMatchId = upcoming?.matchId
  const showJump = Boolean(showsGrid && gridQuery.data && !isPhone)

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  // docs/specs/136 and page-anatomy section 3: toggle chips in the flat toolbar card (switches in the phone's Filters sheet), no count
  // text. The slot navigator (desktop only) sits at the right end of the same toolbar, where the sort and view toggle would be.
  const toggles = (placement: 'row' | 'sheet') => (
    <>
      <ToolbarToggle placement={placement} checked={includePast} onChange={setIncludePast} label="View Entire Season" />
      <ToolbarToggle placement={placement} checked={hideUnanswered} onChange={setHideUnanswered} label="Hide No Answers" />
    </>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <ToolbarCard>
        <AvailabilityFilterBar
          bare
          inCard
          viewControlsInline
          show={{ league: true, section: true, team: true }}
          teams={teams}
          teamId={teamId}
          teamAllLabel={sectionId ? 'All Teams In Section' : 'All Teams'}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search players"
          secondaryControls={toggles}
        />
      </ToolbarCard>

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
            <AvailabilityGrid
              ref={gridRef}
              onScrollBox={setScrollBox}
              games={games}
              players={visiblePlayers}
              changeAnswer={changeAnswer}
              legendActions={
                !isPhone ? (
                  <>
                    {showJump && (
                      <Link
                        component="button"
                        type="button"
                        variant="body2"
                        underline="always"
                        disabled={!upcomingMatchId}
                        onClick={() => upcomingMatchId && gridRef.current?.scrollToGame(upcomingMatchId)}
                        sx={{ fontWeight: 600, '&:disabled': { opacity: 0.5, cursor: 'default' } }}
                      >
                        Jump To Today
                      </Link>
                    )}
                    <SlotNavigator scrollBox={scrollBox} />
                  </>
                ) : undefined
              }
            />
          )}
        </Box>
      )}
    </Box>
  )
}
