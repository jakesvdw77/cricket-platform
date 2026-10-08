import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Box, Chip, Link, Table, TableBody, TableCell, TableFooter, TableHead, TableRow, Typography } from '@mui/material'
import { alpha, darken, lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import type { SystemStyleObject } from '@mui/system'
import { EmptyState } from '../../../components/EmptyState'
import { useFillViewportHeight } from '../../../hooks/useFillViewportHeight'
import type { GameColumn, PlayerRow } from '../../../api/playerAvailabilityApi'
import { CellMark } from './CellMark'
import { Legend } from './Legend'
import {
  cellFor,
  cellLabel,
  dateHeading,
  footerCounts,
  footerLabel,
  footerText,
  groupGames,
  kickoffText,
  nextGameDayMarker,
  openPollPath,
  orderedGames,
  playerFullName,
  pollPath,
  slotLabel,
} from './gridHelpers'

// docs/specs/068: the grid is its own scroll box (both axes) so the page body never scrolls
// sideways. Header rows are sticky at fixed heights so each row can offset the one above it.
// docs/specs/085 (D1): its height is measured (useFillViewportHeight) so the box ends at the bottom of the window and
// the page itself does not scroll; below SCROLL_BOX_MIN_HEIGHT the page scrolls instead.
export const SCROLL_BOX_MIN_HEIGHT = 150
export const DATE_ROW_HEIGHT = 34
export const SLOT_ROW_HEIGHT = 26
// The player column sizes to its content between these bounds; the real width is measured at runtime
// (see firstColWidth) so the sticky date headers and scrollToGame offsets clear it exactly.
const FIRST_COL_MIN_WIDTH = { xs: 150, sm: 180 }
const FIRST_COL_MAX_WIDTH = 320
const GAME_COL_WIDTH = { xs: 104, sm: 128 }
const COUNT_COL_WIDTH = 64

export interface AvailabilityGridHandle {
  // Scrolls the grid sideways so the given game's column sits next to the sticky player column.
  scrollToGame: (matchId: string) => void
}

const stickyFirstColSx: SystemStyleObject<Theme> = {
  position: 'sticky',
  left: 0,
  bgcolor: 'background.paper',
  width: 'max-content',
  minWidth: FIRST_COL_MIN_WIDTH,
  maxWidth: FIRST_COL_MAX_WIDTH,
  // The right-hand edge reads as a divider with a soft shadow, so scrolled columns visibly pass under it.
  boxShadow: (theme: Theme) => `inset -1px 0 0 ${theme.palette.divider}, 2px 0 4px ${alpha(theme.palette.text.primary, 0.06)}`,
}

const headCellSx: SystemStyleObject<Theme> = {
  position: 'sticky',
  bgcolor: 'background.paper',
  fontWeight: 600,
  p: 0.5,
  whiteSpace: 'nowrap',
  textAlign: 'center',
}

// Opaque tints (never alpha) so the sticky player cell never lets scrolled content show through.
const zebraTint = (theme: Theme) => lighten(theme.palette.primary.main, 0.95)
const hoverTint = (theme: Theme) =>
  theme.palette.mode === 'dark' ? darken(theme.palette.primary.main, 0.6) : lighten(theme.palette.primary.main, 0.86)

const numberSx = { fontVariantNumeric: 'tabular-nums' }

// A sticky header row whose height cannot grow: the cell's border-box height is pinned to the
// constant (TableRow height is only a minimum) and its content clipped, so the next sticky row's
// `top` (the exact sum of the pinned heights above it) never overlaps or leaves a gap.
function pinnedHeightSx(height: number): SystemStyleObject<Theme> {
  return { height, maxHeight: height, boxSizing: 'border-box', py: 0, lineHeight: `${height}px`, overflow: 'clip' }
}

const clampTwoLinesSx = {
  fontWeight: 600,
  lineHeight: 1.25,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  wordBreak: 'break-word',
}

function GameHeader({
  game,
  headerRef,
  firstColWidth,
}: {
  game: GameColumn
  headerRef: (element: HTMLElement | null) => void
  firstColWidth: number
}) {
  const path = pollPath(game)
  return (
    <TableCell
      component="th"
      scope="col"
      ref={headerRef}
      sx={{
          ...headCellSx,
          top: DATE_ROW_HEIGHT + SLOT_ROW_HEIGHT,
          zIndex: 3,
          minWidth: GAME_COL_WIDTH,
          maxWidth: GAME_COL_WIDTH,
          verticalAlign: 'top',
          whiteSpace: 'normal',
          fontWeight: 400,
          px: 0.75,
          // So scrollIntoView lands the column just right of the sticky player column.
          scrollMarginLeft: `${firstColWidth}px`,
        }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, alignItems: 'center' }}>
        {path ? (
          <Link
            component={RouterLink}
            to={path}
            title={game.label}
            aria-label={`${game.label}: open poll`}
            variant="caption"
            underline="hover"
            sx={clampTwoLinesSx}
          >
            {game.label}
          </Link>
        ) : (
          <>
            <Typography variant="caption" title={game.label} sx={clampTwoLinesSx}>
              {game.label}
            </Typography>
            <Link
              component={RouterLink}
              to={openPollPath(game)}
              aria-label={`Open a poll for ${game.label}`}
              variant="caption"
              underline="always"
              sx={{ lineHeight: 1.25 }}
            >
              Open a poll
            </Link>
          </>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ ...numberSx, lineHeight: 1.25 }}>
          {kickoffText(game.matchDate)}
        </Typography>
        {game.leagueName && (
          <Typography
            variant="caption"
            color="text.secondary"
            title={game.leagueName}
            sx={{ lineHeight: 1.25, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {game.leagueName}
          </Typography>
        )}
      </Box>
    </TableCell>
  )
}

// Read-only (docs/specs/068 non-goals): a cell opens the game's poll, it never edits an answer.
// Cells are deliberately not focusable (no thousands of tab stops); each game's column header is
// the keyboard-reachable link.
export const AvailabilityGrid = forwardRef<
  AvailabilityGridHandle,
  { games: GameColumn[]; players: PlayerRow[]; now?: Date }
>(function AvailabilityGrid({ games, players, now }, ref) {
  const navigate = useNavigate()
  const headerRefs = useRef(new Map<string, HTMLElement>())
  const firstColRef = useRef<HTMLTableCellElement>(null)
  const [firstColWidth, setFirstColWidth] = useState<number>(FIRST_COL_MIN_WIDTH.sm)
  const fill = useFillViewportHeight<HTMLDivElement>({ minHeight: SCROLL_BOX_MIN_HEIGHT })

  const groups = useMemo(() => groupGames(games), [games])
  const columns = useMemo(() => orderedGames(groups), [groups])
  const marker = useMemo(() => nextGameDayMarker(groups, now ?? new Date()), [groups, now])

  // The player column is content-sized, so measure it: the sticky date labels and the scroll margin
  // need its real width to sit just right of it.
  useLayoutEffect(() => {
    const element = firstColRef.current
    if (!element) return undefined
    const measure = () => {
      const width = Math.round(element.getBoundingClientRect().width)
      if (width > 0) setFirstColWidth(width)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [players, games])

  useImperativeHandle(ref, () => ({
    scrollToGame: (matchId: string) => {
      const element = headerRefs.current.get(matchId)
      // jsdom has no scrollIntoView.
      if (element && typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
      }
    },
  }))

  if (games.length === 0) {
    return (
      <EmptyState
        title="No games match these filters"
        description="Try a different season, league, section or team, or turn on Show past games."
      />
    )
  }

  if (columns.every((game) => game.pollType === null)) {
    return (
      <EmptyState
        title="No polls opened yet for these games"
        description="Open an availability poll and the answers will appear here."
        action={
          <Link component={RouterLink} to="/manage/availability" underline="always">
            Go to Availability Polls
          </Link>
        }
      />
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Legend />
      <Box
        ref={fill.ref}
        role="region"
        aria-label="Player availability grid, scrolls sideways"
        tabIndex={0}
        sx={{
          overflow: 'auto',
          height: fill.height,
          minHeight: SCROLL_BOX_MIN_HEIGHT,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          overscrollBehavior: 'contain',
        }}
      >
        <Table
          size="small"
          aria-label="Player availability by game"
          sx={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%', fontVariantNumeric: 'tabular-nums' }}
        >
          <TableHead>
            <TableRow>
              <TableCell
                component="th"
                scope="col"
                rowSpan={3}
                ref={firstColRef}
                sx={{ ...stickyFirstColSx, top: 0, zIndex: 5, fontWeight: 600, verticalAlign: 'bottom' }}
              >
                Player
              </TableCell>
              {groups.map((group) => (
                <TableCell
                  key={group.dateKey}
                  component="th"
                  scope="colgroup"
                  colSpan={group.gameCount}
                  sx={{ ...headCellSx, ...pinnedHeightSx(DATE_ROW_HEIGHT), top: 0, zIndex: 3, textAlign: 'left', borderLeft: 1, borderLeftColor: 'divider', px: 1 }}
                >
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 1,
                      position: 'sticky',
                      left: firstColWidth + 8,
                    }}
                  >
                    <span>{dateHeading(group.date)}</span>
                    {marker?.dateKey === group.dateKey && (
                      <Chip size="small" label={marker.text} color="primary" sx={{ height: 20, fontSize: 11, fontWeight: 600 }} />
                    )}
                  </Box>
                </TableCell>
              ))}
              {(['Answered', 'Picked'] as const).map((title) => (
                <TableCell
                  key={title}
                  component="th"
                  scope="col"
                  rowSpan={3}
                  sx={{ ...headCellSx, top: 0, zIndex: 3, width: COUNT_COL_WIDTH, minWidth: COUNT_COL_WIDTH, verticalAlign: 'bottom', borderLeft: 1, borderLeftColor: 'divider' }}
                >
                  {title}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              {groups.flatMap((group) =>
                group.slots.map((slot) => (
                  <TableCell
                    key={`${group.dateKey}-${slot.dayPart}`}
                    component="th"
                    scope="colgroup"
                    colSpan={slot.games.length}
                    aria-label={slotLabel(slot.dayPart)}
                    sx={{ ...headCellSx, ...pinnedHeightSx(SLOT_ROW_HEIGHT), top: DATE_ROW_HEIGHT, zIndex: 3, color: 'text.secondary', borderLeft: 1, borderLeftColor: 'divider' }}
                  >
                    <Box component="span" aria-hidden sx={{ display: { xs: 'none', sm: 'inline' } }}>
                      {slotLabel(slot.dayPart)}
                    </Box>
                    <Box component="span" aria-hidden sx={{ display: { xs: 'inline', sm: 'none' } }}>
                      {slotLabel(slot.dayPart, true)}
                    </Box>
                  </TableCell>
                )),
              )}
            </TableRow>
            <TableRow>
              {columns.map((game) => (
                <GameHeader
                  key={game.matchId}
                  game={game}
                  firstColWidth={firstColWidth}
                  headerRef={(element) => {
                    if (element) headerRefs.current.set(game.matchId, element)
                    else headerRefs.current.delete(game.matchId)
                  }}
                />
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {players.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 3}>
                  <Typography variant="body2" color="text.secondary">
                    No players to show.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {players.map((player) => (
              <TableRow
                key={player.playerProfileId}
                sx={{
                  // Every cell (incl. the sticky name cell) gets an opaque background: paper, or a
                  // very light primary tint on odd rows (the first body row is tinted; header and footer rows live in thead/tfoot, so they never shift it); hover is a slightly stronger opaque tint.
                  '& > th, & > td': { bgcolor: 'background.paper' },
                  '&:nth-of-type(odd) > th, &:nth-of-type(odd) > td': { bgcolor: zebraTint },
                  '&:hover > th, &:hover > td': { bgcolor: hoverTint },
                }}
              >
                <TableCell component="th" scope="row" sx={{ ...stickyFirstColSx, bgcolor: undefined, zIndex: 2, px: 1, py: 0.75 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
                    {playerFullName(player)}
                  </Typography>
                </TableCell>
                {columns.map((game) => {
                  const cell = cellFor(player, game.matchId)
                  const path = pollPath(game)
                  return (
                    <TableCell
                      key={game.matchId}
                      data-testid={`cell-${player.playerProfileId}-${game.matchId}`}
                      align="center"
                      onClick={path ? () => navigate(path) : undefined}
                      sx={{ px: 0.5, py: 0.75, cursor: path ? 'pointer' : 'default' }}
                    >
                      {cell && <CellMark status={cell.status} picked={cell.picked} label={cellLabel(player, game, cell)} />}
                    </TableCell>
                  )
                })}
                <TableCell align="center" sx={{ ...numberSx, borderLeft: 1, borderLeftColor: 'divider' }}>
                  {player.answeredCount}
                </TableCell>
                <TableCell align="center" sx={numberSx}>
                  {player.pickedCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>

          <TableFooter>
            <TableRow>
              <TableCell
                component="th"
                scope="row"
                sx={{
                  ...stickyFirstColSx,
                  bottom: 0,
                  zIndex: 5,
                  px: 1,
                  py: 0.75,
                  fontWeight: 600,
                  fontSize: 11,
                  lineHeight: 1.2,
                  borderTop: 1,
                  borderTopColor: 'divider',
                }}
              >
                Available / Unsure / Unavailable
              </TableCell>
              {columns.map((game) => {
                const counts = footerCounts(players, game.matchId)
                return (
                  <TableCell
                    key={game.matchId}
                    align="center"
                    aria-label={footerLabel(counts)}
                    sx={{
                      position: 'sticky',
                      bottom: 0,
                      zIndex: 3,
                      bgcolor: 'background.paper',
                      px: 0.5,
                      py: 0.75,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      borderTop: 1,
                      borderTopColor: 'divider',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {footerText(counts)}
                  </TableCell>
                )
              })}
              <TableCell
                colSpan={2}
                sx={{ position: 'sticky', bottom: 0, zIndex: 3, bgcolor: 'background.paper', borderTop: 1, borderTopColor: 'divider' }}
              />
            </TableRow>
          </TableFooter>
        </Table>
      </Box>
    </Box>
  )
})
