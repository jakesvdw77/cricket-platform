import type { Meta, StoryObj } from '@storybook/react-vite'
import { Stack } from '@mui/material'
import { Countdown } from './Countdown'

// Stories pin a target relative to the moment the story renders, so each stage always reads the same.
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

function fromNow(ms: number): string {
  return new Date(Date.now() + ms).toISOString()
}

const meta: Meta<typeof Countdown> = {
  title: 'Components/Countdown',
  component: Countdown,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof Countdown>

export const Days: Story = { args: { target: fromNow(3 * DAY + 4 * HOUR + 30 * MIN), phrase: 'left' } }
export const HoursWarning: Story = { args: { target: fromNow(5 * HOUR + 12 * MIN + 30_000), phrase: 'left' } }
export const LastHour: Story = { args: { target: fromNow(42 * MIN + 30_000), phrase: 'left' } }
export const LastMinute: Story = { args: { target: fromNow(45_000), phrase: 'left' } }
export const Expired: Story = { args: { target: fromNow(-1000), phrase: 'left' } }
export const NeverWarns: Story = { args: { target: fromNow(5 * HOUR), phrase: 'left', warnWithinHours: 0 } }
export const StartsToGo: Story = {
  args: { target: fromNow(2 * DAY + HOUR + 30 * MIN), phrase: 'to go', ariaPrefix: 'Starts in' },
}

export const AllStages: Story = {
  args: { target: fromNow(DAY), phrase: 'left' },
  render: () => (
    <Stack spacing={1} alignItems="flex-start">
      <Countdown target={fromNow(3 * DAY + 4 * HOUR + 30 * MIN)} phrase="left" />
      <Countdown target={fromNow(5 * HOUR + 12 * MIN + 30_000)} phrase="left" />
      <Countdown target={fromNow(42 * MIN + 30_000)} phrase="left" />
      <Countdown target={fromNow(45_000)} phrase="left" />
      <Countdown target={fromNow(-1000)} phrase="left" />
      <Countdown target={fromNow(2 * DAY + HOUR + 30 * MIN)} phrase="to go" ariaPrefix="Starts in" />
    </Stack>
  ),
}
