import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChartLegend } from './ChartLegend'
import { CATEGORY_STYLES, NOT_ITEMISED_STYLE } from '../chartStyles'

const meta: Meta<typeof ChartLegend> = { title: 'Components/Charts/ChartLegend', component: ChartLegend, parameters: { layout: 'padded' } }
export default meta

type Story = StoryObj<typeof ChartLegend>

export const Bars: Story = {
  args: {
    items: [
      { key: 'a', label: 'Out', style: CATEGORY_STYLES[0] },
      { key: 'b', label: 'Not out (*)', style: { tone: 'primary', pattern: 'diagonal' } },
      { key: 'c', label: 'Not itemised', style: NOT_ITEMISED_STYLE },
    ],
  },
}

export const Lines: Story = {
  args: {
    items: [
      { key: 'a', label: 'Team run rate', line: { tone: 'primary', marker: 'circle' } },
      { key: 'b', label: 'Opposition run rate', line: { tone: 'error', marker: 'square', dashed: true } },
      { key: 'c', label: 'Net run rate', line: { tone: 'info', marker: 'diamond' } },
    ],
  },
}
