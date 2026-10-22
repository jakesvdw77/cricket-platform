import { Fragment, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Box, Button as MuiButton, Chip, Link as MuiLink, Typography } from '@mui/material'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import { Link as RouterLink } from 'react-router-dom'
import { IntegerField } from '../../../components/IntegerField'
import { PlayerName } from '../../../components/PlayerName'
import { badgeSx } from '../../../components/RecordCard'
import { useLeaderboardTable } from '../../../api/leaderboardApi'
import type { LeaderboardColumn, LeaderboardFilters, LeaderboardTableRow, SortDirection, StandingsGroup } from '../../../api/leaderboardApi'
import { LeagueEditPanel } from '../leagueEdit/LeagueEditPanel'
import { cellText, minimumLabel, rankText, statsLink, unrankedReason } from './leaderboardFormat'
import { FigureCell, FirstCell, HeaderRow, LoadingRows, Notice, RankCell, RowShell, ScrollableTable, TableFooter, UnrankedDivider } from './standingsLayout'
import { playerCellWidth } from './standingsGrid'
import { compactButtonSx } from '../../../components/Button'

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

function StandingsRow({ group, row, columns, sortCode, view, filters }: { group: string; row: LeaderboardTableRow; columns: LeaderboardColumn[]; sortCode: string; view: { firstName: string; lastName: string; id: string }[]; filters: LeaderboardFilters }) {
  const unranked = row.rank === null || row.rank === undefined
  const person = { firstName: row.firstName, lastName: row.lastName, id: row.playerId }
  const to = statsLink(row.playerId, filters)
  return (
    <RowShell columns={columns} widthOf={playerCellWidth} to={to} rank={row.rank}>
      <RankCell text={rankText(row.rank)} unranked={unranked} />
      <FirstCell>
        <Typography component="div" sx={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.25, overflowWrap: 'anywhere' }}>
          <MuiLink component={RouterLink} to={to} color="inherit" underline="none" sx={{ '&:hover': { textDecoration: 'underline' } }}>
            <PlayerName person={person} view={view} />
          </MuiLink>
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
              <Chip size="small" label="Small sample" sx={{ ...badgeSx('warning'), height: 20, fontSize: '0.6875rem' }} />
            )}
          </Box>
        )}
      </FirstCell>
      {columns.map((column) => {
        const text = cellText(group, column.code, row.values[column.code])
        return (
          <FigureCell key={column.code} code={column.code} sorted={column.code === sortCode} muted={!(row.values[column.code] && text !== '-')}>
            {text}
          </FigureCell>
        )
      })}
    </RowShell>
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
          <MuiButton variant="outlined" onClick={() => query.refetch()} size="small" sx={compactButtonSx}>
            Try again
          </MuiButton>
        }
      />
    )
  } else if (!first) {
    body = <LoadingRows />
  } else if (rows.length === 0) {
    if (appliedMinimum !== null && showMinimum && belowMinimum > 0) {
      body = (
        <Notice
          title={`No player has reached ${appliedMinimum} ${unit}`}
          description="Lower or clear the minimum to see the table."
          action={
            <MuiButton variant="outlined" onClick={() => onMinimumChange(null)} size="small" sx={compactButtonSx}>
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
              <MuiButton variant="outlined" onClick={onClearFilters} size="small" sx={compactButtonSx}>
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
      <ScrollableTable ariaLabel={`${title} leaderboard`} columnCount={shownColumns.length}>
        <HeaderRow columns={shownColumns} widthOf={playerCellWidth} firstColumnLabel="Player" sortCode={sortCode} direction={direction} onSortChange={onSortChange} />
        <Box role="rowgroup" aria-busy={query.isFetching && !query.isFetchingNextPage} sx={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}>
          {rows.map((row, index) => (
            <Fragment key={row.playerId}>
              {index === firstUnranked && (
                <UnrankedDivider label={`Not ranked: ${unrankedReason(group, sortCode)}`} columns={shownColumns} widthOf={playerCellWidth} />
              )}
              <StandingsRow group={group} row={row} columns={shownColumns} sortCode={sortCode} view={view} filters={filters} />
            </Fragment>
          ))}
        </Box>
      </ScrollableTable>
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
            <MuiButton variant="text" onClick={() => onMinimumChange(null)} size="small" sx={compactButtonSx}>
              Clear
            </MuiButton>
          )}
        </Box>
      )}

      {body}

      <TableFooter lines={footerLines} hasNextPage={Boolean(query.hasNextPage)} fetchingNext={query.isFetchingNextPage} onShowMore={() => query.fetchNextPage()} />
    </LeagueEditPanel>
  )
}
