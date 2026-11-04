import { useState } from 'react'
import type { ReactNode } from 'react'
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined'
import { directionsMenuItems, useGetDirections } from '../components/GetDirectionsButton/GetDirectionsButton'
import type { ManageMenuItem } from '../components/ManageMenu'
import { MatchWeatherDialog } from '../components/MatchWeatherDialog'
import type { Match } from '../api/matchApi'
import { formatMatchDateTime } from '../utils/matchDateTime'
import { useMatchDirections, useMatchFieldWeather } from './useMatchWeather'
import type { MatchFieldPosition } from './useMatchWeather'

// docs/specs/137 (owner, 2026-11-05): the Get Directions and Show Weather Forecast items of a match menu (the Matches list and Team Selection
// rows, cards and Manage Team). Each is hidden, not disabled, when there is nothing to show (no usable position, or no forecast: the match
// is out of range). Get Directions runs the shared hook; Show Weather Forecast opens the modal. Render `dialogs` next to the menu.
export function useMatchLocationItems(
  clubId: string | undefined,
  match: (Pick<Match, 'matchDate' | 'playingAreaId'> & MatchFieldPosition) | null | undefined,
  options: { title: string; leagueFormat?: string | null },
): { items: ManageMenuItem[]; dialogs: ReactNode; directions: ReturnType<typeof useMatchDirections>; weather: ReturnType<typeof useMatchFieldWeather> } {
  const directions = useMatchDirections(clubId, match)
  const weather = useMatchFieldWeather(clubId, match, undefined, options.leagueFormat)
  const { start, sheet } = useGetDirections(directions)
  const [weatherOpen, setWeatherOpen] = useState(false)
  const items: ManageMenuItem[] = [
    ...directionsMenuItems(directions, start),
    ...(weather.summary
      ? [
          {
            id: 'weather',
            title: 'Show Weather Forecast',
            description: 'The forecast for the match hours.',
            icon: <CloudOutlinedIcon fontSize="small" />,
            onClick: () => setWeatherOpen(true),
          },
        ]
      : []),
  ]
  const subtitle = match ? [formatMatchDateTime(match.matchDate), match.playingAreaName ?? match.venue].filter(Boolean).join(' · ') : undefined
  const dialogs = (
    <>
      {sheet}
      <MatchWeatherDialog open={weatherOpen} onClose={() => setWeatherOpen(false)} title={options.title} subtitle={subtitle} summary={weather.summary} />
    </>
  )
  return { items, dialogs, directions, weather }
}
