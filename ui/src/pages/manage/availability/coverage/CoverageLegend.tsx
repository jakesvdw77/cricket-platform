import { Box } from '@mui/material'
import { ownSegmentSx, sharedSegmentSx } from './coverageBarParts'

// docs/specs/074-availability-coverage.md section 7: the legend below the grid, once, not per card.
const ITEMS = [
  { label: 'Only this team', swatch: { ...ownSegmentSx, width: 14, height: 10, borderRadius: '2px' } },
  { label: 'Also available for another team', swatch: { ...sharedSegmentSx, width: 14, height: 10, borderRadius: '2px' } },
  { label: 'Places needed (playing XI)', swatch: { bgcolor: 'text.primary', width: '3px', height: 12 } },
]

export function CoverageLegend() {
  return (
    <Box
      component="ul"
      aria-label="Legend"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        columnGap: 2,
        rowGap: 0.5,
        listStyle: 'none',
        m: 0,
        p: 0,
        fontSize: 12,
        color: 'text.secondary',
      }}
    >
      {ITEMS.map((item) => (
        <Box key={item.label} component="li" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box aria-hidden="true" sx={{ ...item.swatch, flex: 'none' }} />
          {item.label}
        </Box>
      ))}
    </Box>
  )
}
