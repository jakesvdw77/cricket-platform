import { Fragment, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Box, ButtonBase, Link, MenuItem, Select, Skeleton, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, useMediaQuery } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import { Button } from '../../../../../components/Button'
import { visuallyHiddenSx } from '../../../../../components/StatsCards'
import { useDebouncedValue } from '../../../../../hooks/useDebouncedValue'
import { useMyLeaderboard } from '../../../../../api/meStatsApi'
import type { MyLeaderboardDirection, MyLeaderboardGroup, MyLeaderboardRow } from '../../../../../api/meStatsApi'
import type { MyResultScope } from '../../../../../api/meResultsApi'
import { DARK_MENU_BG, blackAlpha, creamAlpha } from '../../../../../brandTokens'
import { HUB, darkFieldSx, darkMenuProps, hubOutlineButton } from '../../hubStyle'
import { DASH } from '../statsFormat'
import { cellText, columnName, minimumLabel, minimumUnitWord } from './boardsFormat'

// docs/specs/147 section 6 and 103 decision 26: one standings table (Batting, Bowling or Fielding) for the Player Hub. Fixed columns come from the
// response, the Sort by select and a tap on a column heading sort on the server (a second tap reverses), competition ranks are the server's, the
// unranked group follows a divider, Show More asks the server for the next page (nothing is sliced here), "More Columns" folds the columns the
// response marks `more`, and Jump to <name> brings the viewer's own row into view. The viewer's row is gold with a left bar, aria-current and a
// screen-reader mark. Phone: the table scrolls sideways with the rank and player columns pinned. A real <table>; names are full names and the
// table has no Share, Copy or Download. Every figure and rank comes from the server.
const RANK_WIDTH = 52
const PLAYER_WIDTH = 150

const headCell = { color: HUB.muted, borderColor: HUB.lineSoft, px: 1, py: 0, fontFamily: HUB.display, fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', bgcolor: DARK_MENU_BG } as const
const bodyCell = { color: HUB.cream, borderColor: HUB.lineSoft, px: 1, py: 0.75, fontSize: 15, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } as const
const pinnedRank = { position: 'sticky', left: 0, zIndex: 2, width: RANK_WIDTH, minWidth: RANK_WIDTH, maxWidth: RANK_WIDTH } as const
const pinnedPlayer = { position: 'sticky', left: RANK_WIDTH, zIndex: 2, minWidth: PLAYER_WIDTH, maxWidth: 220, boxShadow: `1px 0 0 ${HUB.lineSoft}` } as const

export interface BoardTableProps {
  playerKey: string
  group: MyLeaderboardGroup
  scope: MyResultScope
  firstName: string
  // The requested sort (the address): null means the server's default for the group.
  sort: string | null
  direction: MyLeaderboardDirection | null
  onSort: (code: string | null, direction: MyLeaderboardDirection | null) => void
  // Shown instead of the table when no result is counted for the scope.
  empty: ReactNode
  enabled: boolean
}

function SortHead({ label, name, sorted, ascending, onClick }: { label: string; name: string; sorted: boolean; ascending: boolean; onClick: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={`Sort by ${name}`}
      sx={{ minHeight: 44, minWidth: 44, justifyContent: 'flex-end', gap: 0.25, font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: sorted ? HUB.gold : HUB.muted, '&:hover': { color: HUB.cream }, '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: -2 } }}
    >
      {label}
      {sorted && (ascending ? <ArrowUpwardIcon aria-hidden sx={{ fontSize: 14 }} /> : <ArrowDownwardIcon aria-hidden sx={{ fontSize: 14 }} />)}
    </ButtonBase>
  )
}

export function BoardTable({ playerKey, group, scope, firstName, sort, direction, onSort, empty, enabled }: BoardTableProps) {
  const [showMore, setShowMore] = useState(false)
  const [minText, setMinText] = useState('')
  const minimum = useDebouncedValue(minText === '' ? null : Number(minText), 400)
  const [wantJump, setWantJump] = useState(false)
  const mineRow = useRef<HTMLTableRowElement | null>(null)
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')

  const query = useMyLeaderboard(playerKey, group, scope, { sort, direction, minimum: minText === '' ? null : minimum }, enabled)
  const pages = query.data?.pages ?? []
  const first = pages[0]
  const rows = pages.flatMap((page, pageIndex) => page.rows.map((row, rowIndex) => ({ row, key: `${pageIndex}-${rowIndex}` })))

  const columns = first?.columns ?? []
  const sortCode = first?.sort.code ?? sort ?? ''
  const sortColumn = columns.find((column) => column.code === sortCode)
  const shown = columns.filter((column) => !column.more || showMore || column.code === sortCode)
  const hasMore = columns.some((column) => column.more)
  const sortedAscending = first?.sort.direction === 'LOWEST'
  const minimumKind = first?.minimum.unit ?? sortColumn?.minimumKind ?? 'INNINGS'
  const hasMinimum = Boolean(sortColumn && sortColumn.minimumKind !== 'NONE')
  const firstUnranked = rows.findIndex(({ row }) => row.rank === null)

  // Tapping a heading: another column sorts by that column's natural order, the sorted column reverses.
  // A minimum belongs to a rate sort, so it is dropped when the sort moves to a column without one.
  const sortBy = (code: string, next: MyLeaderboardDirection | null) => {
    if (columns.find((column) => column.code === code)?.minimumKind === 'NONE') setMinText('')
    onSort(code, next)
  }
  const chooseColumn = (code: string) => {
    if (code === sortCode && first) sortBy(code, first.sort.direction === 'HIGHEST' ? 'asc' : 'desc')
    else sortBy(code, null)
  }

  const reveal = (): boolean => {
    const element = mineRow.current
    if (!element) return false
    element.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
    element.focus({ preventScroll: true })
    return true
  }
  // After the page that holds the viewer's row has loaded, bring the row into view.
  useEffect(() => {
    if (wantJump && reveal()) setWantJump(false)
  })
  const jump = async () => {
    if (reveal()) return
    const target = first?.me?.page
    if (target === undefined || target === null) return
    setWantJump(true)
    let loaded = pages.length
    let more = Boolean(query.hasNextPage)
    while (more && loaded <= target) {
      const result = await query.fetchNextPage()
      loaded = result.data?.pages.length ?? loaded + 1
      more = Boolean(result.hasNextPage)
    }
    if (loaded <= target) setWantJump(false)
  }

  if (query.isError && !first) {
    return (
      <Alert
        severity="error"
        action={
          <Button variant="secondary" size="compact" onClick={() => void query.refetch()}>
            Retry
          </Button>
        }
      >
        We could not load this table. Please try again.
      </Alert>
    )
  }
  if (!first) {
    return (
      <Box aria-busy="true" data-testid="hub-boards-table-loading" sx={{ display: 'grid', gap: 1 }}>
        <Skeleton variant="rounded" height={44} sx={{ bgcolor: creamAlpha(0.12) }} />
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} variant="rounded" height={40} sx={{ bgcolor: creamAlpha(0.08) }} />
        ))}
      </Box>
    )
  }
  if (first.basis.resultsCounted === 0) return <>{empty}</>

  const basis = first.basis
  const coverage = basis.coverage
  const unit = minimumUnitWord(minimumKind)
  const notes: string[] = [`Based on ${basis.resultsCounted} result${basis.resultsCounted === 1 ? '' : 's'}.`]
  if (coverage && sortCode === 'dots') notes.push(`Dots recorded in ${coverage.used} of ${coverage.counted} bowling innings.`)
  else if (coverage && coverage.used < coverage.counted) notes.push(`Balls and overs recorded in ${coverage.used} of ${coverage.counted} innings.`)
  if (hasMinimum) {
    notes.push('Players below the minimum are listed after the ranked players.')
    if (minimum !== null && basis.belowMinimum > 0) notes.push(`${basis.belowMinimum} player${basis.belowMinimum === 1 ? ' is' : 's are'} below the minimum of ${minimum} ${unit}.`)
  }

  const sortOptions = columns.filter((column) => column.sortable)
  const sortLabel = sortColumn ? columnName(sortColumn) : DASH
  const rowSx = (row: MyLeaderboardRow) =>
    row.mine
      ? { bgcolor: DARK_MENU_BG, backgroundImage: `linear-gradient(${alpha(HUB.gold, 0.24)}, ${alpha(HUB.gold, 0.24)})`, '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: -2 } }
      : { bgcolor: DARK_MENU_BG }

  return (
    <Box data-testid="hub-boards-table" sx={{ display: 'grid', gap: 1.25, minWidth: 0 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Box sx={{ ...darkFieldSx, minWidth: { xs: 150, sm: 190 } }}>
          <Select
            size="small"
            value={sortOptions.some((column) => column.code === sortCode) ? sortCode : ''}
            onChange={(event) => sortBy(event.target.value, null)}
            inputProps={{ 'aria-label': 'Sort by' }}
            MenuProps={darkMenuProps}
            displayEmpty
            renderValue={() => `Sort by: ${sortLabel}`}
            fullWidth
            sx={{ minHeight: 44, '& .MuiSelect-select': { minHeight: 44, display: 'flex', alignItems: 'center', boxSizing: 'border-box', fontFamily: HUB.display, fontSize: 17, letterSpacing: '0.06em' } }}
          >
            {sortOptions.map((column) => (
              <MenuItem key={column.code} value={column.code} sx={{ minHeight: 44 }}>
                {columnName(column)}
              </MenuItem>
            ))}
          </Select>
        </Box>
        {hasMore && (
          <Button
            variant="secondary"
            size="compact"
            aria-pressed={showMore}
            onClick={() => setShowMore((current) => !current)}
            sx={{ ...hubOutlineButton, alignSelf: 'center', minHeight: { xs: 44, md: 32 }, '&::after': { display: 'none' } }}
          >
            More Columns
          </Button>
        )}
        {first.me && (
          <Link component="button" type="button" underline="always" onClick={() => void jump()} data-testid="hub-boards-jump" sx={{ color: HUB.gold, fontSize: 15, minHeight: 44 }}>
            Jump to {firstName}
          </Link>
        )}
      </Box>

      {hasMinimum && (
        <Box sx={{ ...darkFieldSx, width: { xs: '100%', sm: 260 } }}>
          <TextField
            size="small"
            fullWidth
            label={`${minimumLabel(minimumKind)} (optional)`}
            value={minText}
            onChange={(event) => setMinText(event.target.value.replace(/\D/g, '').slice(0, 3))}
            placeholder="No minimum"
            helperText={first.minimum.suggestedDefault !== null ? `Suggested for this scope: ${first.minimum.suggestedDefault}.` : 'Leave empty to list everyone.'}
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
          />
        </Box>
      )}

      {rows.length === 0 ? (
        <Typography data-testid="hub-boards-nobody" sx={{ py: 3, textAlign: 'center', color: HUB.muted }}>
          Nobody is on this table yet. No player has a figure here for this scope.
        </Typography>
      ) : (
        <Box tabIndex={0} role="region" aria-label={`${group} leaderboard, scrolls sideways`} sx={{ overflowX: 'auto', border: `1px solid ${HUB.lineSoft}`, borderRadius: '12px', bgcolor: blackAlpha(0.2), opacity: query.isPlaceholderData ? 0.6 : 1, '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}>
          <Table size="small" aria-label={`${group} leaderboard`} aria-busy={query.isFetching && !query.isFetchingNextPage} sx={{ width: '100%', minWidth: 'max-content', borderCollapse: 'separate' }}>
            <TableHead>
              <TableRow>
                <TableCell component="th" scope="col" align="right" sx={{ ...headCell, ...pinnedRank, py: 1.25 }}>
                  #
                </TableCell>
                <TableCell component="th" scope="col" sx={{ ...headCell, ...pinnedPlayer, py: 1.25 }}>
                  Player
                </TableCell>
                {shown.map((column) => (
                  <TableCell key={column.code} component="th" scope="col" align="right" aria-sort={column.sortable ? (column.code === sortCode ? (sortedAscending ? 'ascending' : 'descending') : 'none') : undefined} sx={{ ...headCell, color: column.code === sortCode ? HUB.gold : HUB.muted }}>
                    {column.sortable ? (
                      <SortHead label={column.label} name={columnName(column)} sorted={column.code === sortCode} ascending={sortedAscending} onClick={() => chooseColumn(column.code)} />
                    ) : (
                      column.label
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(({ row, key }, index) => (
                <Fragment key={key}>
                  {index === firstUnranked && (
                    <TableRow>
                      <TableCell colSpan={shown.length + 2} sx={{ ...bodyCell, color: HUB.muted, fontSize: 13, bgcolor: blackAlpha(0.35) }}>
                        Not ranked: below the minimum, or no figure for this sort yet
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow ref={row.mine ? mineRow : undefined} aria-current={row.mine ? 'true' : undefined} tabIndex={row.mine ? -1 : undefined} data-testid={row.mine ? 'hub-boards-mine' : 'hub-boards-row'} sx={rowSx(row)}>
                    <TableCell align="right" sx={{ ...bodyCell, ...pinnedRank, ...rowSx(row), fontWeight: 700, color: row.rank === null ? HUB.muted : row.rank <= 3 ? HUB.gold : HUB.cream, borderLeft: row.mine ? `4px solid ${HUB.gold}` : '4px solid transparent' }}>
                      {row.rank === null ? DASH : row.rank}
                    </TableCell>
                    <TableCell component="th" scope="row" sx={{ ...bodyCell, ...pinnedPlayer, ...rowSx(row), fontWeight: 600, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                      <Box component="span" sx={{ fontSize: 14, lineHeight: 1.25 }}>
                        {row.firstName} {row.lastName}
                      </Box>
                      {row.mine && <Box component="span" sx={visuallyHiddenSx}> (This player)</Box>}
                      {row.teamName && (
                        <Box component="span" sx={{ display: 'block', fontSize: 11, lineHeight: 1.2, fontWeight: 400, color: HUB.muted }}>
                          {row.teamName}
                        </Box>
                      )}
                      {row.smallSample && (
                        <Box component="span" sx={{ display: 'inline-block', ml: 0.75, px: 0.75, borderRadius: '999px', border: `1px solid ${HUB.line}`, color: HUB.muted, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', lineHeight: '16px' }}>
                          Small sample
                        </Box>
                      )}
                    </TableCell>
                    {shown.map((column) => {
                      const text = cellText(group, column.code, row.values[column.code])
                      return (
                        <TableCell key={column.code} align="right" sx={{ ...bodyCell, ...(column.code === sortCode ? { color: HUB.gold, fontWeight: 700 } : {}), ...(text === DASH ? { color: HUB.muted } : {}) }}>
                          {text}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      <Box data-testid="hub-boards-notes" sx={{ display: 'grid', gap: 0.25 }}>
        {notes.map((note) => (
          <Typography key={note} sx={{ fontSize: 13, color: HUB.muted }}>
            {note}
          </Typography>
        ))}
      </Box>
      {query.hasNextPage && (
        <Button variant="secondary" size="compact" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()} sx={{ ...hubOutlineButton, alignSelf: 'flex-start', minHeight: { xs: 44, md: 32 }, '&::after': { display: 'none' } }}>
          {query.isFetchingNextPage ? 'Loading' : 'Show More'}
        </Button>
      )}
    </Box>
  )
}
