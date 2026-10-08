import { useRef, useState } from 'react'
import { Box, ButtonBase, Stack, Typography } from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import { ResponseGauge } from '../../../../components/ResponseGauge'
import type { AvailabilityStatus } from '../../../../api/matchAvailabilityApi'
import { STATUS_LABEL, statusTintSx } from '../../../../utils/availabilityStatus'
import { StatusOverrideMenu } from './StatusOverrideMenu'
import { SlotMatches } from './SlotMatches'
import { ViaLinkMarker } from './ViaLinkMarker'
import { playerName, ROW_HEIGHT, slotHeading, STATUS_ORDER, viaLinkFor } from './responseHelpers'
import type { OverrideProps, ResponseRow, SlotGroup } from './responseHelpers'

const GROUP_KEY: Record<AvailabilityStatus, 'available' | 'unsure' | 'unavailable'> = {
  AVAILABLE: 'available',
  UNSURE: 'unsure',
  UNAVAILABLE: 'unavailable',
}

// A player row: the name (no shirt number: it only took space), a divider under it, tapping opens the override menu.
function PlayerRow({
  row,
  slot,
  status,
  override,
}: {
  row: ResponseRow
  slot: SlotGroup
  status: AvailabilityStatus | null
  override: OverrideProps
}) {
  return (
    <StatusOverrideMenu
      playerName={playerName(row)}
      slotLabel={slotHeading(slot.bracket)}
      status={status}
      disabled={override.pendingKey === `${row.playerProfileId}:${slot.bracket.windowId}`}
      onSelect={(next) => override.onOverride(row, slot.bracket.windowId, next)}
    >
      {(trigger) => (
        <ButtonBase
          {...trigger}
          sx={{
            display: 'flex',
            justifyContent: 'flex-start',
            gap: 1,
            width: '100%',
            px: 1,
            py: 0.75,
            minHeight: ROW_HEIGHT,
            textAlign: 'left',
            borderRadius: 0,
            borderBottom: 1,
            borderColor: 'divider',
            '&:hover': { bgcolor: 'action.hover' },
            '&[aria-disabled="true"]': { cursor: 'default' },
          }}
        >
          <Typography component="span" variant="body2" sx={{ flex: '1 1 auto', minWidth: 0 }}>
            {playerName(row)}
          </Typography>
          {viaLinkFor(row, slot.bracket.windowId) && <ViaLinkMarker />}
        </ButtonBase>
      )}
    </StatusOverrideMenu>
  )
}

function StatusColumn({
  status,
  slot,
  rows,
  override,
}: {
  status: AvailabilityStatus
  slot: SlotGroup
  rows: ResponseRow[]
  override: OverrideProps
}) {
  const heading = slotHeading(slot.bracket)
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden', minWidth: 0 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1.5, py: 1, ...statusTintSx(status) }}>
        <Typography variant="subtitle2" fontWeight={700} component="h4">
          {STATUS_LABEL[status]}
        </Typography>
        <Typography variant="subtitle2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {rows.length}
        </Typography>
      </Stack>
      {/* docs/specs/085 (C9): the list grows to its full length and the page scrolls, so this is not a scroll box. */}
      <Box role="group" aria-label={`${STATUS_LABEL[status]} players, ${heading}`} sx={{ p: 0.5, minHeight: 48, '& > button:last-of-type': { borderBottom: 0 } }}>
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 0.75 }}>
            None
          </Typography>
        ) : (
          rows.map((row) => <PlayerRow key={row.playerProfileId} row={row} slot={slot} status={status} override={override} />)
        )}
      </Box>
    </Box>
  )
}

function SlotBlock({ slot, override, slotBar }: { slot: SlotGroup; override: OverrideProps; slotBar: boolean }) {
  // Per slot, not persisted (docs/specs/065): a section can have dozens of non-responders.
  const [noResponseOpen, setNoResponseOpen] = useState(false)
  const heading = slotHeading(slot.bracket)
  // After a save the player moves to another column, so their trigger unmounts; focus lands on this
  // slot's heading rather than dropping to <body>.
  const headingRef = useRef<HTMLHeadingElement>(null)
  const slotOverride: OverrideProps = {
    ...override,
    onOverride: async (...args) => {
      const saved = await override.onOverride(...args)
      if (saved) headingRef.current?.focus()
      return saved
    },
  }
  const answered = slot.available.length + slot.unsure.length + slot.unavailable.length

  return (
    <Box
      component="section"
      aria-label={heading}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', p: { xs: 1.5, md: 2 } }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="baseline" flexWrap="wrap" useFlexGap>
          <Typography ref={headingRef} tabIndex={-1} variant="subtitle1" component="h3" fontWeight={700} sx={{ outline: 'none' }}>
            {heading}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {answered} answered · {slot.noResponse.length} no response
          </Typography>
        </Stack>
        <SlotMatches matches={slot.matches} />
        {slotBar && (
          <ResponseGauge
            mode="status"
            variant="thin"
            testIdPrefix={slot.bracket.windowId}
            counts={{
              available: slot.bracket.availableCount,
              unsure: slot.bracket.unsureCount,
              unavailable: slot.bracket.unavailableCount,
              noResponse: slot.bracket.noResponseCount,
            }}
          />
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
          {STATUS_ORDER.map((status) => (
            <StatusColumn key={status} status={status} slot={slot} rows={slot[GROUP_KEY[status]]} override={slotOverride} />
          ))}
        </Box>
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
          {/* docs/specs/085 (C7): the whole bar is the click target. The button is an overlay so the "No response (n)"
              heading stays a real heading; the Show / Hide text and arrow are decoration for it. */}
          <Box
            sx={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 36,
              borderRadius: 1,
              ...(slot.noResponse.length > 0 && { '&:hover': { bgcolor: 'action.hover' } }),
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} component="h4" sx={{ pl: 0.5 }}>
              No response ({slot.noResponse.length})
            </Typography>
            {slot.noResponse.length > 0 && (
              <>
                <Box
                  aria-hidden
                  data-testid="no-response-toggle-label"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, pr: 0.5, color: 'primary.main', fontWeight: 700, fontSize: '0.8125rem' }}
                >
                  {noResponseOpen ? 'Hide' : 'Show'}
                  {noResponseOpen ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                </Box>
                <ButtonBase
                  aria-expanded={noResponseOpen}
                  aria-label={`${noResponseOpen ? 'Hide' : 'Show'} no response players, ${heading}`}
                  onClick={() => setNoResponseOpen((prev) => !prev)}
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 1,
                    '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 },
                  }}
                />
              </>
            )}
          </Box>
          {noResponseOpen && (
            <Box sx={{ mt: 0.5, columnWidth: 200, columnGap: 1 }}>
              {slot.noResponse.map((row) => (
                <Box key={row.playerProfileId} sx={{ breakInside: 'avoid' }}>
                  <PlayerRow row={row} slot={slot} status={null} override={slotOverride} />
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Stack>
    </Box>
  )
}

// docs/specs/065 "By time slot" (the default view): per slot, its matches then who is Available /
// Unsure / Unavailable, with a collapsible No response row.
export function ResponsesByTimeSlot({ slots, override, slotBars = false }: { slots: SlotGroup[]; override: OverrideProps; slotBars?: boolean }) {
  return (
    <Stack spacing={2}>
      {slots.map((slot) => (
        <SlotBlock key={slot.bracket.windowId} slot={slot} override={override} slotBar={slotBars} />
      ))}
    </Stack>
  )
}
