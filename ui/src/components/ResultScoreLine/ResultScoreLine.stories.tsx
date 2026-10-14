import type { Meta, StoryObj } from '@storybook/react-vite'
import { ResultScoreLine } from './ResultScoreLine'

const meta: Meta<typeof ResultScoreLine> = {
  title: 'Components/ResultScoreLine',
  component: ResultScoreLine,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof ResultScoreLine>

export const Default: Story = {
  args: { innings: [{ kind: 'REGULAR', battingSide: 'HOME', runs: 212, wickets: 6, balls: 240 }] },
}

export const Winner: Story = {
  args: { ...Default.args, winner: true },
}

export const WithSuperOver: Story = {
  args: {
    innings: [
      { kind: 'REGULAR', battingSide: 'HOME', runs: 200, wickets: 8, balls: 240 },
      { kind: 'SUPER_OVER', battingSide: 'HOME', runs: 12, wickets: 1, balls: 6 },
    ],
  },
}

export const NotEntered: Story = { args: { innings: [] } }
