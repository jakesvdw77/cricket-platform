import { useRef, useState } from 'react'
import { Box, ButtonBase, Stack, Typography } from '@mui/material'
import { Button } from '../../../../components/Button'
import type { AvailabilityStatus } from '../../../../api/matchAvailabilityApi'
import { STATUS_LABEL, statusTintSx } from '../../../../utils/availabilityStatus'
import { StatusOverrideMenu } from './StatusOverrideMenu'
import { SlotMatches } from './SlotMatches'
import { ViaLinkMarker } from './ViaLinkMarker'
import { playerName, playerNumber, ROW_HEIGHT, SCROLL_BOX_MAX_HEIGHT, slotHeading, STATUS_ORDER, viaLinkFor } from './responseHelpers'
import type { OverrideProps, ResponseRow, SlotGroup } from './responseHelpers'

const GROUP_KEY: Record<AvailabilityStatus, 'available' | 'unsure' | 'unavailable'> = {
  AVAILABLE: 'available',
  UNSURE: 'unsure',
  UNAVAILABLE: 'unavailable',
}

// A player row: shirt number + name, tapping opens the override menu.
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
  const number = playerNumber(row)
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
            borderRadius: 1,
            '&:hover': { bgcolor: 'action.hover' },
            '&[aria-disabled="true"]': { cursor: 'default' },
          }}
        >
          <Typography
            component="span"
            variant="body2"
            color="text.secondary"
            sx={{ minWidth: 28, fontVariantNumeric: 'tabular-nums' }}
          >
            {number != null ? `#${number}` : ''}
          </Typography>
          <Typography component="span" variant="body2">
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
      {/* SCROLL_ROWS rows tall, then it scrolls in its own box rather than stretching the page. */}
      <Box
        role="region"
        tabIndex={0}
        aria-label={`${STATUS_LABEL[status]} players, ${heading}`}
        sx={{ maxHeight: SCROLL_BOX_MAX_HEIGHT, overflowY: 'auto', p: 0.5, minHeight: 48 }}
      >
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

function SlotBlock({ slot, override }: { slot: SlotGroup; override: OverrideProps }) {
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
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
          {STATUS_ORDER.map((status) => (
            <StatusColumn key={status} status={status} slot={slot} rows={slot[GROUP_KEY[status]]} override={slotOverride} />
          ))}
        </Box>
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" fontWeight={700} component="h4" sx={{ pl: 0.5 }}>
              No response ({slot.noResponse.length})
            </Typography>
            {slot.noResponse.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={noResponseOpen}
                aria-label={`${noResponseOpen ? 'Hide' : 'Show'} no response players, ${heading}`}
                onClick={() => setNoResponseOpen((prev) => !prev)}
              >
                {noResponseOpen ? 'Hide' : 'Show'}
              </Button>
            )}
          </Stack>
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
export function ResponsesByTimeSlot({ slots, override }: { slots: SlotGroup[]; override: OverrideProps }) {
  return (
    <Stack spacing={2}>
      {slots.map((slot) => (
        <SlotBlock key={slot.bracket.windowId} slot={slot} override={override} />
      ))}
    </Stack>
  )
}
