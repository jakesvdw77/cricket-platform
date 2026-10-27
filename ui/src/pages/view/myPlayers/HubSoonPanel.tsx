import { Box, Typography } from '@mui/material'
import { HUB, hubPageHeading } from './hubStyle'
import { blackAlpha } from '../../../brandTokens'

// docs/specs/121: the locked "Coming soon" panel of a Soon item: heading, then a dashed panel with one line of copy.
// Never a spinner and never a fake figure.
export function HubSoonPanel({ title, copy }: { title: string; copy?: string }) {
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }} data-testid="hub-soon-panel">
      <Typography component="h2" sx={hubPageHeading}>
        {title}
      </Typography>
      <Box sx={{ border: 1, borderStyle: 'dashed', borderColor: HUB.line, borderRadius: '4px', p: 2.75, color: HUB.muted, bgcolor: blackAlpha(0.22) }}>
        <Box component="b" sx={{ display: 'block', color: HUB.cream, fontFamily: HUB.display, fontSize: { xs: 22, md: 24 }, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600, mb: 0.5 }}>
          Coming soon
        </Box>
        {copy}
      </Box>
    </Box>
  )
}
