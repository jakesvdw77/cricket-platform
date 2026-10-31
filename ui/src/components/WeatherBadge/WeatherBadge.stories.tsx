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
