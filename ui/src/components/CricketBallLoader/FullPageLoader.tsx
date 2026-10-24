import { Box, Typography } from '@mui/material'
import { PageBackdrop, BACKDROP_COLOURS } from '../PageBackdrop'
import { FONT_DISPLAY } from '../../brandTokens'
import { CricketBallLoader } from './CricketBallLoader'
import type { CricketBallSize } from './CricketBallLoader'

// A whole-page wait: the cricket ball centred with an optional line under it. 'backdrop' draws it on the dark cricket-scene
// PageBackdrop with the Cricket Legend mark above (sign-in and sign-out screens); 'plain' is the ball alone on the page
// (waits inside the app shells). `overlay` pins it over everything (the sign-out screen shows while the browser leaves).
export interface FullPageLoaderProps {
  message?: string
  // The accessible name; defaults to the message, then "Loading".
  label?: string
  variant?: 'backdrop' | 'plain'
  size?: CricketBallSize
  overlay?: boolean
  testId?: string
}

export function FullPageLoader({ message, label, variant = 'plain', size, overlay = false, testId = 'full-page-loader' }: FullPageLoaderProps) {
  const backdrop = variant === 'backdrop'
  const content = (
    <Box
      data-testid={testId}
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        textAlign: 'center',
        px: 2,
        py: backdrop ? 4 : 8,
        minHeight: backdrop ? '100vh' : '50vh',
      }}
    >
      {backdrop && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: BACKDROP_COLOURS.cream, mb: 2 }}>
          <Box component="img" src="/favicon.svg" alt="" width={40} height={40} />
          <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 28, letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1 }}>
            Cricket Legend
          </Typography>
        </Box>
      )}
      <CricketBallLoader size={size ?? (backdrop ? 'lg' : 'md')} tone={backdrop ? 'light' : 'dark'} label={label ?? message ?? 'Loading'} />
      {message && (
        <Typography aria-hidden sx={{ color: backdrop ? BACKDROP_COLOURS.cream : 'text.secondary', fontSize: backdrop ? 18 : 15, fontWeight: 500 }}>
          {message}
        </Typography>
      )}
    </Box>
  )
  if (!backdrop) return content
  if (overlay) return <Box sx={{ position: 'fixed', inset: 0, zIndex: (theme) => theme.zIndex.modal + 10, display: 'flex', '& > *': { flex: 1 } }}><PageBackdrop>{content}</PageBackdrop></Box>
  return <PageBackdrop>{content}</PageBackdrop>
}
