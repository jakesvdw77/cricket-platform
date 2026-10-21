import type { ReactNode } from 'react'
import { Box, ButtonBase, Button as MuiButton, Skeleton, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import SportsBaseballOutlinedIcon from '@mui/icons-material/SportsBaseballOutlined'
import PanToolOutlinedIcon from '@mui/icons-material/PanToolOutlined'
import SportsScoreOutlinedIcon from '@mui/icons-material/SportsScoreOutlined'
import { EmptyState } from '../../../components/EmptyState'
import { usePlayerMatches } from '../../../api/playerStatsApi'
import type { MatchDirection, PlayerStats, PlayerStatsFilters } from '../../../api/playerStatsApi'
import { NOT_ON_FILE } from '../../../utils/playerFormat'
import { MatchCard } from './MatchCard'
import { MatchRow } from './MatchRow'
import { StatTile, StatTileStrip } from './statsParts'
import { MATCH_COLUMNS, matchGridSx, muted } from './matchLayout'

export interface MatchesTabProps {
  clubId: string
  playerId: string
  stats: PlayerStats
  filters: PlayerStatsFilters
  direction: MatchDirection
  onToggleDirection: () => void
  // The stats page address with the current filters; the result page offers it as "Back to Matches".
  backTo: string
}

const headerCellSx = { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'text.secondary', px: 0.75 } as const

const tileValue = (value: number | null | undefined) => (value === null || value === undefined ? NOT_ON_FILE : String(value))

function dateSortLabel(direction: MatchDirection): string {
  return `Date, sorted ${direction === 'asc' ? 'oldest first' : 'newest first'}; click to reverse`
}

function HeaderRow({ direction, onToggleDirection }: { direction: MatchDirection; onToggleDirection: () => void }) {
  const Arrow = direction === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon
  const heading = (label: string, align?: 'right') => (
    <Box role="columnheader" sx={{ ...headerCellSx, textAlign: align }}>
      {label}
    </Box>
  )
  return (
    <Box
      role="row"
      data-testid="matches-header-row"
      sx={[matchGridSx, { minHeight: 36, bgcolor: 'background.paper', borderTop: 1, borderBottom: 1, borderColor: 'divider' }]}
    >
      <Box role="columnheader" aria-sort={direction === 'asc' ? 'ascending' : 'descending'} sx={{ alignSelf: 'stretch', display: 'flex' }}>
        <ButtonBase
          onClick={onToggleDirection}
          aria-label={dateSortLabel(direction)}
          sx={{ flex: 1, justifyContent: 'flex-start', gap: 0.25, minHeight: 36, ...headerCellSx, color: 'primary.dark', '&:focus-visible': { outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 } }}
        >
          Date
          <Arrow aria-hidden sx={{ fontSize: 14 }} />
        </ButtonBase>
      </Box>
      {heading('Opponent')}
      {heading('Competition')}
      {heading('Result')}
      {heading('Runs', 'right')}
      {heading('Balls', 'right')}
      {heading('How out')}
      {heading('Bowling')}
      {heading('Fielding')}
      <Box role="columnheader" sx={headerCellSx}>
        <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
          Awards
        </Box>
      </Box>
    </Box>
  )
}

function Skeletons({ wide }: { wide: boolean }) {
  return (
    <Box aria-busy="true" aria-label="Loading matches" data-testid="matches-loading" sx={{ display: 'flex', flexDirection: 'column', gap: wide ? 0 : 1 }}>
      {[0, 1, 2, 3, 4].map((index) =>
        wide ? <Skeleton key={index} variant="rectangular" height={40} sx={{ mb: '1px' }} /> : <Skeleton key={index} variant="rounded" height={120} />,
      )}
    </Box>
  )
}

// docs/specs/115-player-match-list.md: the Matches tab. One row per counted match, newest first (the Date heading reverses), a tile strip
// from the stats the page holds, Show more asking the server for the next page. A table from sm, stacked cards below.
export function MatchesTab({ clubId, playerId, stats, filters, direction, onToggleDirection, backTo }: MatchesTabProps) {
  const theme = useTheme()
  const wide = useMediaQuery(theme.breakpoints.up('sm'), { noSsr: true })
  const query = usePlayerMatches(clubId, playerId, filters, direction)
  const { firstPage, lastPage, rows } = query
  const total = lastPage?.page.totalElements ?? stats.basis.matchesCounted

  let body: ReactNode
  if (query.isError && !firstPage) {
    body = (
      <EmptyState
        title="Couldn't load the matches"
        description="Something went wrong loading this player's matches."
        action={
          <MuiButton variant="outlined" onClick={() => query.refetch()} sx={{ minHeight: 44 }}>
            Try again
          </MuiButton>
        }
      />
    )
  } else if (!firstPage) {
    body = <Skeletons wide={wide} />
  } else if (wide) {
    body = (
      <Box
        sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', boxShadow: 2, overflow: 'clip' }}
      >
        <Box sx={{ overflowX: 'auto' }}>
          <Box role="table" aria-label="Matches played" aria-colcount={MATCH_COLUMNS} aria-busy={query.isFetching} data-testid="matches-table">
            <Box role="rowgroup">
              <HeaderRow direction={direction} onToggleDirection={onToggleDirection} />
            </Box>
            <Box role="rowgroup" sx={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}>
              {rows.map((row) => (
                <MatchRow key={row.matchId} row={row} backTo={backTo} />
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    )
  } else {
    body = (
      <>
        <ButtonBase
          onClick={onToggleDirection}
          aria-label={dateSortLabel(direction)}
          sx={{ alignSelf: 'flex-start', minHeight: 44, px: 0.5, gap: 0.5, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'primary.dark' }}
        >
          {direction === 'asc' ? 'Date: oldest first' : 'Date: newest first'}
          {direction === 'asc' ? <ArrowUpwardIcon aria-hidden sx={{ fontSize: 14 }} /> : <ArrowDownwardIcon aria-hidden sx={{ fontSize: 14 }} />}
        </ButtonBase>
        <Box component="ul" aria-label="Matches played" aria-busy={query.isFetching} sx={{ m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.25, opacity: query.isPlaceholderData ? 0.6 : 1 }}>
          {rows.map((row) => (
            <MatchCard key={row.matchId} row={row} backTo={backTo} />
          ))}
        </Box>
      </>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} data-testid="matches-tab">
      {total > 0 && (
        <StatTileStrip>
          <StatTile testId="tile-matches" icon={<SportsScoreOutlinedIcon />} label="Matches" value={tileValue(stats.basis.matchesCounted)} />
          <StatTile testId="tile-runs" icon={<SportsCricketOutlinedIcon />} label="Runs" value={tileValue(stats.batting.runs)} />
          <StatTile testId="tile-wickets" tone="success" icon={<SportsBaseballOutlinedIcon />} label="Wickets" value={tileValue(stats.bowling.wickets)} />
          <StatTile testId="tile-catches" icon={<PanToolOutlinedIcon />} label="Catches" value={tileValue(stats.fielding.catches)} />
        </StatTileStrip>
      )}
      {body}
      {firstPage && rows.length === 0 && (
        <Typography sx={{ ...muted, fontSize: '0.875rem' }}>No matches to show for these filters.</Typography>
      )}
      {firstPage && rows.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 1.25, py: 0.5 }}>
          <Typography data-testid="matches-footer" sx={{ fontSize: '0.875rem', color: 'text.secondary', textAlign: { xs: 'center', sm: 'left' } }}>
            Showing {rows.length} of {total} {total === 1 ? 'match' : 'matches'}
          </Typography>
          {query.isError && (
            <Box role="alert" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: { xs: 'center', sm: 'flex-start' } }}>
              <Typography sx={{ fontSize: '0.875rem', color: 'error.main' }}>Couldn't load more matches</Typography>
              <MuiButton variant="text" onClick={() => (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())} sx={{ minHeight: 44 }}>
                Try again
              </MuiButton>
            </Box>
          )}
          {query.hasNextPage && !query.isError && (
            <MuiButton variant="outlined" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} sx={{ minHeight: 44 }}>
              {query.isFetchingNextPage ? 'Loading...' : 'Show more'}
            </MuiButton>
          )}
        </Box>
      )}
    </Box>
  )
}
