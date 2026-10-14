import type { Meta, StoryObj } from '@storybook/react-vite'
import { ResultStepper } from './ResultStepper'

const meta: Meta<typeof ResultStepper> = {
  title: 'Components/ResultStepper',
  component: ResultStepper,
  parameters: { layout: 'padded' },
  args: {
    onSelect: () => {},
    steps: [
      { id: 'outcome', label: 'Result' },
      { id: 'scores', label: 'Scores' },
      { id: 'toss', label: 'Toss & field', shortLabel: 'Toss' },
      { id: 'review', label: 'Review' },
    ],
  },
}
export default meta

type Story = StoryObj<typeof ResultStepper>

export const FirstStep: Story = { args: { activeId: 'outcome' } }
export const Scores: Story = { args: { activeId: 'scores' } }
export const Review: Story = { args: { activeId: 'review' } }
