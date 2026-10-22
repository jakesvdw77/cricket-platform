import type { Meta, StoryObj } from '@storybook/react-vite'
import { DonutChart } from './DonutChart'
import { CATEGORY_STYLES, NOT_ITEMISED_STYLE } from '../chartStyles'

const meta: Meta<typeof DonutChart> = {
  title: 'Components/Charts/DonutChart',
  component: DonutChart,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
}
export default meta

type Story = StoryObj<typeof DonutChart>

// Wickets by type: a patterned slice per type and a grey Not itemised remainder; the percentages come from the server.
export const WicketsByType: Story = {
  args: {
    centerValue: '19',
    centerLabel: 'wickets',
    slices: [
      { key: 'bowled', label: 'Bowled', value: 6, percentText: '32%', style: CATEGORY_STYLES[0] },
      { key: 'caught', label: 'Caught', value: 7, percentText: '37%', style: CATEGORY_STYLES[1] },
      { key: 'lbw', label: 'LBW', value: 2, percentText: '11%', style: CATEGORY_STYLES[2] },
      { key: 'stumped', label: 'Stumped', value: 1, percentText: '5%', style: CATEGORY_STYLES[3] },
      { key: 'hitWicket', label: 'Hit wicket', value: 1, percentText: '5%', style: CATEGORY_STYLES[4] },
      { key: 'notItemised', label: 'Not itemised', value: 2, percentText: '11%', style: NOT_ITEMISED_STYLE },
    ],
  },
}

// Every wicket not itemised: one grey slice.
export const AllNotItemised: Story = {
  args: { centerValue: '5', centerLabel: 'wickets', slices: [{ key: 'notItemised', label: 'Not itemised', value: 5, percentText: '100%', style: NOT_ITEMISED_STYLE }] },
}
