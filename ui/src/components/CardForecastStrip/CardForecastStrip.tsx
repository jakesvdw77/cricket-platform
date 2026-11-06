import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined'
import { CardTimeStrip } from '../CardTimeStrip'
import { WeatherIcon } from '../WeatherBadge'
import type { MatchWeather } from '../../hooks/useMatchWeather'
import { daysUntil, inForecastRange } from '../../utils/weather/forecastWindow'

export interface CardForecastStripProps {
  weather: MatchWeather
  matchDate: string
  testId?: string
  // The venue line (owner, 2026-11-06: the venue is part of the weather information on a match card), shown inside the strip.
  venue?: ReactNode
}

// Why there is no forecast, in words (never an empty space): the match is past, too far ahead (the provider only forecasts today and the next
// six days) or its field has no location the forecast can use.
export function forecastUnavailableReason(matchDate: string, now: Date = new Date()): string {
  const days = daysUntil(matchDate, now)
  if (Number.isFinite(days) && days < 0) return 'the match has been played'
  if (Number.isFinite(days) && !inForecastRange(matchDate, now)) return 'available from 6 days before the match'
  return 'the field has no location'
}

// docs/specs/137 (owner, 2026-11-05): the forecast strip card of a match card or page. It always shows: the forecast when there is one, a
// quiet "Loading" while it is fetched, and otherwise "Not available" with the reason, instead of leaving an empty space.
export function CardForecastStrip({ weather, matchDate, testId = 'card-forecast', venue }: CardForecastStripProps) {
  if (weather.summary) {
    return <CardTimeStrip testId={testId} icon={<WeatherIcon kind={weather.summary.icon} />} label="Forecast" value={weather.summary.text} below={venue} />
  }
  const note = weather.status === 'loading' ? 'Loading' : `Not available: ${forecastUnavailableReason(matchDate)}`
  return (
    <CardTimeStrip
      testId={testId}
      icon={<CloudOffOutlinedIcon fontSize="small" />}
      label="Forecast"
      below={venue}
      value={
        <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.875rem' }}>
          {note}
        </Box>
      }
    />
  )
}
