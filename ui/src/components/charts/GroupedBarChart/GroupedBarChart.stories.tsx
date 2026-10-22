import type { Meta, StoryObj } from '@storybook/react-vite'
import { GroupedBarChart } from './GroupedBarChart'

const meta: Meta<typeof GroupedBarChart> = {
  title: 'Components/Charts/GroupedBarChart',
  component: GroupedBarChart,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div style={{ height: 240, maxWidth: 720 }}><Story /></div>],
}
export default meta

type Story = StoryObj<typeof GroupedBarChart>

// Runs scored (solid) against conceded (hatched), the result letter in the axis label; a forfeit is a labelled gap.
export const ScoredVersusConceded: Story = {
  args: {
    labels: ['6 Sep W', '13 Sep L', '20 Sep W', '27 Sep W', '4 Oct W', '11 Oct L'],
    gapTexts: [null, null, null, null, 'forfeit', null],
    series: [
      { key: 'scored', label: 'Scored', style: { tone: 'primary', pattern: 'solid' }, values: [152, 98, 187, 164, null, 74] },
      { key: 'conceded', label: 'Conceded', style: { tone: 'error', pattern: 'diagonal' }, values: [140, 120, 150, 160, null, 90] },
    ],
  },
}
