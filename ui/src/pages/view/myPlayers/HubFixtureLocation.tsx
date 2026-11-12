import { useState } from 'react'
import { Box, Button as MuiButton, ButtonBase, Collapse, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { compactButtonSx } from '../../../components/Button'
import { useGetDirections } from '../../../components/GetDirectionsButton'
import { WeatherBadge, WeatherIcon } from '../../../components/WeatherBadge'
import type { MyLeagueFixtureDto } from '../../../api/myPlayersApi'
import { fieldFromMatch, useMatchWeather } from '../../../hooks/useMatchWeather'
import type { MatchFieldPosition } from '../../../hooks/useMatchWeather'
import { blackAlpha } from '../../../brandTokens'
import { directionsTarget } from '../../../utils/fieldLocation'
import { HUB } from './hubStyle'

// docs/specs/133 and 135 (Player Hub match blocks, owner decision 2026-11-02): two small pieces that every Hub match block shares.
//  - HubWeatherBadge: the match-hours forecast badge for the top right corner of the block (a phone drops it under the time). It sits
//    on a cream pill so it stays readable on the dark console; hover, focus or a tap opens the tooltip with the hour-by-hour detail.
//  - HubVenueLine: the VENUE line, its own standout line: small caps label, the field name heavier, Get Directions at the right end
//    so it is always in the same place. No venue reads "TBC" with no button; a free-text venue is plain text (no position, no button).
// The position comes from the row (no second call: a row has no map link or address, so the chain here is the stored position or nothing).

type FixtureRow = Pick<MyLeagueFixtureDto, 'date' | 'time'> & MatchFieldPosition

export function HubWeatherBadge({ row, format }: { row: FixtureRow; format?: string | null }) {
  const field = fieldFromMatch(row)
  // A match with no start time uses 09:00 (docs/specs/135, open question 6).
  const weather = useMatchWeather(row.time ? `${row.date}T${row.time}` : `${row.date}T09:00`, field, undefined, format)
  if (!weather.summary) return null
  return (
    <Box data-testid="hub-weather" sx={{ display: 'inline-flex', maxWidth: '100%', pointerEvents: 'auto', ml: { sm: 'auto' } }}>
      <WeatherBadge summary={weather.summary} variant="compact" testId="hub-row-weather" tone="dark" />
    </Box>
  )
}

// Get Directions for a field position; nothing when there is no usable position (a free-text venue, no venue).
export function HubDirectionsButton({ row, venue }: { row?: MatchFieldPosition | null; venue?: string | null }) {
  const field = fieldFromMatch(row ? { ...row, venue: row.venue ?? venue } : { venue })
  const target = row ? directionsTarget(field) : null
  const { start, sheet } = useGetDirections(target)
  if (!target) return null
  return (
    <>
      <MuiButton
        variant="outlined"
        size="small"
        onClick={start}
        data-testid="hub-row-directions"
        sx={{ ...compactButtonSx, flex: 'none', bgcolor: 'transparent', color: HUB.cream, borderColor: HUB.line, '&:hover': { borderColor: HUB.cream, bgcolor: HUB.lineSoft }, '&.Mui-focusVisible, &:focus-visible': { outline: `2px solid ${HUB.cream}`, outlineOffset: 2 } }}
      >
        {target.approximate ? 'Get Directions (approximate)' : 'Get Directions'}
      </MuiButton>
      {sheet}
    </>
  )
}

export function HubVenueLine({ row, venue, withDirections = true }: { row?: MatchFieldPosition | null; venue?: string | null; withDirections?: boolean }) {
  const name = row?.playingAreaName || row?.venue || venue || ''
  return (
    <Box data-testid="hub-venue-line" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
        <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: HUB.muted, flex: 'none' }}>
          Venue
        </Typography>
        <Typography component="span" data-testid="hub-venue-name" sx={{ fontSize: 16, fontWeight: 700, color: HUB.cream, overflowWrap: 'anywhere' }}>
          {name || 'TBC'}
        </Typography>
      </Box>
      {withDirections && <HubDirectionsButton row={row} venue={venue} />}
    </Box>
  )
}

// docs/specs/135 (match page): the "Weather Forecast" panel directly under the counters, expandable. Collapsed (always on a new visit) it shows the
// title, the one-line match-hours range in the display face with the weather icon, and a chevron toggle; expanded it lists the plain-language
// lines. Omitted when out of forecast range or the field has no location.
export function HubWeatherPanel({ match, format }: { match: FixtureRow & { phase?: string }; format?: string | null }) {
  const [open, setOpen] = useState(false)
  const field = fieldFromMatch(match)
  const weather = useMatchWeather(match.time ? `${match.date}T${match.time}` : `${match.date}T09:00`, field, undefined, format)
  if (!weather.summary || (match.phase !== 'UPCOMING' && match.phase !== 'LIVE')) return null
  const lines = weather.summary.lines ?? []
  return (
    <Box data-testid="match-weather-panel" component="section" aria-label="Weather Forecast" sx={{ border: 1, borderColor: HUB.line, borderRadius: '4px', bgcolor: blackAlpha(0.22) }}>
      <Typography component="h3" sx={{ m: 0 }}>
        <ButtonBase
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="match-weather-detail"
          data-testid="match-weather-toggle"
          sx={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, textAlign: 'left', p: 1.5, color: 'inherit', '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: -2 } }}
        >
          <Box component="span" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0 }}>
            <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: HUB.muted }}>Weather Forecast</Typography>
            <Box component="span" data-testid="match-weather-range" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontFamily: HUB.display, fontWeight: 700, fontSize: 19, color: HUB.gold }}>
              <Box component="span" aria-hidden sx={{ display: 'inline-flex', fontSize: 20 }}>
                <WeatherIcon kind={weather.summary.icon} />
              </Box>
              {weather.summary.short}
            </Box>
          </Box>
          <ExpandMoreIcon aria-hidden sx={{ flex: 'none', color: HUB.sand, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
        </ButtonBase>
      </Typography>
      <Collapse in={open} unmountOnExit>
        <Box id="match-weather-detail" component="ul" sx={{ listStyle: 'none', m: 0, mx: 1.5, mb: 1.5, p: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', fontSize: 15 }}>
          {lines.map((line) => (
            <Box component="li" key={line} data-testid="match-weather-line" sx={{ py: 0.75, borderTop: 1, borderColor: HUB.lineSoft }}>
              {line}
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}
