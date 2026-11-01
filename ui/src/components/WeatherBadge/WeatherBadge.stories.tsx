import type { Meta, StoryObj } from '@storybook/react-vite'
import { WeatherBadge } from './WeatherBadge'
import { summariseForecast } from '../../utils/weather/wmo'

const sunny = summariseForecast({ date: '2026-11-06', code: 1, tempMax: 27, tempMin: 14, rainChance: 20 })

const meta: Meta<typeof WeatherBadge> = {
  title: 'Components/WeatherBadge',
  component: WeatherBadge,
  args: { summary: sunny },
}
export default meta

type Story = StoryObj<typeof WeatherBadge>

export const Full: Story = {}
export const Compact: Story = { args: { variant: 'compact' } }
export const Storm: Story = { args: { summary: summariseForecast({ date: '2026-11-06', code: 95, tempMax: 22, tempMin: 15, rainChance: 80 }) } }
export const NoForecastRendersNothing: Story = { args: { summary: null } }
export const DarkTone: Story = { args: { variant: 'compact', tone: 'dark' }, parameters: { backgrounds: { default: 'dark' } } }
export const WithMatchHoursTooltip: Story = {
  args: { variant: 'compact', summary: { ...sunny, short: '24-31 degrees, rain 4-39%', text: 'Mostly sunny, 24-31 degrees, rain 4-39%', lines: ['Dry until about 13:00, showers likely after 14:00', 'Breezy: gusts up to 34 km/h', 'Sunset 18:40'] } },
}
