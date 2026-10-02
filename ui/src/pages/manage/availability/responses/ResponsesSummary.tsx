import { Box } from '@mui/material'
import { Card } from '../../../../components/Card'
import { SlotSummary } from '../../../../components/SlotSummary'
import { SlotMatches } from './SlotMatches'
import { slotHeading } from './responseHelpers'
import type { SlotGroup } from './responseHelpers'

// docs/specs/065 "Summary": per slot, a proportional stacked bar plus a text legend with the four
// counts (never colour alone). Counts come from the payload's bracket totals, so a player search
// never changes them. The bar/legend itself is the shared SlotSummary (docs/specs/066), also used
// by the poll card.
export function ResponsesSummary({ slots }: { slots: SlotGroup[] }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
      {slots.map(({ bracket, matches }) => {
        const heading = slotHeading(bracket)
        return (
          <Card key={bracket.windowId} aria-label={`${heading} summary`}>
            <SlotSummary
              heading={heading}
              testIdPrefix={bracket.windowId}
              counts={{
                available: bracket.availableCount,
                unsure: bracket.unsureCount,
                unavailable: bracket.unavailableCount,
                noResponse: bracket.noResponseCount,
              }}
            >
              <SlotMatches matches={matches} />
            </SlotSummary>
          </Card>
        )
      })}
    </Box>
  )
}
