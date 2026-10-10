import { useCallback, useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, ButtonBase, Chip, Link, Table, TableBody, TableCell, TableFooter, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import { useFillViewportHeight } from '../../../hooks/useFillViewportHeight'
import { zebraTint } from '../../../utils/zebraTint'
import type { CellStatus } from '../../../api/playerAvailabilityApi'
import type { TeamSelectionAvailability, TeamSelectionCell, TeamSelectionMatch, TeamSelectionPlayer, TeamSelectionSide } from '../../../api/teamSelectionApi'
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
} from '../playerAvailability/gridStyles'
import { dateHeading, groupGames, kickoffText, nextGameDayMarker, orderedGames, slotLabel } from '../playerAvailability/gridHelpers'
import { CellMark } from '../playerAvailability/CellMark'
import { FIRST_COL_ATTR, slotSnapBoxSx, slotSnapTargetSx, slotStartAttrs } from '../playerAvailability/slotNavigation'
import type { SlotAttrs } from '../playerAvailability/slotNavigation'
import { reasonText } from './pickReasons'
import { selectTeamPath } from './selectionLinks'
import type { PickTarget } from './usePlayerPick'

const playerName = (player: Pick<TeamSelectionPlayer, 'firstName' | 'lastName'>) => `${player.firstName} ${player.lastName}`.trim()
const dayLabel = (match: TeamSelectionMatch) => `${dateHeading(new Date(match.matchDate))} ${slotLabel(match.dayPart)}`

// "Picked 7 / 12" for one side, as shown in the header and the footer of its match column.
const pickedText = (side: TeamSelectionSide) => `${side.pickedCount} / ${side.limits.maxSelected}`

// A derby has two sides in one match, so its cell holds two marks and its column is wider.
const columnWidth = (match: TeamSelectionMatch) => ({ xs: GAME_COL_WIDTH.xs * Math.max(1, match.sides.length), sm: GAME_COL_WIDTH.sm * Math.max(1, match.sides.length) })

const AVAILABILITY_STATUS: Record<TeamSelectionAvailability, CellStatus> = {
  AVAILABLE: 'AVAILABLE',
  UNSURE: 'UNSURE',
  UNAVAILABLE: 'UNAVAILABLE',
  NO_RESPONSE: 'NO_RESPONSE',
  NOT_POLLED: 'NOT_IN_POLL',
}
const AVAILABILITY_TEXT: Record<TeamSelectionAvailability, string> = {
  AVAILABLE: 'Available',
  UNSURE: 'Unsure',
  UNAVAILABLE: 'Unavailable',
  NO_RESPONSE: 'No response',
  NOT_POLLED: 'Not in poll',
}

function cellOf(player: TeamSelectionPlayer, match: TeamSelectionMatch, side: TeamSelectionSide): TeamSelectionCell | undefined {
  return player.cells.find((cell) => cell.matchId === match.matchId && cell.teamId === side.teamId)
}

function PickCell({
  player,
  match,
  side,
  cell,
  busy,
  onToggle,
}: {
  player: TeamSelectionPlayer
  match: TeamSelectionMatch
  side: TeamSelectionSide
  cell: TeamSelectionCell
  busy: boolean
  onToggle: (picked: boolean, target: PickTarget) => void
}) {
  const muted = !cell.picked && !cell.pickable
  const reason = muted ? reasonText(cell.reasonCode) : null
  const who = `${playerName(player)}, ${dayLabel(match)}, ${match.label}${match.sides.length > 1 ? `, ${side.teamName}` : ''}`
  const pickState = cell.picked ? 'picked, click to remove' : muted ? `not picked: ${reason}` : 'not picked, click to pick'
  const state = `${AVAILABILITY_TEXT[cell.availability]}, ${pickState}`
  return (
    <Tooltip title={state} describeChild arrow>
      <ButtonBase
        data-testid={`cell-${player.playerId}-${match.matchId}-${side.teamId}`}
        aria-label={`${who}: ${state}`}
        aria-pressed={cell.picked}
        aria-disabled={muted || busy ? true : undefined}
        data-muted={muted ? 'true' : undefined}
        onClick={() => {
          if (muted || busy) return
          onToggle(cell.picked, { match, side, cell, playerId: player.playerId })
        }}
        sx={{ borderRadius: '50%', p: { xs: 0.75, sm: 0.25 }, opacity: muted ? 0.5 : 1, cursor: muted ? 'not-allowed' : busy ? 'progress' : 'pointer' }}
      >
        <CellMark status={AVAILABILITY_STATUS[cell.availability]} picked={cell.picked} />
      </ButtonBase>
    </Tooltip>
  )
}

function MatchHeader({ match, firstColWidth, slotAttrs }: { match: TeamSelectionMatch; firstColWidth: number; slotAttrs?: SlotAttrs }) {
  const derby = match.sides.length > 1
  return (
    <TableCell
      component="th"
      scope="col"
      {...slotAttrs}
      sx={{
        ...headCellSx,
        top: DATE_ROW_HEIGHT + SLOT_ROW_HEIGHT,
        zIndex: 3,
        minWidth: columnWidth(match),
        maxWidth: columnWidth(match),
        verticalAlign: 'top',
        whiteSpace: 'normal',
        fontWeight: 400,
        px: 0.75,
        scrollMarginLeft: `${firstColWidth}px`,
        ...(slotAttrs ? slotSnapTargetSx : {}),
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, alignItems: 'center' }}>
        <Link
          component={RouterLink}
          to={selectTeamPath(match.matchId, match.sides[0]?.sideId ?? null, match.sides[0]?.home ?? true)}
          title={match.label}
          aria-label={`${match.label}: select team`}
          variant="caption"
          underline="hover"
          sx={clampTwoLinesSx}
        >
          {match.label}
        </Link>
        <Typography variant="caption" color="text.secondary" sx={{ ...numberSx, lineHeight: 1.25 }}>
          {kickoffText(match.matchDate)}
        </Typography>
        {match.sides.map((side) => (
          <Typography key={side.teamId} variant="caption" color="text.secondary" sx={{ ...numberSx, lineHeight: 1.25 }}>
            {derby ? `${side.teamName}: ` : ''}Picked {pickedText(side)}
          </Typography>
        ))}
      </Box>
    </TableCell>
  )
}

export interface PlayersGridProps {
  matches: TeamSelectionMatch[]
  players: TeamSelectionPlayer[]
  busy: boolean
  onToggle: (picked: boolean, target: PickTarget) => void
  now?: Date
  // Hands the grid's scroll box to the Previous / Next slot arrows.
  onScrollBox?: (element: HTMLDivElement | null) => void
}

// docs/specs/093-team-selection-hub.md (Players view): players by match, columns grouped by day and slot. The grid is
// its own scroll box with a sticky player column and sticky headers (the Availability grid's look), which is also the
// phone layout: it scrolls sideways inside the box, never the page.
export function PlayersGrid({ matches, players, busy, onToggle, now, onScrollBox }: PlayersGridProps) {
  const fill = useFillViewportHeight<HTMLDivElement>({ minHeight: SCROLL_BOX_MIN_HEIGHT })
  const fillRef = fill.ref
  const boxRef = useCallback(
    (element: HTMLDivElement | null) => {
      fillRef(element)
      onScrollBox?.(element)
    },
    [fillRef, onScrollBox],
  )
  const first = useFirstColWidth([players, matches])
  const groups = useMemo(() => groupGames(matches), [matches])
  const columns = useMemo(() => orderedGames(groups), [groups])
  const marker = useMemo(() => nextGameDayMarker(groups, now ?? new Date()), [groups, now])
  const slotStarts = useMemo(() => slotStartAttrs(groups, (match) => match.matchId), [groups])

  const footerCellSx = {
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
    ...numberSx,
  } as const

  return (
    <Box
      ref={boxRef}
      role="region"
      aria-label="Team selection players grid, scrolls sideways"
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
        ...slotSnapBoxSx,
      }}
    >
      <Table size="small" aria-label="Players picked by match" sx={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%', ...numberSx }}>
        <TableHead>
          <TableRow>
            <TableCell component="th" scope="col" rowSpan={3} ref={first.ref} {...{ [FIRST_COL_ATTR]: '' }} sx={{ ...stickyFirstColSx, top: 0, zIndex: 5, fontWeight: 600, verticalAlign: 'bottom' }}>
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
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, position: 'sticky', left: first.width + 8 }}>
                  <span>{dateHeading(group.date)}</span>
                  {marker?.dateKey === group.dateKey && (
                    <Chip size="small" label={marker.text} color="primary" sx={{ height: 20, fontSize: 11, fontWeight: 600 }} />
                  )}
                </Box>
              </TableCell>
            ))}
            <TableCell component="th" scope="col" rowSpan={3} sx={{ ...headCellSx, top: 0, zIndex: 3, width: COUNT_COL_WIDTH, minWidth: COUNT_COL_WIDTH, verticalAlign: 'bottom', borderLeft: 1, borderLeftColor: 'divider' }}>
              Picked
            </TableCell>
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
            {columns.map((match) => (
              <MatchHeader key={match.matchId} match={match} firstColWidth={first.width} slotAttrs={slotStarts.get(match.matchId)} />
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {players.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length + 2}>
                <Typography variant="body2" color="text.secondary">
                  No players to show.
                </Typography>
              </TableCell>
            </TableRow>
          )}
          {players.map((player) => (
            <TableRow
              key={player.playerId}
              sx={{
                '& > th, & > td': { bgcolor: 'background.paper' },
                '&:nth-of-type(odd) > th, &:nth-of-type(odd) > td': { bgcolor: zebraTint },
                '&:hover > th, &:hover > td': { bgcolor: hoverTint },
              }}
            >
              <TableCell component="th" scope="row" sx={{ ...stickyFirstColSx, bgcolor: undefined, zIndex: 2, px: 1, py: 0.25 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
                  {playerName(player)}
                </Typography>
              </TableCell>
              {columns.map((match) => (
                <TableCell key={match.matchId} align="center" sx={{ px: 0.5, py: 0.25 }}>
                  <Box sx={{ display: 'inline-flex', gap: 1 }}>
                    {match.sides.map((side) => {
                      const cell = cellOf(player, match, side)
                      return cell ? <PickCell key={side.teamId} player={player} match={match} side={side} cell={cell} busy={busy} onToggle={onToggle} /> : null
                    })}
                  </Box>
                </TableCell>
              ))}
              <TableCell align="center" sx={{ ...numberSx, py: 0.25, borderLeft: 1, borderLeftColor: 'divider' }}>
                {player.pickedCount}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>

        <TableFooter>
          <TableRow>
            <TableCell component="th" scope="row" sx={{ ...stickyFirstColSx, bottom: 0, zIndex: 5, px: 1, py: 0.25, fontWeight: 600, fontSize: 11, lineHeight: 1.2, borderTop: 1, borderTopColor: 'divider' }}>
              Picked / max
            </TableCell>
            {columns.map((match) => (
              <TableCell key={match.matchId} align="center" sx={footerCellSx}>
                {match.sides.map((side) => (
                  <Box key={side.teamId} component="div" sx={{ fontSize: 'inherit' }}>
                    {pickedText(side)}
                  </Box>
                ))}
              </TableCell>
            ))}
            <TableCell sx={footerCellSx} />
          </TableRow>
        </TableFooter>
      </Table>
    </Box>
  )
}
