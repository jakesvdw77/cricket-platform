import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'

export interface ShareFormatScreenProps {
  // The format's heading ("WhatsApp").
  title: string
  // The control strip: templates, include switches.
  controls: ReactNode
  // The live preview (usually inside a SharePreviewStage).
  preview: ReactNode
  // The buttons that deliver it; under the controls on a computer, a sticky bar at the bottom on a phone.
  actions: ReactNode
}

// docs/specs/114-share-result.md (Format screen anatomy): controls on the left (above the preview on a phone), preview on
// the right, actions under the controls. On a phone the actions stick to the bottom of the dialog so Share is always
// reachable, above the safe-area inset.
export function ShareFormatScreen({ title, controls, preview, actions }: ShareFormatScreenProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(280px, 360px) minmax(0, 1fr)' },
        gridTemplateAreas: { xs: '"controls" "preview" "actions"', md: '"controls preview" "actions preview"' },
        gridTemplateRows: { md: 'auto 1fr' },
        alignItems: 'start',
      }}
    >
      <Box sx={{ gridArea: 'controls', minWidth: 0 }}>
        <Typography variant="h6" component="h3" sx={{ fontWeight: 700, mb: 1 }}>
          {title}
        </Typography>
        {controls}
      </Box>
      <Box sx={{ gridArea: 'preview', minWidth: 0 }}>{preview}</Box>
      <Box
        sx={{
          gridArea: 'actions',
          minWidth: 0,
          position: { xs: 'sticky', md: 'static' },
          bottom: 0,
          zIndex: 1,
          bgcolor: 'background.paper',
          borderTop: { xs: 1, md: 0 },
          borderColor: 'divider',
          mx: { xs: -2, md: 0 },
          px: { xs: 2, md: 0 },
          pt: { xs: 1.5, md: 0 },
          pb: { xs: 'max(12px, env(safe-area-inset-bottom))', md: 0 },
        }}
      >
        {actions}
      </Box>
    </Box>
  )
}
