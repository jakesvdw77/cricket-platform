import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CardForecastStrip, forecastUnavailableReason } from './CardForecastStrip'
import type { MatchWeather } from '../../hooks/useMatchWeather'

const day = 86_400_000
const at = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString()

describe('forecastUnavailableReason', () => {
  it('says why: played, too far ahead, or no field location', () => {
    expect(forecastUnavailableReason(at(-3))).toMatch(/played/)
    expect(forecastUnavailableReason(at(12))).toMatch(/6 days before/)
    expect(forecastUnavailableReason(at(2))).toMatch(/no location/)
  })
})

describe('CardForecastStrip', () => {
  it('shows the forecast when there is one', () => {
    const weather: MatchWeather = { status: 'ready', summary: { label: 'Drizzle', icon: 'rain', tempMin: 22, tempMax: 30, rainChance: 0, text: 'Drizzle, 22-30 degrees, dry', short: '22-30', lines: [] } }
    render(<CardForecastStrip weather={weather} matchDate={at(1)} />)
    expect(screen.getByTestId('card-forecast')).toHaveTextContent('Drizzle, 22-30 degrees, dry')
  })

  it('shows "Not available" with the reason instead of leaving an empty space', () => {
    render(<CardForecastStrip weather={{ status: 'none', summary: null }} matchDate={at(12)} />)
    expect(screen.getByTestId('card-forecast')).toHaveTextContent('Forecast')
    expect(screen.getByTestId('card-forecast')).toHaveTextContent('Not available: available from 6 days before the match')
  })

  it('says Loading while the forecast is fetched', () => {
    render(<CardForecastStrip weather={{ status: 'loading', summary: null }} matchDate={at(1)} />)
    expect(screen.getByTestId('card-forecast')).toHaveTextContent('Loading')
  })
})
