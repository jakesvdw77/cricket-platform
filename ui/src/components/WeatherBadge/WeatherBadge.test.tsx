import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material'
import { describe, expect, it } from 'vitest'
import { WeatherBadge } from './WeatherBadge'
import { baseTheme } from '../../theme'
import { summariseForecast } from '../../utils/weather/wmo'

const summary = summariseForecast({ date: '2026-11-06', code: 1, tempMax: 27.2, tempMin: 13.6, rainChance: 20 })
const wrap = (node: React.ReactNode) => render(<ThemeProvider theme={baseTheme}>{node}</ThemeProvider>)

describe('WeatherBadge', () => {
  it('says the conditions in words and uses them as the accessible name', () => {
    wrap(<WeatherBadge summary={summary} />)
    const badge = screen.getByRole('img', { name: 'Forecast: Mostly sunny, 14 to 27 degrees, 20% rain' })
    expect(badge).toHaveTextContent('Mostly sunny, 14 to 27 degrees, 20% rain')
  })

  it('the compact form shortens the text but keeps the full accessible name', () => {
    wrap(<WeatherBadge summary={summary} variant="compact" />)
    const badge = screen.getByTestId('weather-badge')
    expect(badge).toHaveTextContent('14 to 27 degrees, 20% rain')
    expect(badge).not.toHaveTextContent('Mostly sunny')
    expect(badge).toHaveAccessibleName('Forecast: Mostly sunny, 14 to 27 degrees, 20% rain')
  })

  it('renders nothing, no placeholder, without a forecast', () => {
    const { container } = wrap(<WeatherBadge summary={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
