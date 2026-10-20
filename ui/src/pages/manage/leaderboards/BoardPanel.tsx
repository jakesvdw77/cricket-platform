import { Fragment, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Box, Button as MuiButton, Skeleton, Typography } from '@mui/material'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import { LeagueEditPanel } from '../leagueEdit/LeagueEditPanel'
import { IntegerField } from '../../../components/IntegerField'
import { useLeaderboard } from '../../../api/leaderboardApi'
import type { LeaderboardBoardInfo, LeaderboardFilters, LeaderboardRow } from '../../../api/leaderboardApi'
import { BoardHeaderRow, BoardRow } from './BoardRow'
import { minimumLabel, unrankedReason } from './leaderboardFormat'

export interface BoardPanelProps {
  clubId: string
  board: LeaderboardBoardInfo
  filters: LeaderboardFilters
  // true when a Season, League, Team or Section is chosen (the empty state then offers Clear filters)
  hasFilters: boolean
  onClearFilters: () => void
  // The optional minimum as typed (null = none), owned by the page so it can be reset when the board changes
  minimum: number | null
  onMinimumChange: (value: number | null) => void
  // The minimum that is sent to the server (debounced)
  appliedMinimum: number | null
  enabled: boolean
}

function Notice({ title, description, action, tone = 'info' }: { title: string; description: string; action?: ReactNode; tone?: 'info' | 'error' }) {
  return (
    <Box
      role={tone === 'error' ? 'alert' : undefined}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        textAlign: 'center',
        px: 2,
        py: 3.5,
        borderTop: 1,
        borderColor: tone === 'error' ? 'error.main' : 'divider',
      }}
    >
      <Typography sx={{ fontSize: '1.0625rem', fontWeight: 700, color: tone === 'error' ? 'error.main' : 'text.primary' }}>{title}</Typography>
      <Typography sx={{ fontSize: '0.9375rem', color: 'text.secondary', maxWidth: 460 }}>{description}</Typography>
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Box>
  )
}

// docs/specs/103-player-stats.md (The Leaderboards page, items 4 to 6, and the BoardStates mockup): the panel of one board. Its
// heading and help (which states the tie-breaks), the optional minimum on rate boards, the zebra rows in pages (Show more asks
// the server for the next page; nothing is sliced here), the unranked group after a divider, the footer lines and the empty and
// error states.
export function BoardPanel({ clubId, board, filters, hasFilters, onClearFilters, minimum, onMinimumChange, appliedMinimum, enabled }: BoardPanelProps) {
  const hasMinimum = board.minimumKind !== 'NONE'
  const query = useLeaderboard(clubId, board.code, filters, hasMinimum ? appliedMinimum : null, enabled)
  const first = query.firstPage
  const last = query.lastPage
  const rows = query.rows

  const view = useMemo(() => rows.map((row) => ({ firstName: row.firstName, lastName: row.lastName, id: row.playerId })), [rows])
  const firstUnranked = rows.findIndex((row) => row.rank === null || row.rank === undefined)

  const suggested = first?.minimum.suggestedDefault ?? null
  const minLabel = minimumLabel(board)
  const unit = board.minimumKind === 'OVERS' ? 'overs' : 'innings'
  const belowMinimum = first?.basis.belowMinimum ?? 0

  let body: ReactNode
  if (query.isError && !first) {
    body = (
      <Notice
        tone="error"
        title="Could not load this board"
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
      <Box aria-busy="true" aria-label="Loading board" sx={{ px: 1.5, pb: 1.5 }}>
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} variant="rounded" height={48} sx={{ mb: 0.75 }} />
        ))}
      </Box>
    )
  } else if (rows.length === 0) {
    if (appliedMinimum !== null && hasMinimum && belowMinimum > 0) {
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
      body = (
        <Notice
          title="Nobody is on this board yet"
          description="No player has a figure here for these filters. Boards built on optional details, such as dot balls, fill in by themselves once results record them."
        />
      )
    }
  } else {
    body = (
      <>
        <BoardHeaderRow board={board} />
        <Box aria-busy={query.isFetching && !query.isFetchingNextPage} sx={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}>
          {rows.map((row: LeaderboardRow, index: number) => (
            <Fragment key={row.playerId}>
              {index === firstUnranked && (
                <Box
                  sx={{
                    px: 1.5,
                    py: 1,
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    bgcolor: 'action.hover',
                    borderTop: 1,
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  {`Not ranked: ${unrankedReason(board)}`}
                </Box>
              )}
              <BoardRow board={board} row={row} view={view} filters={filters} />
            </Fragment>
          ))}
        </Box>
      </>
    )
  }

  const basis = first?.basis
  const footerLines: string[] = []
  if (first && rows.length > 0 && last) footerLines.push(`Showing ${rows.length} of ${last.page.totalElements}.`)
  if (basis && rows.length > 0) {
    const coverage = basis.coverage
    footerLines.push(
      `Based on ${basis.resultsCounted} published result${basis.resultsCounted === 1 ? '' : 's'}${
        coverage && coverage.used < coverage.counted ? `; recorded in ${coverage.used} of ${coverage.counted} innings` : ''
      }.`,
    )
  }
  if (appliedMinimum !== null && hasMinimum && belowMinimum > 0 && rows.length > 0) {
    footerLines.push(`${belowMinimum} player${belowMinimum === 1 ? ' is' : 's are'} below the minimum of ${appliedMinimum} ${unit}.`)
  }

  return (
    <LeagueEditPanel icon={<EmojiEventsOutlinedIcon />} title={board.label} testId="board-panel" ariaLabel={board.label}>
      <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {board.help && (
          <Typography data-testid="board-help" sx={{ fontSize: '0.9375rem', color: 'text.secondary', lineHeight: 1.45 }}>
            {board.help}
          </Typography>
        )}
        {hasMinimum && (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
            <Box sx={{ width: { xs: '100%', sm: 280 } }}>
              <IntegerField
                label={`${minLabel} (optional)`}
                ariaLabel={minLabel}
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
      </Box>

      {body}

      {(footerLines.length > 0 || query.hasNextPage) && (
        <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25, borderTop: 1, borderColor: 'divider' }}>
          {footerLines.length > 0 && (
            <Typography data-testid="board-footer" sx={{ fontSize: '0.875rem', color: 'text.secondary', lineHeight: 1.45 }}>
              {footerLines.join(' ')}
            </Typography>
          )}
          {query.hasNextPage && (
            <MuiButton
              variant="outlined"
              onClick={() => query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              sx={{ minHeight: 44, alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
            >
              {query.isFetchingNextPage ? 'Loading...' : 'Show more'}
            </MuiButton>
          )}
        </Box>
      )}
    </LeagueEditPanel>
  )
}
