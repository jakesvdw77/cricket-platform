import { Fragment, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, ButtonBase, Button as MuiButton, Chip, Skeleton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import { Link as RouterLink } from 'react-router-dom'
import { IntegerField } from '../../../components/IntegerField'
import { PlayerName } from '../../../components/PlayerName'
import { badgeSx } from '../../../components/RecordCard'
import { useLeaderboardTable } from '../../../api/leaderboardApi'
import type { LeaderboardColumn, LeaderboardFilters, LeaderboardTableRow, SortDirection, StandingsGroup } from '../../../api/leaderboardApi'
import { zebraTint } from '../../../utils/zebraTint'
import { LeagueEditPanel } from '../leagueEdit/LeagueEditPanel'
import { hoverTint } from '../leagueEdit/leagueEditRowStyles'
import { cellText, minimumLabel, rankText, statsLink, unrankedReason } from './leaderboardFormat'

export interface StandingsTableProps {
  clubId: string
  group: StandingsGroup
  title: string
  // the catalogue's columns for this group, in display order
  columns: LeaderboardColumn[]
  sortCode: string
  // the requested direction (null = the column's natural one); the arrow shows the effective direction the server returns
  sortDirection: SortDirection | null
  // a heading was tapped: the page selects a new column or reverses the current one
  onSortChange: (code: string) => void
  filters: LeaderboardFilters
  // true when a Season, League, Team or Section is chosen (the empty state then offers Clear filters)
  hasFilters: boolean
  onClearFilters: () => void
  // The optional minimum as typed (null = none), owned by the page so it can be reset when the sort or filters change
  minimum: number | null
  onMinimumChange: (value: number | null) => void
  // The minimum that is sent to the server (debounced)
  appliedMinimum: number | null
  enabled: boolean
}

// Column widths: rank, the pinned player column, then one fixed width per figure. Desktop is compact so the 13-column Bowling
// table (1046 px) and the 12-column Batting table (974 px) fit about 1100 px of content; phones keep roomier columns and scroll.
const RANK_W = { xs: 40, sm: 40 }
const PLAYER_W = { xs: 156, sm: 190 }
const CELL_W = { xs: 80, sm: 62 }
// Columns whose figure or heading needs more room than CELL_W.
const WIDE_CELL_W: Record<string, { xs: number; sm: number }> = {
  overs: { xs: 80, sm: 68 },
  best: { xs: 80, sm: 66 },
  catches: { xs: 80, sm: 72 },
  runOuts: { xs: 88, sm: 76 },
  stumpings: { xs: 96, sm: 84 },
}
const cellWidth = (code: string) => WIDE_CELL_W[code] ?? CELL_W

const trackMins = (columns: LeaderboardColumn[], bp: 'xs' | 'sm') => [RANK_W[bp], PLAYER_W[bp], ...columns.map((c) => cellWidth(c.code)[bp])]
const template = (columns: LeaderboardColumn[], bp: 'xs' | 'sm') => {
  const [rank, player, ...cells] = trackMins(columns, bp)
  return `${rank}px minmax(${player}px, 1.6fr) ${cells.map((w) => `minmax(${w}px, 1fr)`).join(' ')}`
}
// The table is as wide as the card, and never narrower than the sum of its minimum column widths (below that it scrolls sideways).
const tableMinWidth = (columns: LeaderboardColumn[]) => ({
  xs: `${trackMins(columns, 'xs').reduce((a, b) => a + b, 0)}px`,
  sm: `${trackMins(columns, 'sm').reduce((a, b) => a + b, 0)}px`,
})

const gridSx = (columns: LeaderboardColumn[]) => ({
  display: 'grid',
  gridTemplateColumns: { xs: template(columns, 'xs'), sm: template(columns, 'sm') },
  alignItems: 'center',
  width: '100%',
  minWidth: tableMinWidth(columns),
})

// Rank and player stay put while the figures scroll sideways; they take the row's own (opaque) background.
const pinnedRank = { position: 'sticky', left: 0, zIndex: 2, bgcolor: 'inherit', alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center' } as const
const pinnedPlayer = {
  position: 'sticky',
  left: RANK_W,
  zIndex: 2,
  bgcolor: 'inherit',
  alignSelf: 'stretch',
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
  px: 0.5,
  boxShadow: (theme: Theme) => `1px 0 0 ${theme.palette.divider}`,
} as const

const sortedTint = (theme: Theme) => alpha(theme.palette.primary.main, 0.1)

function Notice({ title, description, action, tone = 'info' }: { title: string; description: string; action?: ReactNode; tone?: 'info' | 'error' }) {
  return (
    <Box
      role={tone === 'error' ? 'alert' : undefined}
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, textAlign: 'center', px: 2, py: 3.5, borderTop: 1, borderColor: tone === 'error' ? 'error.main' : 'divider' }}
    >
      <Typography sx={{ fontSize: '1.0625rem', fontWeight: 700, color: tone === 'error' ? 'error.main' : 'text.primary' }}>{title}</Typography>
      <Typography sx={{ fontSize: '0.9375rem', color: 'text.secondary', maxWidth: 460 }}>{description}</Typography>
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Box>
  )
}

function HeaderRow({ columns, sortCode, direction, onSortChange }: { columns: LeaderboardColumn[]; sortCode: string; direction: 'HIGHEST' | 'LOWEST'; onSortChange: (code: string) => void }) {
  return (
    <Box
      data-testid="standings-header-row"
      sx={[
        gridSx(columns),
        { minHeight: { xs: 44, sm: 36 }, bgcolor: 'background.paper', borderTop: 1, borderBottom: 1, borderColor: 'divider', color: 'text.secondary' },
      ]}
    >
      <Box sx={{ ...pinnedRank, fontSize: '0.75rem', fontWeight: 700 }}>#</Box>
      <Box sx={{ ...pinnedPlayer, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Player</Box>
      {columns.map((column) => {
        const sorted = column.code === sortCode
        const Arrow = direction === 'LOWEST' ? ArrowUpwardIcon : ArrowDownwardIcon
        const label = !column.sortable
          ? column.label
          : sorted
            ? `${column.longLabel ?? column.label}, sorted ${direction === 'LOWEST' ? 'ascending' : 'descending'}; click to reverse`
            : `Sort by ${column.longLabel ?? column.label}`
        return (
          <Box key={column.code} aria-sort={sorted ? (direction === 'LOWEST' ? 'ascending' : 'descending') : undefined} sx={{ alignSelf: 'stretch', display: 'flex', bgcolor: sorted ? sortedTint : 'transparent' }}>
            <ButtonBase
              disabled={!column.sortable}
              onClick={() => onSortChange(column.code)}
              aria-label={label}
              data-sorted={sorted ? 'true' : undefined}
              sx={{
                flex: 1,
                minHeight: { xs: 44, sm: 36 },
                justifyContent: 'flex-end',
                gap: 0.25,
                px: 0.75,
                fontFamily: 'inherit',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: sorted ? 'primary.dark' : 'text.secondary',
                '&:hover': { color: 'primary.dark' },
                '&.Mui-disabled': { color: 'text.secondary' },
              }}
            >
              {sorted && <Arrow aria-hidden sx={{ fontSize: 14 }} />}
              {column.label}
            </ButtonBase>
          </Box>
        )
      })}
    </Box>
  )
}

function StandingsRow({ row, columns, sortCode, view, filters }: { row: LeaderboardTableRow; columns: LeaderboardColumn[]; sortCode: string; view: { firstName: string; lastName: string; id: string }[]; filters: LeaderboardFilters }) {
  const leader = row.rank === 1
  const unranked = row.rank === null || row.rank === undefined
  const person = { firstName: row.firstName, lastName: row.lastName, id: row.playerId }
  return (
    <Box
      component={RouterLink}
      to={statsLink(row.playerId, filters)}
      data-testid="standings-row"
      data-rank={unranked ? 'none' : row.rank}
      sx={[
        gridSx(columns),
        {
          minHeight: { xs: 48, sm: 40 },
          textDecoration: 'none',
          color: 'text.primary',
          bgcolor: 'background.paper',
          '&:nth-of-type(odd)': { bgcolor: zebraTint },
          '&:hover': { bgcolor: hoverTint },
          '&:focus-visible': { outline: (theme: Theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
        },
        leader && { boxShadow: (theme: Theme) => `inset 3px 0 0 ${theme.palette.primary.main}` },
      ]}
    >
      <Box sx={{ ...pinnedRank, fontSize: '0.875rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: unranked ? 'text.secondary' : 'primary.dark' }}>{rankText(row.rank)}</Box>
      <Box sx={pinnedPlayer}>
        <Box sx={{ minWidth: 0, py: { xs: 0.75, sm: 0.5 } }}>
          <Typography component="div" sx={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.25, overflowWrap: 'anywhere' }}>
            <PlayerName person={person} view={view} />
          </Typography>
          {row.teamName && (
            <Typography component="div" sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.25 }}>
              {row.teamName}
            </Typography>
          )}
          {(!row.active || row.smallSample) && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
              {!row.active && <Chip size="small" label="Inactive" sx={{ ...badgeSx('muted'), height: 20, fontSize: '0.6875rem' }} />}
              {row.smallSample && (
                <Chip size="small" label="Small sample" sx={{ height: 20, fontSize: '0.6875rem', fontWeight: 600, color: 'warning.dark', bgcolor: (theme) => alpha(theme.palette.warning.main, 0.14) }} />
              )}
            </Box>
          )}
        </Box>
      </Box>
      {columns.map((column) => {
        const text = cellText(column.code, row.values[column.code])
        const sorted = column.code === sortCode
        return (
          <Box
            key={column.code}
            data-testid={`cell-${column.code}`}
            sx={{
              alignSelf: 'stretch',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              px: 0.75,
              fontSize: '0.875rem',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: sorted ? 700 : 400,
              color: row.values[column.code] && text !== '-' ? 'text.primary' : 'text.secondary',
              bgcolor: sorted ? sortedTint : 'transparent',
            }}
          >
            {text}
          </Box>
        )
      })}
    </Box>
  )
}

// docs/specs/103-player-stats.md (decision 26, "Standings tables"): one fixed-column table per group (Batting, Bowling, Fielding)
// ranked by the chosen column. Phone: scrolls sideways with rank and player pinned and a fade at the right edge. The unranked group
// follows a divider, Show more asks the server for the next page (nothing is sliced here), and the whole row opens the player's
// stats with the filters. Every figure and rank comes from the server.
export function StandingsTable({
  clubId,
  group,
  title,
  columns,
  sortCode,
  sortDirection,
  onSortChange,
  filters,
  hasFilters,
  onClearFilters,
  minimum,
  onMinimumChange,
  appliedMinimum,
  enabled,
}: StandingsTableProps) {
  const sortColumn = columns.find((column) => column.code === sortCode)
  const hasMinimum = Boolean(sortColumn && sortColumn.minimumKind !== 'NONE')
  const query = useLeaderboardTable(clubId, group, sortCode, sortDirection, filters, hasMinimum ? appliedMinimum : null, enabled)
  const first = query.firstPage
  const last = query.lastPage
  const rows = query.rows
  // the server's own column list wins once loaded; the catalogue's fills in until then
  const shownColumns = first?.columns?.length ? first.columns : columns
  const direction = first?.sort.direction ?? sortColumn?.direction ?? 'HIGHEST'

  const view = useMemo(() => rows.map((row) => ({ firstName: row.firstName, lastName: row.lastName, id: row.playerId })), [rows])
  const firstUnranked = rows.findIndex((row) => row.rank === null || row.rank === undefined)
  const [atEnd, setAtEnd] = useState(false)

  const showMinimum = first ? first.minimum.applies : hasMinimum
  const kind = first?.minimum.unit ?? sortColumn?.minimumKind ?? 'INNINGS'
  const suggested = first?.minimum.suggestedDefault ?? null
  const unit = kind === 'OVERS' ? 'overs' : 'innings'
  const belowMinimum = first?.basis.belowMinimum ?? 0

  let body: ReactNode
  if (query.isError && !first) {
    body = (
      <Notice
        tone="error"
        title="Could not load this table"
        description="Check your connection and try again."
        action={
          <MuiButton variant="outlined" onClick={() => query.refetch()} sx={{ minHeight: 44 }}>
            Try again
          </MuiButton>
        }
      />
    )
  } else if (!first) {
    body = (
      <Box aria-busy="true" aria-label="Loading table" sx={{ px: 1.5, pb: 1.5 }}>
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} variant="rounded" height={52} sx={{ mb: 0.75 }} />
        ))}
      </Box>
    )
  } else if (rows.length === 0) {
    if (appliedMinimum !== null && showMinimum && belowMinimum > 0) {
      body = (
        <Notice
          title={`No player has reached ${appliedMinimum} ${unit}`}
          description="Lower or clear the minimum to see the table."
          action={
            <MuiButton variant="outlined" onClick={() => onMinimumChange(null)} sx={{ minHeight: 44 }}>
              Clear minimum
            </MuiButton>
          }
        />
      )
    } else if (first.basis.resultsCounted === 0) {
      body = (
        <Notice
          title="No published results match these filters"
          description="Publish a result, or widen the filters."
          action={
            hasFilters ? (
              <MuiButton variant="outlined" onClick={onClearFilters} sx={{ minHeight: 44 }}>
                Clear filters
              </MuiButton>
            ) : undefined
          }
        />
      )
    } else {
      body = <Notice title="Nobody is on this table yet" description="No player has a figure here for these filters." />
    }
  } else {
    body = (
      <Box sx={{ position: 'relative' }}>
        <Box
          data-testid="standings-scroll"
          onScroll={(event) => {
            const el = event.currentTarget
            setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
          }}
          sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
        >
          <HeaderRow columns={shownColumns} sortCode={sortCode} direction={direction} onSortChange={onSortChange} />
          <Box aria-busy={query.isFetching && !query.isFetchingNextPage} sx={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}>
            {rows.map((row, index) => (
              <Fragment key={row.playerId}>
                {index === firstUnranked && (
                  <Box
                    data-testid="unranked-divider"
                    sx={{ width: '100%', minWidth: tableMinWidth(shownColumns), bgcolor: 'action.hover', borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
                  >
                    <Box
                      sx={{
                        position: 'sticky',
                        left: 0,
                        width: 'fit-content',
                        px: 1.5,
                        py: 1,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: 'text.secondary',
                      }}
                    >
                      {`Not ranked: ${unrankedReason(group, sortCode)}`}
                    </Box>
                  </Box>
                )}
                <StandingsRow row={row} columns={shownColumns} sortCode={sortCode} view={view} filters={filters} />
              </Fragment>
            ))}
          </Box>
        </Box>
        <Box
          aria-hidden
          sx={{
            display: { xs: atEnd ? 'none' : 'block', sm: 'none' },
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            width: 36,
            pointerEvents: 'none',
            background: (theme) => `linear-gradient(90deg, ${alpha(theme.palette.background.paper, 0)}, ${theme.palette.background.paper})`,
          }}
        />
      </Box>
    )
  }

  const basis = first?.basis
  const footerLines: string[] = []
  if (first && rows.length > 0 && last) footerLines.push(`Showing ${rows.length} of ${last.page.totalElements}.`)
  if (basis && rows.length > 0) {
    const coverage = basis.coverage
    footerLines.push(
      `Based on ${basis.resultsCounted} published result${basis.resultsCounted === 1 ? '' : 's'}.`,
    )
    if (coverage && sortCode === 'dots') footerLines.push(`Dots recorded in ${coverage.used} of ${coverage.counted} bowling innings.`)
    else if (coverage && coverage.used < coverage.counted) footerLines.push(`Recorded in ${coverage.used} of ${coverage.counted} innings.`)
  }
  if (appliedMinimum !== null && showMinimum && belowMinimum > 0 && rows.length > 0) {
    footerLines.push(`${belowMinimum} player${belowMinimum === 1 ? ' is' : 's are'} below the minimum of ${appliedMinimum} ${unit}.`)
  }

  return (
    <LeagueEditPanel icon={<EmojiEventsOutlinedIcon />} title={title} testId="board-panel" ariaLabel={title}>
      {showMinimum && (
        <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 1.5, display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
          <Box sx={{ width: { xs: '100%', sm: 280 } }}>
            <IntegerField
              label={`${minimumLabel(kind)} (optional)`}
              ariaLabel={minimumLabel(kind)}
              value={minimum}
              onChange={onMinimumChange}
              max={999}
              maxLength={3}
              placeholder="No minimum"
              helperText={suggested !== null ? `Optional. Suggested minimum for these filters: ${suggested}.` : 'Optional. Leave empty to list everyone.'}
            />
          </Box>
          {minimum !== null && (
            <MuiButton variant="text" onClick={() => onMinimumChange(null)} sx={{ minHeight: 40 }}>
              Clear
            </MuiButton>
          )}
        </Box>
      )}

      {body}

      {(footerLines.length > 0 || query.hasNextPage) && (
        <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25, borderTop: 1, borderColor: 'divider' }}>
          {footerLines.length > 0 && (
            <Typography data-testid="board-footer" sx={{ fontSize: '0.875rem', color: 'text.secondary', lineHeight: 1.45 }}>
              {footerLines.join(' ')}
            </Typography>
          )}
          {query.hasNextPage && (
            <MuiButton variant="outlined" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} sx={{ minHeight: 44, alignSelf: { xs: 'stretch', sm: 'flex-start' } }}>
              {query.isFetchingNextPage ? 'Loading...' : 'Show more'}
            </MuiButton>
          )}
        </Box>
      )}
    </LeagueEditPanel>
  )
}
