import type { Meta, StoryObj } from '@storybook/react-vite'
import { StackedBarChart } from './StackedBarChart'
import { CATEGORY_STYLES, NOT_ITEMISED_STYLE } from '../chartStyles'
import { ChartLegend } from '../ChartLegend'

const categories = [
  { key: 'wides', label: 'Wides', style: CATEGORY_STYLES[1] },
  { key: 'noBalls', label: 'No-balls', style: CATEGORY_STYLES[2] },
  { key: 'byes', label: 'Byes', style: CATEGORY_STYLES[3] },
  { key: 'legByes', label: 'Leg-byes', style: CATEGORY_STYLES[4] },
  { key: 'penalty', label: 'Penalty', style: CATEGORY_STYLES[5] },
  { key: 'notItemised', label: 'Not itemised', style: NOT_ITEMISED_STYLE },
]

const meta: Meta<typeof StackedBarChart> = {
  title: 'Components/Charts/StackedBarChart',
  component: StackedBarChart,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720 }}>
        <div style={{ height: 240 }}><Story /></div>
        <ChartLegend items={categories.map((category) => ({ key: category.key, label: category.label, style: category.style }))} label="Extras types" />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof StackedBarChart>

// Extras conceded: a segment per recorded type, a grey Not itemised bar for a total-only match, a gap where nothing was recorded.
export const ExtrasConceded: Story = {
  args: {
    labels: ['6 Sep', '13 Sep', '20 Sep', '27 Sep', '4 Oct', '11 Oct'],
    categories,
    values: [
      [6, 4, null, null, 3, 2],
      [3, 2, null, null, 2, 1],
      [2, 1, null, null, 1, 1],
      [2, 1, null, null, 1, 3],
      [5, 0, null, null, 0, 0],
      [null, null, null, 14, null, null],
    ],
    totals: [18, 8, null, 14, 7, 7],
  },
}
