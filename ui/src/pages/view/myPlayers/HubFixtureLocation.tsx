import { Box, Button as MuiButton } from '@mui/material'
import { compactButtonSx } from '../../../components/Button'
import { useGetDirections } from '../../../components/GetDirectionsButton'
import { WeatherBadge } from '../../../components/WeatherBadge'
import type { MyLeagueFixtureDto } from '../../../api/myPlayersApi'
import { fieldFromMatch, useMatchWeather } from '../../../hooks/useMatchWeather'
import { directionsTarget } from '../../../utils/fieldLocation'
import { HUB } from './hubStyle'

// docs/specs/133 (Player Hub match rows): the forecast badge and the Get Directions button of one fixture, from the position the row
// carries (no second call: a row has no map link or address, so the chain here is the stored position or nothing). The badge sits on a
// cream pill so it stays readable on the dark console; the button is a compact outlined text button, 44 px to touch on a phone.
export function HubFixtureLocation({ row }: { row: MyLeagueFixtureDto }) {
  const field = fieldFromMatch(row)
  const weather = useMatchWeather(row.time ? `${row.date}T${row.time}` : `${row.date}T12:00`, field)
  const target = directionsTarget(field)
  const { start, sheet } = useGetDirections(target)
  if (!weather.summary && !target) return null
  return (
    <Box data-testid="hub-fixture-location" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, pt: 0.5 }}>
      {weather.summary && (
        <Box sx={{ display: 'inline-flex', bgcolor: HUB.cream, borderRadius: 3, maxWidth: '100%' }}>
          <WeatherBadge summary={weather.summary} variant="compact" testId="hub-row-weather" />
        </Box>
      )}
      {target && (
        <MuiButton
          variant="outlined"
          size="small"
          onClick={start}
          data-testid="hub-row-directions"
          sx={{ ...compactButtonSx, color: HUB.cream, borderColor: HUB.line, '&:hover': { borderColor: HUB.cream, bgcolor: HUB.lineSoft }, '&.Mui-focusVisible, &:focus-visible': { outline: `2px solid ${HUB.cream}`, outlineOffset: 2 } }}
        >
          {target.approximate ? 'Get Directions (approximate)' : 'Get Directions'}
        </MuiButton>
      )}
      {sheet}
    </Box>
  )
}
