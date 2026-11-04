import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMatchLocationItems } from './useMatchLocationItems'
import type { DirectionsTarget } from '../utils/fieldLocation'
import type { MatchWeather } from './useMatchWeather'

const directions = vi.hoisted(() => ({ value: null as DirectionsTarget | null }))
const weather = vi.hoisted(() => ({ value: { status: 'none', summary: null } as MatchWeather }))
vi.mock('./useMatchWeather', () => ({
  useMatchDirections: () => directions.value,
  useMatchFieldWeather: () => weather.value,
}))

const target: DirectionsTarget = { name: 'Hofmeyer Park', point: { lat: -25.7, lng: 28.2 }, addressText: 'Hofmeyer Park', approximate: false, viaAccess: false, accessNote: null }
const forecast: MatchWeather = { status: 'ready', summary: { label: 'Sunny', icon: 'sunny', tempMin: 14, tempMax: 27, rainChance: 0, text: 'Sunny, 14 to 27 degrees, dry', short: '14 to 27', lines: ['Dry all morning.'] } }

function Probe() {
  const { items, dialogs } = useMatchLocationItems('club-1', { matchDate: '2030-06-01T09:00:00Z', playingAreaId: 'f1', venue: 'Hofmeyer Park' }, { title: 'Vets A v Oakfield' })
  return (
    <div>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={item.onClick}>
              {item.title}
            </button>
          </li>
        ))}
      </ul>
      {dialogs}
    </div>
  )
}

describe('useMatchLocationItems', () => {
  beforeEach(() => {
    directions.value = null
    weather.value = { status: 'none', summary: null }
  })

  it('hides both items when there is no position and no forecast', () => {
    render(<Probe />)
    expect(screen.queryByRole('button', { name: 'Get Directions' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show Weather Forecast' })).not.toBeInTheDocument()
  })

  it('lists Get Directions when the field has a position and Show Weather Forecast when there is a forecast, and the latter opens the modal', async () => {
    directions.value = target
    weather.value = forecast
    render(<Probe />)
    expect(screen.getByRole('button', { name: 'Get Directions' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show Weather Forecast' }))
    expect(await screen.findByRole('dialog', { name: 'Weather Forecast' })).toBeInTheDocument()
    expect(screen.getByText('Dry all morning.')).toBeInTheDocument()
  })
})
