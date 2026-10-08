import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, ButtonBase, Collapse, IconButton, Link, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { CellStatus, GameColumn, PlayerRow } from '../../../../api/playerAvailabilityApi'
import { useSwipe } from '../../../../hooks/useSwipe'
import { statusTintSx } from '../../../../utils/availabilityStatus'
import { segmentedSwitchSx } from '../../../../utils/segmentedSwitch'
import { CellMark } from '../CellMark'
import { GridEmptyState } from '../GridEmptyState'
import { Legend } from '../Legend'
import {
  ANSWER_STATUSES,
  answerCounts,
  cellFor,
  cellLabel,
  dateHeading,
  groupGames,
  hasNothingToShow,
  kickoffText,
  nextFourGames,
  nextGameDayMarker,
  openingGame,
  openPollPath,
  orderedGames,
  playerFullName,
  playersForGame,
  shortDate,
  slotLabel,
} from '../gridHelpers'
import type { AnswerStatus } from '../gridHelpers'

export interface PlayersPhoneListsProps {
  // The games and the (already searched and filtered) players the grid would show.
  games: GameColumn[]
  players: PlayerRow[]
  // Only for tests and stories: the clock that decides the next game day.
  now?: Date
}

type Mode = 'game' | 'player'

const ROW_MIN_HEIGHT = 44

const ANSWER_WORD: Record<CellStatus, string> = {
  AVAILABLE: 'Available',
  UNSURE: 'Unsure',
  UNAVAILABLE: 'Unavailable',
  NO_RESPONSE: 'No response',
  NOT_IN_POLL: 'No poll',
}

// The status as a word in a pill - never colour alone. Available / Unsure / Unavailable use the same tints as the
// Responses pages; the two non-answers are neutral.
function StatusPill({ status }: { status: CellStatus }) {
  const answered = status === 'AVAILABLE' || status === 'UNSURE' || status === 'UNAVAILABLE'
  return (
    <Box
      component="span"
      data-status={status}
      sx={{
        flex: '0 0 auto',
        borderRadius: 99,
        px: 1.25,
        py: 0.25,
        fontSize: '0.72rem',
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        ...(answered ? statusTintSx(status) : { bgcolor: 'action.hover', color: 'text.secondary', fontWeight: 600 }),
      }}
    >
      {ANSWER_WORD[status]}
    </Box>
  )
}

const cardSx = {
  bgcolor: 'background.paper',
  borderRadius: 2,
  boxShadow: 1,
  p: 1,
}

function PickedDot() {
  return (
    <Box
      component="span"
      role="img"
      aria-label="Picked for the match"
      title="Picked for the match"
      sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', flex: '0 0 auto' }}
    />
  )
}

function ByGame({ games, players, now }: { games: GameColumn[]; players: PlayerRow[]; now: Date }) {
  const groups = useMemo(() => groupGames(games), [games])
  const columns = useMemo(() => orderedGames(groups), [groups])
  const marker = useMemo(() => nextGameDayMarker(groups, now), [groups, now])
  // The chosen game is kept by id, so a changed filter that drops it falls back to the opening game.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [answer, setAnswer] = useState<AnswerStatus | null>(null)

  const opening = useMemo(() => openingGame(columns, now), [columns, now])
  const selectedIndex = selectedId ? columns.findIndex((game) => game.matchId === selectedId) : -1
  const openingIndex = columns.findIndex((game) => game.matchId === opening?.matchId)
  const index = selectedIndex >= 0 ? selectedIndex : Math.max(0, openingIndex)
  const game = columns[index]
  const go = (step: number) => {
    const next = columns[index + step]
    if (next) setSelectedId(next.matchId)
  }
  const swipe = useSwipe({ onSwipeLeft: () => go(1), onSwipeRight: () => go(-1) })

  const counts = useMemo(() => answerCounts(players, game.matchId), [players, game.matchId])
  const rows = useMemo(() => playersForGame(players, game.matchId, answer), [players, game.matchId, answer])
  const gameDate = new Date(game.matchDate)
  const dayMarker = marker && marker.dateKey === groups.find((group) => group.slots.some((slot) => slot.games.includes(game)))?.dateKey ? marker.text : null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box {...swipe} sx={{ ...cardSx, display: 'flex', alignItems: 'center', gap: 0.5 }} data-testid="game-selector">
        <IconButton aria-label="Previous game" onClick={() => go(-1)} disabled={index === 0} sx={{ width: 44, height: 44 }}>
          <ChevronLeftIcon />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0, textAlign: 'center' }} aria-live="polite">
          <Typography variant="body2" fontWeight={700}>
            {dateHeading(gameDate)} · {slotLabel(game.dayPart)}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {game.label} · {kickoffText(game.matchDate)}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            Game {index + 1} of {columns.length}
            {dayMarker ? ` · ${dayMarker}` : ''}
          </Typography>
        </Box>
        <IconButton aria-label="Next game" onClick={() => go(1)} disabled={index === columns.length - 1} sx={{ width: 44, height: 44 }}>
          <ChevronRightIcon />
        </IconButton>
      </Box>

      {game.pollType === null ? (
        <Box sx={{ ...cardSx, p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No poll has been opened for this game.{' '}
            <Link component={RouterLink} to={openPollPath(game)} underline="always">
              Open a poll
            </Link>
          </Typography>
        </Box>
      ) : (
        <>
          <Box role="group" aria-label="Filter by answer" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {ANSWER_STATUSES.map((status) => {
              const selected = answer === status
              const tinted = status !== 'NO_RESPONSE'
              return (
                <ButtonBase
                  key={status}
                  aria-pressed={selected}
                  onClick={() => setAnswer(selected ? null : status)}
                  sx={{
                    minHeight: 44,
                    px: 1.5,
                    borderRadius: 99,
                    fontSize: '0.78rem',
                    border: 2,
                    borderColor: selected ? 'primary.main' : 'transparent',
                    ...(tinted ? statusTintSx(status as 'AVAILABLE' | 'UNSURE' | 'UNAVAILABLE') : { bgcolor: 'action.hover', color: 'text.secondary', fontWeight: 600 }),
                    '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                  }}
                >
                  {ANSWER_WORD[status]} {counts[status]}
                </ButtonBase>
              )
            })}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box component="span" aria-hidden sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />
            Picked for the match
          </Typography>

          <Box component="ul" aria-label={`Players for ${game.label}`} sx={{ ...cardSx, m: 0, py: 0, listStyle: 'none' }}>
            {rows.length === 0 && (
              <Box component="li" sx={{ py: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {answer ? `No players with this answer.` : 'No players to show.'}
                </Typography>
              </Box>
            )}
            {rows.map(({ player, status, picked }) => (
              <Box
                component="li"
                key={player.playerProfileId}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  minHeight: ROW_MIN_HEIGHT,
                  borderBottom: 1,
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 0 },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                    {playerFullName(player)}
                  </Typography>
                  {picked && <PickedDot />}
                </Box>
                <StatusPill status={status} />
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  )
}

const MARK_COL_WIDTH = 44

function ByPlayer({ games, players, now }: { games: GameColumn[]; players: PlayerRow[]; now: Date }) {
  const columns = useMemo(() => orderedGames(groupGames(games)), [games])
  const strip = useMemo(() => nextFourGames(columns, now), [columns, now])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <Box sx={{ ...cardSx, p: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, px: 1, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          Player
        </Typography>
        {strip.map((game) => (
          <Box
            key={game.matchId}
            data-testid="strip-game"
            role="columnheader"
            aria-label={`${shortDate(new Date(game.matchDate))}, ${kickoffText(game.matchDate)}, ${game.label}`}
            title={`${shortDate(new Date(game.matchDate))} · ${kickoffText(game.matchDate)} · ${game.label}`}
            sx={{ width: MARK_COL_WIDTH, textAlign: 'center', fontSize: '0.66rem', lineHeight: 1.15, color: 'text.secondary' }}
          >
            <Box component="span" sx={{ display: 'block', fontWeight: 700 }}>
              {shortDate(new Date(game.matchDate))}
            </Box>
            <Box
              component="span"
              sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}
            >
              {game.label}
            </Box>
          </Box>
        ))}
      </Box>
      {players.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
          No players to show.
        </Typography>
      )}
      {players.map((player) => {
        const expanded = expandedId === player.playerProfileId
        return (
          <Box key={player.playerProfileId} sx={{ borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
            <ButtonBase
              aria-expanded={expanded}
              onClick={() => setExpandedId(expanded ? null : player.playerProfileId)}
              sx={{ display: 'flex', width: '100%', minHeight: ROW_MIN_HEIGHT, gap: 0.5, px: 1, textAlign: 'left', borderRadius: 1 }}
            >
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', fontWeight: expanded ? 700 : 400 }}>
                {playerFullName(player)}
              </Typography>
              {strip.map((game) => {
                const cell = cellFor(player, game.matchId)
                return (
                  <Box key={game.matchId} sx={{ width: MARK_COL_WIDTH, display: 'flex', justifyContent: 'center' }}>
                    {cell && <CellMark status={cell.status} picked={cell.picked} label={cellLabel(player, game, cell)} />}
                  </Box>
                )
              })}
              <ExpandMoreIcon
                fontSize="small"
                aria-hidden
                sx={{ color: 'text.secondary', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
              />
            </ButtonBase>
            <Collapse in={expanded} unmountOnExit>
              <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, mx: 0.5, mb: 0.75, px: 1, py: 0.5 }}>
                {columns.map((game) => {
                  const cell = cellFor(player, game.matchId)
                  return (
                    <Box
                      key={game.matchId}
                      data-testid="player-game"
                      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 36 }}
                    >
                      <Typography variant="caption" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                        {dateHeading(new Date(game.matchDate))} · {kickoffText(game.matchDate)} · {game.label}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {cell?.picked && <PickedDot />}
                        <StatusPill status={cell ? cell.status : 'NOT_IN_POLL'} />
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            </Collapse>
          </Box>
        )
      })}
    </Box>
  )
}

// docs/specs/085 (E): the Players view below the tablet breakpoint - two vertical lists instead of the grid, so there
// is one scroll direction. "By game" opens on the next game day: a game selector (arrows and swipe), status chips that
// filter, and one tall list. "By player" is a row per player with a mark for each of the next four games; tapping a
// row lists all of that player's games. Same data, filters and search as the grid.
export function PlayersPhoneLists({ games, players, now }: PlayersPhoneListsProps): ReactNode {
  const [mode, setMode] = useState<Mode>('game')
  const clock = useMemo(() => now ?? new Date(), [now])

  if (hasNothingToShow(games)) return <GridEmptyState games={games} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <ToggleButtonGroup
        value={mode}
        exclusive
        size="small"
        aria-label="Players view"
        sx={segmentedSwitchSx}
        onChange={(_event, next: Mode | null) => next && setMode(next)}
      >
        <ToggleButton value="game">By game</ToggleButton>
        <ToggleButton value="player">By player</ToggleButton>
      </ToggleButtonGroup>
      {mode === 'player' && <Legend phone />}
      {mode === 'game' ? <ByGame games={games} players={players} now={clock} /> : <ByPlayer games={games} players={players} now={clock} />}
    </Box>
  )
}
