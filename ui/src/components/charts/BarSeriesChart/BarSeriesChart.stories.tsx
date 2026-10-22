import type { Meta, StoryObj } from '@storybook/react-vite'
import { BarSeriesChart } from './BarSeriesChart'

const labels = ['6 Sep', '13 Sep', '20 Sep', '27 Sep', '4 Oct', '11 Oct', '18 Oct', '25 Oct']
const values = [34, 0, 56, 12, null, 41, 23, 94]
const hatched = [false, false, true, false, false, false, false, true]

const meta: Meta<typeof BarSeriesChart> = {
  title: 'Components/Charts/BarSeriesChart',
  component: BarSeriesChart,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div style={{ height: 240, maxWidth: 720 }}><Story /></div>],
  args: { labels, values, valueTexts: values.map((value, index) => (value === null ? null : hatched[index] ? `${value}*` : String(value))) },
}
export default meta

type Story = StoryObj<typeof BarSeriesChart>

// Runs per innings: a not-out bar is hatched and starred, a missing innings is a labelled gap, the dashed line is the average.
export const RunsPerInnings: Story = { args: { hatched, referenceValue: 37.5, referenceLabel: 'Avg 37.5' } }

// Dot balls: one 0 to 100 scale.
export const Percentage: Story = {
  args: { values: [31.5, 33, null, 38, 39, 40, 39.5, 41], valueTexts: ['31.5', '33.0', null, '38.0', '39.0', '40.0', '39.5', '41.0'], max: 100, referenceValue: 37.4, referenceLabel: 'Average 37.4%', gapText: 'n/r' },
}
