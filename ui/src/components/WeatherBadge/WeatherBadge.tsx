import { Box } from '@mui/material'
import { alpha } from '@mui/material/styles'
import AcUnitOutlinedIcon from '@mui/icons-material/AcUnitOutlined'
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined'
import FilterDramaOutlinedIcon from '@mui/icons-material/FilterDramaOutlined'
import ThunderstormOutlinedIcon from '@mui/icons-material/ThunderstormOutlined'
import UmbrellaOutlinedIcon from '@mui/icons-material/UmbrellaOutlined'
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined'
import DensitySmallOutlinedIcon from '@mui/icons-material/DensitySmallOutlined'
import type { ReactNode } from 'react'
import type { WeatherIconKind, WeatherSummary } from '../../utils/weather/wmo'

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
}

// docs/specs/131-match-sharing.md (Weather): the forecast as a pill, an icon under 32 px plus words. Never colour or icon alone.
export function WeatherBadge({ summary, variant = 'full', testId = 'weather-badge' }: WeatherBadgeProps) {
  if (!summary) return null
  return (
    <Box
      role="img"
      aria-label={`Forecast: ${summary.text}`}
      data-testid={testId}
      sx={(theme) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        maxWidth: '100%',
        minHeight: 24,
        px: 1.1,
        borderRadius: 3,
        fontSize: '0.78rem',
        fontWeight: 600,
        color: 'primary.dark',
        bgcolor: alpha(theme.palette.secondary.main, 0.16),
        border: `1px solid ${alpha(theme.palette.secondary.main, 0.55)}`,
      })}
    >
      <Box component="span" aria-hidden sx={{ display: 'inline-flex', fontSize: 16 }}>
        {ICONS[summary.icon]}
      </Box>
      <Box component="span" aria-hidden sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        {variant === 'full' ? summary.text : summary.short}
      </Box>
    </Box>
  )
}
