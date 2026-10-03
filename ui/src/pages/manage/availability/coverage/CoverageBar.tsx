import { Box } from '@mui/material'
import { coverageBarLabel, ownSegmentSx, sharedSegmentSx } from './coverageBarParts'
import type { CoverageBarProps } from './coverageBarParts'

// docs/specs/074-availability-coverage.md section 6.3: one team's bar. A 12px rounded track with a
// solid segment (available only for this team), a striped segment (also available for another team)
// and a 2px tick at the playing XI size. Scale is max(available, needed), so the tick sits at the
// right edge when needed is the larger.

const TRACK_HEIGHT = 12

export function CoverageBar(props: CoverageBarProps) {
  const { available, ownOnly, shared, needed, hasPoll = true } = props
  const scale = hasPoll ? Math.max(available, needed ?? 0) : 0
  const percent = (count: number) => (scale > 0 ? `${(count / scale) * 100}%` : '0%')

  return (
    <Box role="img" aria-label={coverageBarLabel(props)} sx={{ position: 'relative', py: '2px' }}>
      <Box
        sx={{
          display: 'flex',
          height: TRACK_HEIGHT,
          borderRadius: `${TRACK_HEIGHT / 2}px`,
          bgcolor: 'grey.300',
          overflow: 'hidden',
        }}
      >
        <Box data-segment="own" sx={{ ...ownSegmentSx, width: percent(ownOnly), flex: 'none' }} />
        <Box data-segment="shared" sx={{ ...sharedSegmentSx, width: percent(shared), flex: 'none' }} />
      </Box>
      {hasPoll && needed !== null && scale > 0 && (
        <Box
          data-testid="coverage-tick"
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '2px',
            left: `calc(${percent(needed)} - 1px)`,
            bgcolor: 'text.primary',
          }}
        />
      )}
    </Box>
  )
}
