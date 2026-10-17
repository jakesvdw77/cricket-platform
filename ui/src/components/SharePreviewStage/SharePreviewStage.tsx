import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'

export interface SharePreviewStageProps {
  // The preview itself (a canvas, a page image, a phone-style text box).
  children: ReactNode
  // One line under the stage saying what the preview is.
  caption?: ReactNode
  // Accessible name of the stage region.
  ariaLabel?: string
}

// docs/specs/114-share-result.md (Preview and delivery): the checkerboard stage every format's preview sits on, with a
// caption. It scrolls inside itself only (a wide A4 page), never forcing a horizontal scroll on the page.
export function SharePreviewStage({ children, caption, ariaLabel = 'Preview' }: SharePreviewStageProps) {
  return (
    <Box>
      <Box
        role="region"
        aria-label={ariaLabel}
        sx={(theme) => ({
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          p: { xs: 1.5, sm: 2.5 },
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          overflow: 'auto',
          maxWidth: '100%',
          backgroundColor: theme.palette.background.paper,
          backgroundImage: `conic-gradient(${alpha(theme.palette.text.primary, 0.05)} 25%, transparent 0 50%, ${alpha(theme.palette.text.primary, 0.05)} 0 75%, transparent 0)`,
          backgroundSize: '16px 16px',
        })}
      >
        <Box sx={{ width: '100%', maxWidth: 560, minWidth: 0 }}>{children}</Box>
      </Box>
      {caption && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          {caption}
        </Typography>
      )}
    </Box>
  )
}
