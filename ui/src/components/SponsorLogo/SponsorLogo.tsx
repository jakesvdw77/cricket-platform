import { useState } from 'react'
import { Box } from '@mui/material'

export interface SponsorLogoProps {
  src?: string | null
  // The initials shown while there is no picture, while it loads and when it fails.
  fallback: string
  // The tile's height in px; its width follows the logo's shape, from a square up to about 2.6 times the height.
  height?: number
}

// A sponsor's logo on a white tile as wide as the logo needs. Sponsor logos are mostly wide, so the square avatar the other records
// use left them tiny; here the height is fixed and the logo gets all the width it can use (object-fit contain, never stretched).
export function SponsorLogo({ src, fallback, height = 40 }: SponsorLogoProps) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(src) && !failed
  return (
    <Box
      data-testid="sponsor-logo"
      sx={{
        flex: 'none',
        height,
        minWidth: height,
        maxWidth: height * 2.6,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#ffffff',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        px: 0.75,
        boxSizing: 'border-box',
      }}
    >
      {showImage ? (
        <Box component="img" src={src as string} alt="" onError={() => setFailed(true)} sx={{ display: 'block', height: '84%', width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />
      ) : (
        <Box component="span" aria-hidden sx={{ fontSize: Math.max(11, height * 0.32), fontWeight: 700, color: 'primary.dark' }}>
          {fallback}
        </Box>
      )}
    </Box>
  )
}
