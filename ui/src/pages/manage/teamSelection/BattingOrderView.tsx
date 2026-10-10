import { useCallback, useEffect, useMemo, useState } from 'react'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import { Alert, Box, IconButton, Link, Button as MuiButton, Menu, MenuItem, Table, TableBody, TableCell, TableFooter, TableHead, TableRow, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { CompactSwitch } from '../../../components/CompactSwitch'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { SelectionGauge } from '../../../components/SelectionGauge'
import type { TeamSelectionMatch, TeamSelectionPick, TeamSelectionPlayer, TeamSelectionSide } from '../../../api/teamSelectionApi'
import { useFillViewportHeight } from '../../../hooks/useFillViewportHeight'
import { zebraTint } from '../../../utils/zebraTint'
import {
  DATE_ROW_HEIGHT,
  GAME_COL_WIDTH,
  SCROLL_BOX_MIN_HEIGHT,
  SLOT_ROW_HEIGHT,
  headCellSx,
  hoverTint,
  numberSx,
  pinnedHeightSx,
  stickyFirstColSx,
  useFirstColWidth,
} from '../playerAvailability/gridStyles'
import { dateHeading, groupGames, kickoffText, orderedGames, slotLabel } from '../playerAvailability/gridHelpers'
import { SlotNavigator } from '../playerAvailability/SlotNavigator'
import { FIRST_COL_ATTR, slotSnapBoxSx, slotSnapTargetSx, slotStartAttrs } from '../playerAvailability/slotNavigation'
import { useTeamSelectionHub } from './hubContext'
import { MatchesFrame } from './MatchesFrame'
import { PickedName } from './PickedName'
import { selectTeamPath } from './selectionLinks'
import { useAnnounceSide } from './useAnnounceSide'
import { usePlayerPick } from './usePlayerPick'

// One matrix column: a club side of a match (a derby has two columns for its one match).
interface Column {
  match: TeamSelectionMatch
  side: TeamSelectionSide
}

interface AddTarget extends Column {
  position: number
  anchor: HTMLElement
}

// Compact footer action: small, one line, so Select players and Announce sit side by side.
// The Position column only holds a number or "12th man", so it is far narrower than the Players grid's name column.
const POSITION_COL = { width: 84, minWidth: 84, maxWidth: 84 } as const

const footActionSx = { whiteSpace: 'nowrap', minHeight: 24, py: 0.125, px: 1, fontSize: '0.6875rem', lineHeight: 1.5 } as const

const fullColumnWidth = { xs: GAME_COL_WIDTH.xs + 16, sm: GAME_COL_WIDTH.sm + 24 }
// Short names are short enough for a narrower match column.
const narrowColumnWidth = { xs: GAME_COL_WIDTH.xs + 16, sm: 140 }
// The match header cell: label, kickoff and the gauge line, every column the same height. Nothing sticky sits below it,
// so DATE_ROW_HEIGHT and SLOT_ROW_HEIGHT (the rows above it) still give its sticky `top` exactly.
const MATCH_HEAD_HEIGHT = 58

const SHORT_NAMES_KEY = 'teamSelection:battingShortNames'
function readShortNames(): boolean {
  try {
    return localStorage.getItem(SHORT_NAMES_KEY) === 'true'
  } catch {
    return false
  }
}
function writeShortNames(value: boolean) {
  try {
    localStorage.setItem(SHORT_NAMES_KEY, String(value))
  } catch {
    // storage unavailable: the choice just lasts for this visit
  }
}

// "J van der Westhuizen": the first initial, then everything after the first name token.
function shortName(player: Pick<TeamSelectionPlayer, 'firstName' | 'lastName'>): string {
  const [first = '', ...rest] = `${player.firstName} ${player.lastName}`.trim().split(/\s+/)
  return rest.length === 0 ? first : `${first.charAt(0)} ${rest.join(' ')}`
}
const nameOf = (player: Pick<TeamSelectionPlayer, 'firstName' | 'lastName'>) => `${player.firstName} ${player.lastName}`.trim()
const columnLabel = ({ match, side }: Column) => `${match.label}${match.sides.length > 1 ? `, ${side.teamName}` : ''}`

// The players the overview says can be picked for this match and side (not picked yet, no rule against them).
function eligiblePlayers(players: TeamSelectionPlayer[], { match, side }: Column): TeamSelectionPlayer[] {
  return players.filter((player) =>
    player.cells.some((cell) => cell.matchId === match.matchId && cell.teamId === side.teamId && cell.pickable && !cell.picked),
  )
}

// Which sides are in reorder edit mode. Keyed by side id (not by the announced flag), so the refetch that follows the
// first move, which un-announces the side, leaves the edit session alone. Not persisted: it resets on leaving the page.
function useReorderEditing() {
  const [editing, setEditing] = useState<ReadonlySet<string>>(new Set())
  const start = useCallback((sideId: string) => setEditing((current) => new Set(current).add(sideId)), [])
  const stop = useCallback(
    (sideId: string) =>
      setEditing((current) => {
        const next = new Set(current)
        next.delete(sideId)
        return next
      }),
    [],
  )
  // Drops edit state for sides that are no longer in the data.
  const keepOnly = useCallback(
    (sideIds: ReadonlySet<string>) =>
      setEditing((current) => {
        const next = new Set([...current].filter((id) => sideIds.has(id)))
        return next.size === current.size ? current : next
      }),
    [],
  )
  return { editing, start, stop, keepOnly }
}

// A column in edit mode gets a 2 px primary outline down its left and right edges.
const editedColumnSx = { boxShadow: (theme: { palette: { primary: { main: string } } }) => `inset 2px 0 0 ${theme.palette.primary.main}, inset -2px 0 0 ${theme.palette.primary.main}` } as const

function BattingMatrix({
  matches,
  busy,
  onAdd,
  onMove,
  announcingSideId,
  onAnnounce,
  editing,
  onToggleEdit,
  onKeepEditing,
  shortNames,
  onScrollBox,
}: {
  matches: TeamSelectionMatch[]
  busy: boolean
  onAdd: (target: AddTarget) => void
  onMove: (match: TeamSelectionMatch, side: TeamSelectionSide, playerId: string, direction: -1 | 1) => void
  announcingSideId: string | null
  onAnnounce: (match: TeamSelectionMatch, side: TeamSelectionSide) => void
  editing: ReadonlySet<string>
  onToggleEdit: (match: TeamSelectionMatch, side: TeamSelectionSide) => void
  onKeepEditing: (sideIds: ReadonlySet<string>) => void
  shortNames: boolean
  onScrollBox: (element: HTMLDivElement | null) => void
}) {
  const fill = useFillViewportHeight<HTMLDivElement>({ minHeight: SCROLL_BOX_MIN_HEIGHT })
  const fillRef = fill.ref
  const boxRef = useCallback(
    (element: HTMLDivElement | null) => {
      fillRef(element)
      onScrollBox(element)
    },
    [fillRef, onScrollBox],
  )
  const first = useFirstColWidth([matches])
  const groups = useMemo(() => groupGames(matches), [matches])
  const games = useMemo(() => orderedGames(groups), [groups])
  const slotStarts = useMemo(() => slotStartAttrs(groups, (match) => match.matchId), [groups])
  const columns: Column[] = useMemo(() => games.flatMap((match) => match.sides.map((side) => ({ match, side }))), [games])
  useEffect(() => {
    onKeepEditing(new Set(columns.flatMap(({ side }) => (side.sideId === null ? [] : [side.sideId]))))
  }, [columns, onKeepEditing])
  const isEditing = ({ side }: Column) => side.sideId !== null && editing.has(side.sideId)
  const editSx = (column: Column) => (isEditing(column) ? editedColumnSx : {})
  const rows = Math.max(1, ...columns.map(({ side }) => side.limits.battingPlaces))
  const positions = Array.from({ length: rows }, (_, index) => index + 1)
  const showUnpositioned = columns.some(({ side }) => side.picks.some((pick) => pick.battingOrder == null && !pick.twelfthMan))
  const slotColumnCount = (slotGames: TeamSelectionMatch[]) => slotGames.reduce((total, match) => total + match.sides.length, 0)

  const columnWidth = shortNames ? narrowColumnWidth : fullColumnWidth
  // The short form of a pick, unless another pick in the same column would look the same (then the full name).
  const labelOf = ({ side }: Column, pick: TeamSelectionPick): string | undefined => {
    if (!shortNames) return undefined
    const short = shortName(pick)
    return side.picks.filter((other) => shortName(other) === short).length > 1 ? undefined : short
  }

  const rowSx = {
    '& > th, & > td': { bgcolor: 'background.paper' },
    '&:nth-of-type(odd) > th, &:nth-of-type(odd) > td': { bgcolor: zebraTint },
    '&:hover > th, &:hover > td': { bgcolor: hoverTint },
  } as const
  const rowHeadSx = { ...stickyFirstColSx, ...POSITION_COL, bgcolor: undefined, zIndex: 2, px: 1, py: 0.375 } as const
  const bodyCellSx = { px: 0.75, py: 0.375, minWidth: columnWidth, maxWidth: columnWidth, verticalAlign: 'middle' } as const
  const footCellSx = { position: 'sticky', bottom: 0, zIndex: 3, bgcolor: 'background.paper', borderTop: 1, borderTopColor: 'divider', px: 0.75, py: 0.75 } as const

  const arrowSx = { p: 0.25, fontSize: 18 } as const
  const lastFilled = ({ side }: Column) =>
    Math.max(0, ...side.picks.filter((pick) => !pick.twelfthMan).map((pick) => pick.battingOrder ?? 0))
  const pickAt = ({ side }: Column, position: number) => side.picks.find((pick) => pick.battingOrder === position)

  return (
    <Box
      ref={boxRef}
      role="region"
      aria-label="Batting order matrix, scrolls sideways"
      tabIndex={0}
      sx={{ overflow: 'auto', height: fill.height, minHeight: SCROLL_BOX_MIN_HEIGHT, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', overscrollBehavior: 'contain', ...slotSnapBoxSx }}
    >
      <Table size="small" aria-label="Batting order by match" sx={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%', ...numberSx }}>
        <TableHead>
          <TableRow>
            <TableCell component="th" scope="col" rowSpan={3} ref={first.ref} {...{ [FIRST_COL_ATTR]: '' }} sx={{ ...stickyFirstColSx, ...POSITION_COL, top: 0, zIndex: 5, fontWeight: 600, verticalAlign: 'bottom' }}>
              Position
            </TableCell>
            {groups.map((group) => (
              <TableCell
                key={group.dateKey}
                component="th"
                scope="colgroup"
                colSpan={group.slots.reduce((total, slot) => total + slotColumnCount(slot.games), 0)}
                sx={{ ...headCellSx, ...pinnedHeightSx(DATE_ROW_HEIGHT), top: 0, zIndex: 3, textAlign: 'left', borderLeft: 1, borderLeftColor: 'divider', px: 1 }}
              >
                <Box component="span" sx={{ position: 'sticky', left: first.width + 8 }}>
                  {dateHeading(group.date)}
                </Box>
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
                  colSpan={slotColumnCount(slot.games)}
                  sx={{ ...headCellSx, ...pinnedHeightSx(SLOT_ROW_HEIGHT), top: DATE_ROW_HEIGHT, zIndex: 3, color: 'text.secondary', borderLeft: 1, borderLeftColor: 'divider' }}
                >
                  {slotLabel(slot.dayPart)}
                </TableCell>
              )),
            )}
          </TableRow>
          <TableRow>
            {columns.map((column) => {
              const { match, side } = column
              const max = side.limits.maxSelected
              // Only a match's first side column can start a group.
              const slotAttrs = side === match.sides[0] ? slotStarts.get(match.matchId) : undefined
              return (
                <TableCell
                  key={`${match.matchId}:${side.teamId}`}
                  component="th"
                  scope="col"
                  {...slotAttrs}
                  sx={{ ...headCellSx, ...pinnedHeightSx(MATCH_HEAD_HEIGHT), py: 0.5, lineHeight: 'normal', top: DATE_ROW_HEIGHT + SLOT_ROW_HEIGHT, zIndex: 3, ...editSx(column), minWidth: columnWidth, maxWidth: columnWidth, verticalAlign: 'top', whiteSpace: 'normal', fontWeight: 400, px: 0.75, scrollMarginLeft: `${first.width}px`, ...(slotAttrs ? slotSnapTargetSx : {}) }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Link
                      component={RouterLink}
                      to={selectTeamPath(match.matchId, side.sideId, side.home)}
                      title={columnLabel(column)}
                      aria-label={`${columnLabel(column)}: select team`}
                      variant="caption"
                      underline="hover"
                      noWrap
                      sx={{ fontWeight: 600, lineHeight: 1.25, display: 'block' }}
                    >
                      {columnLabel(column)}
                    </Link>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ ...numberSx, lineHeight: 1.25, display: 'block' }}>
                      {kickoffText(match.matchDate)}
                    </Typography>
                    <SelectionGauge
                      compact
                      picked={side.pickedCount}
                      size={max}
                      ariaLabel={`${side.teamName} selection, ${side.pickedCount} of ${max} picked`}
                      testIdPrefix={`batting-gauge-${match.matchId}-${side.teamId}`}
                    />
                  </Box>
                </TableCell>
              )
            })}
          </TableRow>
        </TableHead>

        <TableBody>
          {positions.map((position) => (
            <TableRow key={position} sx={rowSx}>
              <TableCell component="th" scope="row" sx={rowHeadSx}>
                <Typography variant="body2" sx={{ fontWeight: 600, ...numberSx }}>
                  {position}
                </Typography>
              </TableCell>
              {columns.map((column) => {
                const { match, side } = column
                const pick = pickAt(column, position)
                const open = !pick && position <= side.limits.battingPlaces
                return (
                  <TableCell key={`${match.matchId}:${side.teamId}`} sx={{ ...bodyCellSx, ...editSx(column) }} data-testid={`batting-cell-${match.matchId}-${side.teamId}-${position}`}>
                    {pick && (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.25 }}>
                        <PickedName pick={pick} displayName={labelOf(column, pick)} />
                        {isEditing(column) && (
                          <Box sx={{ display: 'inline-flex', flexShrink: 0 }}>
                            <IconButton
                              size="small"
                              disabled={busy || position === 1}
                              data-testid={`move-up-${match.matchId}-${side.teamId}-${position}`}
                              aria-label={`Move ${nameOf(pick)} up, ${columnLabel(column)}`}
                              onClick={() => onMove(match, side, pick.playerId, -1)}
                              sx={arrowSx}
                            >
                              <ArrowUpward fontSize="inherit" />
                            </IconButton>
                            <IconButton
                              size="small"
                              disabled={busy || position === lastFilled(column)}
                              data-testid={`move-down-${match.matchId}-${side.teamId}-${position}`}
                              aria-label={`Move ${nameOf(pick)} down, ${columnLabel(column)}`}
                              onClick={() => onMove(match, side, pick.playerId, 1)}
                              sx={arrowSx}
                            >
                              <ArrowDownward fontSize="inherit" />
                            </IconButton>
                          </Box>
                        )}
                      </Box>
                    )}
                    {open && (
                      <MuiButton
                        size="small"
                        disabled={busy}
                        data-testid={`add-${match.matchId}-${side.teamId}-${position}`}
                        aria-label={`Add a player at position ${position}, ${columnLabel(column)}`}
                        onClick={(event) => onAdd({ ...column, position, anchor: event.currentTarget })}
                        sx={{ minWidth: 0, minHeight: 26, py: 0, px: 0.75, fontSize: '0.75rem', lineHeight: 1.5, whiteSpace: 'nowrap' }}
                      >
                        + Add
                      </MuiButton>
                    )}
                    {!pick && !open && (
                      <Typography variant="body2" color="text.disabled" aria-hidden>
                        -
                      </Typography>
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
          <TableRow sx={rowSx}>
            <TableCell component="th" scope="row" sx={rowHeadSx}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                12th man
              </Typography>
            </TableCell>
            {columns.map((column) => {
              const { match, side } = column
              const twelfth = side.picks.find((pick) => pick.twelfthMan)
              return (
                <TableCell key={`${match.matchId}:${side.teamId}`} sx={{ ...bodyCellSx, ...editSx(column) }} data-testid={`batting-twelfth-${match.matchId}-${side.teamId}`}>
                  {twelfth ? (
                    <PickedName pick={twelfth} displayName={labelOf({ match, side }, twelfth)} />
                  ) : (
                    <Typography variant="body2" color="text.disabled" aria-hidden>
                      -
                    </Typography>
                  )}
                </TableCell>
              )
            })}
          </TableRow>
          {showUnpositioned && (
            <TableRow sx={rowSx}>
              <TableCell component="th" scope="row" sx={rowHeadSx}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  No position
                </Typography>
              </TableCell>
              {columns.map((column) => {
                const { match, side } = column
                return (
                <TableCell key={`${match.matchId}:${side.teamId}`} sx={{ ...bodyCellSx, ...editSx(column) }} data-testid={`batting-unpositioned-${match.matchId}-${side.teamId}`}>
                  {side.picks
                    .filter((pick) => pick.battingOrder == null && !pick.twelfthMan)
                    .map((pick) => (
                      <Box key={pick.playerId}>
                        <PickedName pick={pick} displayName={labelOf({ match, side }, pick)} />
                      </Box>
                    ))}
                </TableCell>
                )
              })}
            </TableRow>
          )}
        </TableBody>

        <TableFooter>
          <TableRow>
            <TableCell component="th" scope="row" sx={{ ...stickyFirstColSx, ...POSITION_COL, bottom: 0, zIndex: 5, px: 1, py: 0.75, fontWeight: 600, verticalAlign: 'top', borderTop: 1, borderTopColor: 'divider' }}>
              Actions
            </TableCell>
            {columns.map((column) => {
              const { match, side } = column
              const canAnnounce = side.status === 'READY_TO_ANNOUNCE' && side.sideId !== null
              return (
                <TableCell key={`${match.matchId}:${side.teamId}`} sx={{ ...footCellSx, ...editSx(column), verticalAlign: 'top' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
                    <MuiButton
                      size="small"
                      variant="outlined"
                      component={RouterLink}
                      to={selectTeamPath(match.matchId, side.sideId, side.home)}
                      aria-label={`Select players, ${columnLabel(column)}`}
                      sx={footActionSx}
                    >
                      Select players
                    </MuiButton>
                    {side.sideId !== null && side.picks.length >= 2 && (
                      <MuiButton
                        size="small"
                        variant={isEditing(column) ? 'contained' : 'outlined'}
                        aria-pressed={isEditing(column)}
                        aria-label={`Reorder, ${columnLabel(column)}`}
                        onClick={() => onToggleEdit(match, side)}
                        sx={footActionSx}
                      >
                        {isEditing(column) ? 'Done' : 'Reorder'}
                      </MuiButton>
                    )}
                    {canAnnounce && (
                      <Button
                        size="sm"
                        aria-label={`Announce team, ${columnLabel(column)}`}
                        disabled={announcingSideId === side.sideId}
                        onClick={() => onAnnounce(match, side)}
                        sx={footActionSx}
                      >
                        {announcingSideId === side.sideId ? 'Announcing…' : 'Announce'}
                      </Button>
                    )}
                  </Box>
                </TableCell>
              )
            })}
          </TableRow>
        </TableFooter>
      </Table>
    </Box>
  )
}

// docs/specs/093-team-selection-hub.md (Batting order view): positions 1..N plus the 12th man down, matches (grouped by
// day and slot) across. "+ Add" on an open position offers only the players the overview says can be picked for that
// side, and picks through the same apply path as the Players grid, at that position.
export default function BattingOrderView() {
  const { clubId } = useTeamSelectionHub()
  const picker = usePlayerPick(clubId as string)
  const announce = useAnnounceSide(clubId as string)
  const reorder = useReorderEditing()
  const [shortNames, setShortNames] = useState(readShortNames)
  const [scrollBox, setScrollBox] = useState<HTMLElement | null>(null)
  const [adding, setAdding] = useState<AddTarget | null>(null)
  // The server un-announces a side on its first write, so starting to reorder an announced side is confirmed once; the
  // moves inside that edit session are not asked about again.
  const [pendingStart, setPendingStart] = useState<string | null>(null)
  const toggleEdit = (_match: TeamSelectionMatch, side: TeamSelectionSide) => {
    if (side.sideId === null) return
    if (reorder.editing.has(side.sideId)) reorder.stop(side.sideId)
    else if (side.announced) setPendingStart(side.sideId)
    else reorder.start(side.sideId)
  }

  return (
    <MatchesFrame
      controls={
        <>
          <CompactSwitch
            checked={shortNames}
            onChange={(value) => {
              setShortNames(value)
              writeShortNames(value)
            }}
            label="Short names"
          />
        </>
      }
      pinned={<SlotNavigator scrollBox={scrollBox} />}
      notices={
        <>
          {announce.errorAlert}
          {picker.error && (
            <Alert severity="error" onClose={picker.clearError}>
              {picker.error}
            </Alert>
          )}
        </>
      }
    >
      {(matches, data) => {
        const options = adding ? eligiblePlayers(data.players, adding) : []
        const choose = (player: TeamSelectionPlayer) => {
          if (!adding) return
          const cell = player.cells.find((candidate) => candidate.matchId === adding.match.matchId && candidate.teamId === adding.side.teamId)
          if (!cell) return
          picker.pick({ match: adding.match, side: adding.side, cell, playerId: player.playerId, position: adding.position })
          setAdding(null)
        }
        return (
          <>
            <BattingMatrix
              matches={matches}
              busy={picker.busy}
              onAdd={setAdding}
              onMove={picker.move}
              announcingSideId={announce.announcingSideId}
              onAnnounce={announce.request}
              editing={reorder.editing}
              onToggleEdit={toggleEdit}
              onKeepEditing={reorder.keepOnly}
              shortNames={shortNames}
              onScrollBox={setScrollBox}
            />
            <Menu
              open={adding !== null}
              anchorEl={adding?.anchor}
              onClose={() => setAdding(null)}
              slotProps={{ paper: { sx: { maxHeight: 320 } } }}
              MenuListProps={{ 'aria-label': adding ? `Players for position ${adding.position}` : undefined }}
            >
              {options.length === 0 && (
                <MenuItem disabled>No eligible players</MenuItem>
              )}
              {options.map((player) => (
                <MenuItem key={player.playerId} onClick={() => choose(player)}>
                  {nameOf(player)}
                </MenuItem>
              ))}
            </Menu>
            {announce.dialog}
            <ConfirmDialog
              open={pendingStart !== null}
              title="Change an announced team?"
              description="Moving a batter un-announces this team. It will need to be announced again."
              confirmLabel="Start reordering"
              onConfirm={() => {
                if (pendingStart) reorder.start(pendingStart)
                setPendingStart(null)
              }}
              onClose={() => setPendingStart(null)}
            />
          </>
        )
      }}
    </MatchesFrame>
  )
}
