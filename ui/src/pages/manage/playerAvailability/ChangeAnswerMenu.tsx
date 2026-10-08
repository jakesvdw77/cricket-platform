import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ButtonBase } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import type { AvailabilityCell, GameColumn, PlayerRow } from '../../../api/playerAvailabilityApi'
import { StatusOverrideMenu } from '../availability/responses/StatusOverrideMenu'
import { answerKey } from './useChangeAnswer'
import type { ChangeAnswerHandlers } from './useChangeAnswer'
import { cellLabel, dateHeading, kickoffText, playerFullName, pollPath } from './gridHelpers'

// True when a cell has a poll behind it, so its answer can be changed (NOT_IN_POLL and games without a poll cannot).
export function canChangeAnswer(game: GameColumn, cell: AvailabilityCell | undefined): cell is AvailabilityCell {
  return Boolean(cell && cell.status !== 'NOT_IN_POLL' && game.pollType && pollPath(game))
}

// docs/specs/085 (F): the shared "change this one answer" control of the Players grid and the phone lists - the Responses
// pages' StatusOverrideMenu (Available / Unsure / Unavailable, current answer selected) titled with the player and the
// game, plus an "Open poll" entry that keeps the old route. The child (a mark or a status pill) sits inside a real button
// whose accessible name is the cell label.
export function ChangeAnswerMenu({
  player,
  game,
  cell,
  handlers,
  sx,
  children,
}: {
  player: PlayerRow
  game: GameColumn
  cell: AvailabilityCell
  handlers: ChangeAnswerHandlers
  sx?: SxProps<Theme>
  children: ReactNode
}) {
  const navigate = useNavigate()
  const path = pollPath(game)
  const current = cell.status === 'AVAILABLE' || cell.status === 'UNSURE' || cell.status === 'UNAVAILABLE' ? cell.status : null
  const when = `${dateHeading(new Date(game.matchDate))} ${kickoffText(game.matchDate)}`
  return (
    <StatusOverrideMenu
      playerName={playerFullName(player)}
      slotLabel={when}
      status={current}
      disabled={handlers.pendingKey === answerKey(player, game)}
      onSelect={(next) => handlers.onChange(player, game, next)}
      title={`${playerFullName(player)}, ${when}, ${game.label}`}
      extraItem={path ? { label: 'Open poll', onSelect: () => navigate(path) } : undefined}
      triggerLabel={cellLabel(player, game, cell)}
    >
      {(trigger) => (
        <ButtonBase
          {...trigger}
          sx={[
            { borderRadius: 1, '&[aria-disabled="true"]': { cursor: 'default', opacity: 0.6 }, '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } },
            ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
          ]}
        >
          {children}
        </ButtonBase>
      )}
    </StatusOverrideMenu>
  )
}
