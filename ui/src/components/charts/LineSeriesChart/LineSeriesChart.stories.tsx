import type { Meta, StoryObj } from '@storybook/react-vite'
import { LineSeriesChart } from './LineSeriesChart'

const labels = ['6 Sep', '13 Sep', '20 Sep', '27 Sep', '4 Oct', '11 Oct', '18 Oct', '25 Oct']

const meta: Meta<typeof LineSeriesChart> = {
  title: 'Components/Charts/LineSeriesChart',
  component: LineSeriesChart,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div style={{ height: 240, maxWidth: 720 }}><Story /></div>],
  args: { labels },
}
export default meta

type Story = StoryObj<typeof LineSeriesChart>

// Economy rate: a broken line across a match without economy, a dashed reference at the overall economy.
export const EconomyRate: Story = {
  args: {
    series: [{ key: 'economy', label: 'Economy', tone: 'info', marker: 'circle', values: [5.6, 5.2, null, 4.9, 4.6, 4.4, 4.1, 3.75], pointTexts: ['5.6', '5.2', null, '4.9', '4.6', '4.4', '4.1', '3.75'] }],
    referenceValue: 4.82,
    referenceLabel: 'Average 4.82',
  },
}

// Run rate trend: two series told apart by marker shape and dash, not colour alone.
export const RunRateTrend: Story = {
  args: {
    series: [
      { key: 'team', label: 'Team', tone: 'primary', marker: 'circle', values: [5, 6, 5.5, 7, 6.8, 7.2, 6.9, 7.6] },
      { key: 'opposition', label: 'Opposition', tone: 'error', marker: 'square', dashed: true, values: [6, 5.5, 6.2, 5.8, 5.9, 5.2, 5.5, 5] },
    ],
  },
}
