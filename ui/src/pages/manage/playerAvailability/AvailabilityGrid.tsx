import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Box, Chip, Link, Table, TableBody, TableCell, TableFooter, TableHead, TableRow, Typography } from '@mui/material'
import { useFillViewportHeight } from '../../../hooks/useFillViewportHeight'
import { zebraTint } from '../../../utils/zebraTint'
import type { GameColumn, PlayerRow } from '../../../api/playerAvailabilityApi'
import { CELL_MARK_SIZE, CellMark } from './CellMark'
import { ChangeAnswerMenu, canChangeAnswer } from './ChangeAnswerMenu'
import type { ChangeAnswerHandlers } from './useChangeAnswer'
import { GridEmptyState } from './GridEmptyState'
import { Legend } from './Legend'
import {
  COUNT_COL_WIDTH,
  DATE_ROW_HEIGHT,
  GAME_COL_WIDTH,
  SCROLL_BOX_MIN_HEIGHT,
  SLOT_ROW_HEIGHT,
  clampTwoLinesSx,
  headCellSx,
  hoverTint,
  numberSx,
  pinnedHeightSx,
  stickyFirstColSx,
  useFirstColWidth,
} from './gridStyles'
import {
  cellFor,
  cellLabel,
  dateHeading,
  footerCounts,
  footerLabel,
  footerText,
  hasNothingToShow,
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
export { DATE_ROW_HEIGHT, SCROLL_BOX_MIN_HEIGHT, SLOT_ROW_HEIGHT }

export interface AvailabilityGridHandle {
  // Scrolls the grid sideways so the given game's column sits next to the sticky player column.
  scrollToGame: (matchId: string) => void
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
  { games: GameColumn[]; players: PlayerRow[]; now?: Date; changeAnswer?: ChangeAnswerHandlers }
>(function AvailabilityGrid({ games, players, now, changeAnswer }, ref) {
  const navigate = useNavigate()
  const headerRefs = useRef(new Map<string, HTMLElement>())
  const fill = useFillViewportHeight<HTMLDivElement>({ minHeight: SCROLL_BOX_MIN_HEIGHT })

  const groups = useMemo(() => groupGames(games), [games])
  const columns = useMemo(() => orderedGames(groups), [groups])
  const marker = useMemo(() => nextGameDayMarker(groups, now ?? new Date()), [groups, now])

  const { ref: firstColRef, width: firstColWidth } = useFirstColWidth([players, games])

  useImperativeHandle(ref, () => ({
    scrollToGame: (matchId: string) => {
      const element = headerRefs.current.get(matchId)
      // jsdom has no scrollIntoView.
      if (element && typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
      }
    },
  }))

  if (hasNothingToShow(columns)) return <GridEmptyState games={columns} />

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
                <TableCell component="th" scope="row" sx={{ ...stickyFirstColSx, bgcolor: undefined, zIndex: 2, px: 1, py: 0.25 }}>
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
                      // docs/specs/085 (F): with the change handlers a cell that has a poll is a button opening the answer menu;
                      // without them (older callers) a click still opens the poll.
                      onClick={path && !changeAnswer ? () => navigate(path) : undefined}
                      sx={{ px: 0.5, py: { xs: 0.25, sm: 0.5 }, cursor: path && !changeAnswer ? 'pointer' : 'default' }}
                    >
                      {cell && changeAnswer && canChangeAnswer(game, cell) ? (
                        <ChangeAnswerMenu player={player} game={game} cell={cell} handlers={changeAnswer} sx={{ minHeight: { xs: 32, sm: CELL_MARK_SIZE }, minWidth: { xs: 32, sm: CELL_MARK_SIZE }, justifyContent: 'center' }}>
                          <CellMark status={cell.status} picked={cell.picked} />
                        </ChangeAnswerMenu>
                      ) : (
                        cell && <CellMark status={cell.status} picked={cell.picked} label={cellLabel(player, game, cell)} />
                      )}
                    </TableCell>
                  )
                })}
                <TableCell align="center" sx={{ ...numberSx, py: 0.25, borderLeft: 1, borderLeftColor: 'divider' }}>
                  {player.answeredCount}
                </TableCell>
                <TableCell align="center" sx={{ ...numberSx, py: 0.25 }}>
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
                  py: 0.25,
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
                      py: 0.25,
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
