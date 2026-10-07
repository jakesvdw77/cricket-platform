import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { AnswerForm } from './AnswerForm'
import type { AnswerFormProps, AnswerMap, AnswerSlot } from './AnswerForm'

const meta: Meta<typeof AnswerForm> = {
  title: 'Components/PublicAvailability/AnswerForm',
  component: AnswerForm,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof AnswerForm>

function Stateful(args: AnswerFormProps) {
  const [answers, setAnswers] = useState<AnswerMap>(args.answers)
  return <AnswerForm {...args} answers={answers} onChange={setAnswers} />
}

const groupSlots: AnswerSlot[] = [
  { key: 'w1', windowId: 'w1', label: 'Thu 15 Oct · Morning', matches: ['Villagers 1 v POHBS'], open: true },
  { key: 'w2', windowId: 'w2', label: 'Thu 15 Oct · Afternoon', matches: ['Villagers 1 v TBC'], open: true },
]

export const Squad: Story = {
  render: (args) => <Stateful {...args} />,
  args: {
    playerName: 'Liam Carter',
    slots: [{ key: 'squad', windowId: null, label: null, matches: [], open: true }],
    answers: {},
    onChange: fn(),
    onSave: fn(),
    onNotYou: fn(),
  },
}

export const Group: Story = {
  render: (args) => <Stateful {...args} />,
  args: { ...Squad.args, slots: groupSlots },
}

export const GroupChangingAVote: Story = {
  render: (args) => <Stateful {...args} />,
  args: { ...Squad.args, slots: groupSlots, answers: { w1: 'AVAILABLE', w2: 'UNSURE' }, hasExisting: true },
}

export const GroupWithClosedWindow: Story = {
  render: (args) => <Stateful {...args} />,
  args: { ...Squad.args, slots: [groupSlots[0], { ...groupSlots[1], open: false }], answers: { w2: 'UNAVAILABLE' } },
}
