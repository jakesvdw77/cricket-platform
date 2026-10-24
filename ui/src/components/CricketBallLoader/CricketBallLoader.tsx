import { useId } from 'react'
import { Box } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import { BallArt } from './BallArt'
import { BRAND, blackAlpha } from '../../brandTokens'

// A red cricket ball bouncing on the spot: a squash as it lands, a soft shadow that shrinks as the ball rises and grows as it
// returns, a straight seam that rocks a little as it hops. Inline SVG and CSS only. With `prefers-reduced-motion` the bounce is replaced by a
// gentle opacity pulse. The accessible name is a visually hidden `label` inside a role="status" region.
export type CricketBallSize = 'sm' | 'md' | 'lg'

export interface CricketBallLoaderProps {
  size?: CricketBallSize
  // The accessible name, read by assistive technology (not drawn).
  label?: string
  // 'light' is for the dark backdrop (cream text colour), 'dark' for a light page (ink).
  tone?: 'light' | 'dark'
  testId?: string
}

const BALL_SIZES: Record<CricketBallSize, number> = { sm: 28, md: 56, lg: 88 }
const LOOP = '1.1s'

const bounce = keyframes`
  0% { transform: translateY(0) scale(1.16, 0.84); animation-timing-function: cubic-bezier(0.2, 0.7, 0.35, 1); }
  14% { transform: translateY(calc(var(--hop) * -0.3)) scale(0.97, 1.05); animation-timing-function: cubic-bezier(0.2, 0.6, 0.4, 1); }
  50% { transform: translateY(calc(var(--hop) * -1)) scale(1, 1); animation-timing-function: cubic-bezier(0.6, 0, 0.8, 0.4); }
  86% { transform: translateY(calc(var(--hop) * -0.3)) scale(1, 1.03); animation-timing-function: cubic-bezier(0.5, 0, 0.9, 0.5); }
  100% { transform: translateY(0) scale(1.16, 0.84); }
`
const spin = keyframes`
  from { transform: rotate(-20deg); }
  to { transform: rotate(20deg); }
`
const shadowPulse = keyframes`
  0%, 100% { transform: scaleX(1.1); opacity: 0.4; }
  50% { transform: scaleX(0.45); opacity: 0.15; }
`
const fade = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
`

export function CricketBallLoader({ size = 'md', label = 'Loading', tone = 'light', testId = 'cricket-ball-loader' }: CricketBallLoaderProps) {
  const gradientId = useId()
  const px = BALL_SIZES[size]
  const hop = Math.round(px * 0.6)
  return (
    <Box
      role="status"
      aria-label={label}
      data-testid={testId}
      data-size={size}
      sx={{
        position: 'relative',
        display: 'inline-block',
        width: px,
        // Reserves the hop and the shadow so nothing around it moves.
        height: px + hop + Math.round(px * 0.2),
        color: tone === 'light' ? BRAND.cream : BRAND.ink900,
        '--hop': `${hop}px`,
        '@media (prefers-reduced-motion: reduce)': { animation: `${fade} 1.6s ease-in-out infinite` },
      }}
    >
      <Box
        component="span"
        sx={{ position: 'absolute', width: 1, height: 1, p: 0, m: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}
      >
        {label}
      </Box>
      <Box
        aria-hidden
        data-testid="cricket-ball-shadow"
        sx={{
          position: 'absolute',
          left: '10%',
          bottom: 0,
          width: '80%',
          height: Math.max(4, Math.round(px * 0.14)),
          borderRadius: '50%',
          bgcolor: blackAlpha(0.45),
          filter: 'blur(2px)',
          animation: `${shadowPulse} ${LOOP} linear infinite`,
          '@media (prefers-reduced-motion: reduce)': { animation: 'none', transform: 'scaleX(0.8)', opacity: 0.3 },
        }}
      />
      <Box
        aria-hidden
        data-testid="cricket-ball"
        sx={{
          position: 'absolute',
          left: 0,
          bottom: Math.round(px * 0.1),
          width: px,
          height: px,
          transformOrigin: '50% 100%',
          animation: `${bounce} ${LOOP} infinite`,
          '@media (prefers-reduced-motion: reduce)': { animation: 'none', transform: `translateY(calc(var(--hop) * -0.5))` },
        }}
      >
        <Box
          component="svg"
          viewBox="0 0 64 64"
          width={px}
          height={px}
          sx={{
            display: 'block',
            animation: `${spin} ${LOOP} ease-in-out infinite alternate`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        >
          <defs>
            <radialGradient id={gradientId} cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor={BRAND.ballRed} />
              <stop offset="100%" stopColor={BRAND.ballRedShade} />
            </radialGradient>
          </defs>
          <BallArt fill={`url(#${gradientId})`} />
        </Box>
      </Box>
    </Box>
  )
}
