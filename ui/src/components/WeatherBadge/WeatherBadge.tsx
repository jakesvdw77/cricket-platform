import { Box, Tooltip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { BRAND, FONT_DISPLAY } from '../../brandTokens'
import AcUnitOutlinedIcon from '@mui/icons-material/AcUnitOutlined'
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined'
import FilterDramaOutlinedIcon from '@mui/icons-material/FilterDramaOutlined'
import ThunderstormOutlinedIcon from '@mui/icons-material/ThunderstormOutlined'
import UmbrellaOutlinedIcon from '@mui/icons-material/UmbrellaOutlined'
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined'
import DensitySmallOutlinedIcon from '@mui/icons-material/DensitySmallOutlined'
import type { ReactNode } from 'react'
import type { WeatherIconKind, WeatherSummary } from '../../utils/weather/wmo'

// The weather icon (MUI, under 32 px) for an icon kind; decoration only, the words carry the meaning.
export function WeatherIcon({ kind }: { kind: WeatherIconKind }) {
  return <>{ICONS[kind]}</>
}

const ICONS: Record<WeatherIconKind, ReactNode> = {
  sunny: <WbSunnyOutlinedIcon fontSize="inherit" />,
  partly: <FilterDramaOutlinedIcon fontSize="inherit" />,
  cloudy: <CloudOutlinedIcon fontSize="inherit" />,
  fog: <DensitySmallOutlinedIcon fontSize="inherit" />,
  rain: <UmbrellaOutlinedIcon fontSize="inherit" />,
  snow: <AcUnitOutlinedIcon fontSize="inherit" />,
  storm: <ThunderstormOutlinedIcon fontSize="inherit" />,
}

export interface WeatherBadgeProps {
  // The forecast; null or undefined renders nothing (no placeholder, no error: docs/specs/131).
  summary: WeatherSummary | null | undefined
  // `full` reads "Mostly sunny, 14 to 27 degrees, 20% rain"; `compact` reads "14 to 27 degrees, 20% rain" (the icon still
  // carries the conditions and the accessible name is always the full text).
  variant?: 'full' | 'compact'
  testId?: string
  // `light` (default): green text on a gold tint, for white and cream surfaces. `dark`: cream text on a cream hairline, gold icon, for the Player Hub console.
  tone?: 'light' | 'dark'
}

// docs/specs/131-match-sharing.md (Weather): the forecast as a pill, an icon under 32 px plus words. Never colour or icon alone.
// docs/specs/135: when the summary carries match-hours `lines`, hover, keyboard focus or a tap on the badge opens a tooltip listing them
// (no scrolling or moving text anywhere).
export function WeatherBadge({ summary, variant = 'full', testId = 'weather-badge', tone = 'light' }: WeatherBadgeProps) {
  if (!summary) return null
  const lines = summary.lines ?? []
  const badge = (
    <Box
      role="img"
      tabIndex={lines.length > 0 ? 0 : undefined}
      aria-label={`Forecast: ${summary.text}`}
      data-testid={testId}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        maxWidth: '100%',
        minHeight: 24,
        px: 1.1,
        borderRadius: 3,
        fontFamily: FONT_DISPLAY,
        fontSize: '0.95rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        color: tone === 'dark' ? BRAND.cream : BRAND.green900,
        bgcolor: tone === 'dark' ? alpha(BRAND.cream, 0.08) : alpha(BRAND.gold, 0.18),
        border: `1px solid ${tone === 'dark' ? alpha(BRAND.cream, 0.28) : alpha(BRAND.gold, 0.6)}`,
        '&:focus-visible': { outline: `2px solid ${tone === 'dark' ? BRAND.gold : BRAND.green700}`, outlineOffset: 2 },
      }}
    >
      <Box component="span" aria-hidden sx={{ display: 'inline-flex', fontSize: 16, color: tone === 'dark' ? BRAND.gold : BRAND.green700 }}>
        {ICONS[summary.icon]}
      </Box>
      <Box component="span" aria-hidden sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        {variant === 'full' ? summary.text : summary.short}
      </Box>
    </Box>
  )
  if (lines.length === 0) return badge
  return (
    <Tooltip
      arrow
      placement="bottom-end"
      enterTouchDelay={0}
      leaveTouchDelay={5000}
      title={
        <Box component="span" data-testid={`${testId}-tooltip`} sx={{ display: 'grid', gap: 0.25 }}>
          {lines.map((line) => (
            <Typography key={line} component="span" sx={{ fontSize: 13 }}>{line}</Typography>
          ))}
        </Box>
      }
    >
      {badge}
    </Tooltip>
  )
}
