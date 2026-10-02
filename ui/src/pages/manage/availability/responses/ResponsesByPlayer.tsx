import { useState } from 'react'
import { Box, Chip, FormControlLabel, Switch, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { STATUS_LABEL, statusTintSx } from '../../../../utils/availabilityStatus'
import { StatusOverrideMenu } from './StatusOverrideMenu'
import { hasAnyAnswer, playerName, playerNumber, slotHeading, sortPlayers, statusFor } from './responseHelpers'
import type { OverrideProps, ResponseRow } from './responseHelpers'
import type { SectionAvailabilityRoundBracket } from '../../../../api/sectionAvailabilityApi'

// docs/specs/065 "By player": one row per player, one aligned answer column per slot. The word is
// always in the chip, so status is never colour alone.
export function ResponsesByPlayer({
  rows,
  brackets,
  override,
}: {
  rows: ResponseRow[]
  brackets: SectionAvailabilityRoundBracket[]
  override: OverrideProps
}) {
  const [hideUnanswered, setHideUnanswered] = useState(false)
  const visible = sortPlayers(hideUnanswered ? rows.filter(hasAnyAnswer) : rows)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <FormControlLabel
        control={<Switch checked={hideUnanswered} onChange={(event) => setHideUnanswered(event.target.checked)} />}
        label="Hide players who haven't answered"
      />
      <Box sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
        <Table size="small" aria-label="Responses by player">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 56 }}>#</TableCell>
              <TableCell>Player</TableCell>
              {brackets.map((bracket) => (
                <TableCell key={bracket.windowId} sx={{ whiteSpace: 'nowrap' }}>
                  {slotHeading(bracket)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={brackets.length + 2}>
                  <Typography variant="body2" color="text.secondary">
                    No players to show.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {visible.map((row) => (
              <TableRow key={row.playerProfileId}>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{playerNumber(row) ?? ''}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{playerName(row)}</TableCell>
                {brackets.map((bracket) => {
                  const status = statusFor(row, bracket.windowId)
                  return (
                    <TableCell key={bracket.windowId}>
                      <StatusOverrideMenu
                        playerName={playerName(row)}
                        slotLabel={slotHeading(bracket)}
                        status={status}
                        disabled={override.pendingKey === `${row.playerProfileId}:${bracket.windowId}`}
                        onSelect={(next) => override.onOverride(row, bracket.windowId, next)}
                      >
                        {(trigger) => (
                          <Chip
                            {...trigger}
                            size="small"
                            label={status ? STATUS_LABEL[status] : 'No response'}
                            variant={status ? 'filled' : 'outlined'}
                            sx={{ width: 108, '&[aria-disabled="true"]': { cursor: 'default' }, ...(status ? statusTintSx(status) : {}) }}
                          />
                        )}
                      </StatusOverrideMenu>
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  )
}
