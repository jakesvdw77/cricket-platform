import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MatchWeatherDialog } from './MatchWeatherDialog'
import type { WeatherSummary } from '../../utils/weather/wmo'

const summary: WeatherSummary = { label: 'Mostly sunny', icon: 'sunny', tempMin: 14, tempMax: 27, rainChance: 20, text: 'Mostly sunny, 14 to 27 degrees, 20% rain', short: '14 to 27 degrees, 20% rain', lines: ['Dry through the morning.', 'A light breeze from the west.'] }

describe('MatchWeatherDialog', () => {
  it('shows the match, the forecast and each plain-language line', () => {
    render(<MatchWeatherDialog open onClose={vi.fn()} title="Vets A v Oakfield" subtitle="Thu 5 Nov, 09:15 · Hofmeyer Park" summary={summary} />)
    expect(screen.getByRole('dialog', { name: 'Weather Forecast' })).toBeInTheDocument()
    expect(screen.getByText('Vets A v Oakfield')).toBeInTheDocument()
    expect(screen.getAllByTestId('match-weather-dialog-line')).toHaveLength(2)
  })

  it('closes from Done', async () => {
    const onClose = vi.fn()
    render(<MatchWeatherDialog open onClose={onClose} title="Vets A v Oakfield" summary={summary} />)
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders nothing without a forecast', () => {
    const { container } = render(<MatchWeatherDialog open onClose={vi.fn()} title="x" summary={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
