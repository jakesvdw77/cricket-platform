import type { ReactNode } from 'react'
import { Box } from '@mui/material'

export interface PageHeaderBandProps {
  children: ReactNode
}

// The shared page-header container for RecordDetailScreen/RecordFormScreen/ManageScreenHeader and
// the detail pages — docs/specs/081-plain-page-header-and-counters.md (amends 046): a plain
// container sitting directly on the page wash, like the Overview greeting row. No band, accent
// line, shadow, radius, bleed margins, background or border, and no margin of its own: every wrapper
// already puts a 24px gap (gap: 3) between the header and the content.
// The name is kept so every consumer still works.
export function PageHeaderBand({ children }: PageHeaderBandProps) {
  return <Box>{children}</Box>
}
