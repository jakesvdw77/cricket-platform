import { useState } from 'react'
import { Box, ButtonBase, Chip, lighten, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import type { Theme } from '@mui/material'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import { Input } from '../../../../components/Input'
import { compactFieldsSx } from '../../../../utils/filterPanel'
import { CompactSwitch } from '../../../../components/CompactSwitch'
import { STATUS_LABEL, statusTintSx } from '../../../../utils/availabilityStatus'
import { StatusOverrideMenu } from './StatusOverrideMenu'
import { ViaLinkMarker } from './ViaLinkMarker'
import {
  filterByStatus,
  hasAnyAnswer,
  playerName,
  slotHeading,
  sortPlayerRows,
  STATUS_FILTER_ORDER,
  statusCountsForSlot,
  statusFor,
  viaLinkFor,
} from './responseHelpers'
import type { OverrideProps, ResponseRow, StatusFilter } from './responseHelpers'
import type { SectionAvailabilityRoundBracket } from '../../../../api/sectionAvailabilityApi'

// A status chip: a pill in the status colours, 44 px high on a phone, outlined in the primary colour while selected.
const chipSx = (selected: boolean, tone: object) => ({
  minHeight: { xs: 44, sm: 32 },
  px: 1.5,
  borderRadius: 99,
  fontSize: '0.78rem',
  border: 2,
  borderColor: selected ? 'primary.main' : 'transparent',
  ...tone,
  ...(selected ? { borderColor: 'primary.main' } : {}),
  '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
})

const CHIP_LABEL: Record<StatusFilter, string> = {
  AVAILABLE: STATUS_LABEL.AVAILABLE,
  UNSURE: STATUS_LABEL.UNSURE,
  UNAVAILABLE: STATUS_LABEL.UNAVAILABLE,
  NONE: 'No response',
}

// A sortable column heading: a real button with the arrow of the active direction (aria-sort on the th).
function SortHeading({ label, active, direction, onClick }: { label: string; active: boolean; direction: 'asc' | 'desc'; onClick: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        minHeight: { xs: 44, sm: 32 },
        px: 0.5,
        borderRadius: 1,
        font: 'inherit',
        fontWeight: 'inherit',
        whiteSpace: 'nowrap',
        '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 },
      }}
    >
      {label}
      {active && (direction === 'asc' ? <ArrowUpwardIcon aria-hidden sx={{ fontSize: 16, color: 'primary.main' }} /> : <ArrowDownwardIcon aria-hidden sx={{ fontSize: 16, color: 'primary.main' }} />)}
    </ButtonBase>
  )
}

// docs/specs/065 "By player": one row per player, one aligned answer column per slot. The word is
// always in the chip, so status is never colour alone. docs/specs/085 (J): status chips with counts (for the selected
// slot, over all players) filter the rows, the headings sort them, and a Slot selector (several slots only) says which
// slot the chips and the status sort mean. Local state only.
export function ResponsesByPlayer({
  rows,
  allRows = rows,
  brackets,
  override,
}: {
  // The players to list (already narrowed by the page's search).
  rows: ResponseRow[]
  // Every player, for the chip counts (which ignore the search, the chip and the hide switch). Defaults to rows.
  allRows?: ResponseRow[]
  brackets: SectionAvailabilityRoundBracket[]
  override: OverrideProps
}) {
  const [hideUnanswered, setHideUnanswered] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter | null>(null)
  const [slotId, setSlotId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<'player' | 'status'>('player')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')

  // The selected slot; falls back to the first when the chosen one is gone.
  const slot = brackets.find((bracket) => bracket.windowId === slotId) ?? brackets[0]
  const slotWindowId = slot?.windowId ?? ''
  const counts = statusCountsForSlot(allRows, slotWindowId)
  const visible = sortPlayerRows(
    filterByStatus(hideUnanswered ? rows.filter(hasAnyAnswer) : rows, slotWindowId, statusFilter),
    sortKey === 'player' ? { key: 'player', direction } : { key: 'status', windowId: slotWindowId, direction },
  )

  const sortByPlayer = () => {
    if (sortKey === 'player') setDirection(direction === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey('player')
      setDirection('asc')
    }
  }
  // Clicking a slot heading selects that slot; clicking the active status sort again reverses it.
  const sortBySlot = (windowId: string) => {
    if (sortKey === 'status' && slotWindowId === windowId) setDirection(direction === 'asc' ? 'desc' : 'asc')
    else {
      setSlotId(windowId)
      setSortKey('status')
      setDirection('asc')
    }
  }
  const ariaSort = (active: boolean) => (active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none')

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        {brackets.length > 1 && (
          <Box sx={[{ width: { xs: '100%', sm: 220 } }, (theme: Theme) => ({ [theme.breakpoints.up('sm')]: compactFieldsSx })]}>
            <Input select label="Slot" value={slotWindowId} onChange={(event) => setSlotId(event.target.value)}>
              {brackets.map((bracket) => (
                <MenuItem key={bracket.windowId} value={bracket.windowId} sx={{ minHeight: 44 }}>
                  {slotHeading(bracket)}
                </MenuItem>
              ))}
            </Input>
          </Box>
        )}
        <Box role="group" aria-label="Filter by status" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          <ButtonBase
            aria-pressed={statusFilter === null}
            onClick={() => setStatusFilter(null)}
            sx={chipSx(statusFilter === null, { bgcolor: 'background.paper', color: 'text.primary', fontWeight: 600, borderColor: 'divider' })}
          >
            All {counts.all}
          </ButtonBase>
          {STATUS_FILTER_ORDER.map((status) => {
            const selected = statusFilter === status
            return (
              <ButtonBase
                key={status}
                aria-pressed={selected}
                onClick={() => setStatusFilter(selected ? null : status)}
                sx={chipSx(selected, status === 'NONE' ? { bgcolor: 'action.hover', color: 'text.secondary', fontWeight: 600 } : statusTintSx(status))}
              >
                {CHIP_LABEL[status]} {counts[status]}
              </ButtonBase>
            )
          })}
        </Box>
        <Box sx={{ ml: { sm: 'auto' } }}>
          <CompactSwitch checked={hideUnanswered} onChange={setHideUnanswered} label="Hide players who haven't answered" noWrap={false} />
        </Box>
      </Box>
      <Box sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
        <Table size="small" aria-label="Responses by player">
          <TableHead>
            <TableRow>
              <TableCell aria-sort={ariaSort(sortKey === 'player')}>
                <SortHeading label="Player" active={sortKey === 'player'} direction={direction} onClick={sortByPlayer} />
              </TableCell>
              {brackets.map((bracket) => {
                const active = sortKey === 'status' && slotWindowId === bracket.windowId
                return (
                  <TableCell key={bracket.windowId} aria-sort={ariaSort(active)} sx={active ? { bgcolor: (theme) => lighten(theme.palette.primary.main, 0.92) } : undefined}>
                    <SortHeading label={slotHeading(bracket)} active={active} direction={direction} onClick={() => sortBySlot(bracket.windowId)} />
                  </TableCell>
                )
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={brackets.length + 1}>
                  <Typography variant="body2" color="text.secondary">
                    No players to show.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {visible.map((row) => (
              <TableRow
                key={row.playerProfileId}
                // Alternate rows: an opaque theme tint (as the Players grid uses), so a name can be followed across.
                sx={(theme) => ({ '&:nth-of-type(odd)': { bgcolor: lighten(theme.palette.primary.main, 0.95) } })}
              >
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{playerName(row)}</TableCell>
                {brackets.map((bracket) => {
                  const status = statusFor(row, bracket.windowId)
                  return (
                    <TableCell key={bracket.windowId}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
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
                      {viaLinkFor(row, bracket.windowId) && <ViaLinkMarker />}
                      </Box>
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
