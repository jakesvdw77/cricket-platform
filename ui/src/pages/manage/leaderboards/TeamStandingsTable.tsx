import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { Box, Button as MuiButton, Chip, Link as MuiLink, Typography } from '@mui/material'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { IntegerField } from '../../../components/IntegerField'
import { badgeSx } from '../../../components/RecordCard'
import type { TeamStatsCell, TeamStatsColumn, TeamStatsTableRow, useTeamStatsTable } from '../../../api/teamStatsApi'
import type { LeaderboardFilters } from '../../../api/leaderboardApi'
import { LeagueEditPanel } from '../leagueEdit/LeagueEditPanel'
import { FigureCell, FirstCell, HeaderRow, LoadingRows, Notice, RankCell, RowShell, ScrollableTable, TableFooter, UnrankedDivider } from './standingsLayout'
import type { WidthOf } from './standingsGrid'
import { rankText } from './leaderboardFormat'
import { netRunRateReason, teamBasisLines, teamCellText, teamStatsLink, teamUnrankedReason } from './teamStatsFormat'
import { compactButtonSx } from '../../../components/Button'

// 15 figure columns: a little tighter than the player tables on desktop so the table fits about 1100 px; phones scroll.
const TEAM_CELL_W = { xs: 76, sm: 56 }
const TEAM_WIDE_W: Record<string, { xs: number; sm: number }> = {
  highTotal: { xs: 84, sm: 66 },
  bowlingAverage: { xs: 88, sm: 72 },
  netRunRate: { xs: 84, sm: 66 },
  winPercent: { xs: 84, sm: 64 },
  runs: { xs: 80, sm: 62 },
}
const teamCellWidth: WidthOf = (code) => TEAM_WIDE_W[code] ?? TEAM_CELL_W

export interface TeamStandingsTableProps {
  query: ReturnType<typeof useTeamStatsTable>
  sortCode: string
  onSortChange: (code: string) => void
  filters: LeaderboardFilters
  competition: string | null
  // true when a Season, League, Section or Competition is chosen (the empty state then offers Clear filters)
  hasFilters: boolean
  onClearFilters: () => void
  // The optional minimum as typed (null = none), owned by the tab so it can be reset when the sort or filters change
  minimum: number | null
  onMinimumChange: (value: number | null) => void
  // The minimum that is sent to the server (debounced)
  appliedMinimum: number | null
}

function TeamRow({ row, columns, sortCode, to }: { row: TeamStatsTableRow; columns: TeamStatsColumn[]; sortCode: string; to: string }) {
  const unranked = row.rank === null || row.rank === undefined
  // docs/specs/116: the team page's Back returns to this table with its filters, sort and tab
  const location = useLocation()
  const state = { backTo: `${location.pathname}${location.search}`, backLabel: 'Teams' }
  return (
    <RowShell columns={columns} widthOf={teamCellWidth} to={to} state={state} rank={row.rank}>
      <RankCell text={rankText(row.rank)} unranked={unranked} />
      <FirstCell>
        <Typography component="div" sx={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.25, overflowWrap: 'anywhere' }}>
          <MuiLink component={RouterLink} to={to} state={state} color="inherit" underline="none" sx={{ '&:hover': { textDecoration: 'underline' } }}>
            {row.teamName}
          </MuiLink>
        </Typography>
        {row.sectionName && (
          <Typography component="div" sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.25 }}>
            {row.sectionName}
          </Typography>
        )}
        {!row.active && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
            <Chip size="small" label="Inactive" sx={{ ...badgeSx('muted'), height: 20, fontSize: '0.6875rem' }} />
          </Box>
        )}
      </FirstCell>
      {columns.map((column) => {
        const cell: TeamStatsCell | undefined = row.values[column.code]
        const text = teamCellText(column.code, cell)
        const reason = column.code === 'netRunRate' && cell?.status && cell.status !== 'SHOWN' ? netRunRateReason(cell) : null
        return (
          <FigureCell key={column.code} code={column.code} sorted={column.code === sortCode} muted={!cell || cell.value === null || cell.value === undefined} label={reason ?? undefined}>
            {text}
          </FigureCell>
        )
      })}
    </RowShell>
  )
}

// docs/specs/116-team-stats.md (decision 19, "The Teams tab on the Leaderboards page"): the Teams table over the same layout as the
// player standings. Team (name, section sub-line, Inactive chip) pinned with the rank, the columns exactly as the server sends them,
// the unranked group after a divider, Show more asks the server for the next page (nothing is sliced here), and a row opens the
// team's statistics page with Season, League and Competition. Every figure and rank comes from the server.
export function TeamStandingsTable({ query, sortCode, onSortChange, filters, competition, hasFilters, onClearFilters, minimum, onMinimumChange, appliedMinimum }: TeamStandingsTableProps) {
  const first = query.firstPage
  const last = query.lastPage
  const rows = query.rows
  const columns = first?.columns ?? []
  const direction = first?.sort.direction ?? 'HIGHEST'
  const firstUnranked = rows.findIndex((row) => row.rank === null || row.rank === undefined)
  const showMinimum = Boolean(first?.minimum.applies)
  const belowMinimum = first?.basis.belowMinimum ?? 0

  let body: ReactNode
  if (query.isError && !first) {
    body = (
      <Notice
        tone="error"
        title="Couldn't load team statistics"
        description="The tab strip and filters still work."
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
          title={`No team has reached ${appliedMinimum} ${appliedMinimum === 1 ? 'match' : 'matches'}`}
          description="Lower or clear the minimum to see the table."
          action={
            <MuiButton variant="outlined" onClick={() => onMinimumChange(null)} size="small" sx={compactButtonSx}>
              Clear minimum
            </MuiButton>
          }
        />
      )
    } else if (first.basis.resultsCounted === 0 && !hasFilters) {
      body = (
        <Notice
          title="No published results yet"
          description="Team statistics appear here once a published result includes one of your teams."
          action={
            <MuiButton component={RouterLink} to="/manage/results" variant="outlined" size="small" sx={compactButtonSx}>
              Go to Results
            </MuiButton>
          }
        />
      )
    } else if (first.basis.resultsCounted === 0) {
      body = (
        <Notice
          title="No published results match these filters"
          description="Try a different season or competition."
          action={
            <MuiButton variant="outlined" onClick={onClearFilters} size="small" sx={compactButtonSx}>
              Clear filters
            </MuiButton>
          }
        />
      )
    } else {
      body = <Notice title="No team is on this table yet" description="No team has a figure here for these filters." />
    }
  } else {
    body = (
      <ScrollableTable ariaLabel="Teams statistics" columnCount={columns.length}>
        <HeaderRow columns={columns} widthOf={teamCellWidth} firstColumnLabel="Team" sortCode={sortCode} direction={direction} onSortChange={onSortChange} />
        <Box role="rowgroup" aria-busy={query.isFetching && !query.isFetchingNextPage} sx={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}>
          {rows.map((row, index) => (
            <Fragment key={row.teamId}>
              {index === firstUnranked && (
                <UnrankedDivider label={`Not ranked: ${teamUnrankedReason(sortCode)}`} columns={columns} widthOf={teamCellWidth} />
              )}
              <TeamRow row={row} columns={columns} sortCode={sortCode} to={teamStatsLink(row.teamId, filters, competition)} />
            </Fragment>
          ))}
        </Box>
      </ScrollableTable>
    )
  }

  const footerLines: string[] = []
  if (first && rows.length > 0 && last) footerLines.push(`Showing ${rows.length} of ${last.page.totalElements} teams.`)
  if (first && rows.length > 0) footerLines.push(...teamBasisLines(first.basis))
  if (appliedMinimum !== null && showMinimum && belowMinimum > 0 && rows.length > 0) {
    footerLines.push(`${belowMinimum} team${belowMinimum === 1 ? ' is' : 's are'} below the minimum of ${appliedMinimum} ${appliedMinimum === 1 ? 'match' : 'matches'}.`)
  }

  return (
    <>
      <LeagueEditPanel icon={<GroupsOutlinedIcon />} title="Teams" testId="board-panel" ariaLabel="Teams">
        {showMinimum && (
          <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 1.5, display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
            <Box sx={{ width: { xs: '100%', sm: 280 } }}>
              <IntegerField
                label="Minimum matches (optional)"
                ariaLabel="Minimum matches"
                value={minimum}
                onChange={onMinimumChange}
                max={999}
                maxLength={3}
                placeholder="No minimum"
                helperText="Optional. Leave empty to list every team."
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
      <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>Partnerships (runs by wicket) are not captured yet.</Typography>
    </>
  )
}
