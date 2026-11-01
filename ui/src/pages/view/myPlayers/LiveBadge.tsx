import { Box } from '@mui/material'
import { PulseDot } from '../../../components/RecordCard/RecordCard'
import { HUB } from './hubStyle'

// docs/specs/135: the LIVE badge: gold fill, ink text, a pulsing dot and the word LIVE, so colour is never the only cue.
// The pulse stands still under prefers-reduced-motion (PulseDot).
export function LiveBadge() {
  return (
    <Box
      component="span"
      data-testid="live-badge"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 24, px: 1.25, borderRadius: '12px', bgcolor: HUB.gold, color: HUB.ink, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', lineHeight: 1, flex: 'none' }}
    >
      <PulseDot />
      LIVE
    </Box>
  )
}
