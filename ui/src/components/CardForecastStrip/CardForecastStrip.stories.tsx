import type { Meta, StoryObj } from '@storybook/react-vite'
import { CardForecastStrip } from './CardForecastStrip'

const day = 86_400_000

const meta: Meta<typeof CardForecastStrip> = { title: 'Components/CardForecastStrip', component: CardForecastStrip, args: { matchDate: new Date(Date.now() + 12 * day).toISOString() } }
export default meta

type Story = StoryObj<typeof CardForecastStrip>

export const NotAvailableTooFar: Story = { args: { weather: { status: 'none', summary: null } } }
export const Forecast: Story = {
  args: {
    matchDate: new Date(Date.now() + day).toISOString(),
    weather: { status: 'ready', summary: { label: 'Drizzle', icon: 'rain', tempMin: 22, tempMax: 30, rainChance: 0, text: 'Drizzle, 22-30 degrees, dry', short: '22-30 degrees', lines: [] } },
  },
}
