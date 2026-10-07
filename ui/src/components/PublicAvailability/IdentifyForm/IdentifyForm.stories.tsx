import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { IdentifyForm } from './IdentifyForm'

const meta: Meta<typeof IdentifyForm> = {
  title: 'Components/PublicAvailability/IdentifyForm',
  component: IdentifyForm,
  parameters: { layout: 'padded' },
  args: { onSubmit: fn() },
}
export default meta

type Story = StoryObj<typeof IdentifyForm>

export const Empty: Story = {}
export const DetailsDoNotMatch: Story = { args: { failed: true, triesLeft: 3, initialFirstName: 'Liam', initialLastName: 'Carter' } }
export const Locked: Story = { args: { locked: { retryAfterSeconds: 900 } } }
export const NoDateOfBirth: Story = { args: { noDateOfBirth: true, onTryAgain: fn() } }
export const RememberedPlayerDateOnly: Story = {
  args: { nameLocked: true, initialFirstName: 'Liam', initialLastName: 'Carter', onNotYou: fn() },
}
export const SessionExpiredNotice: Story = {
  args: { notice: 'Your 30 minutes ran out, enter your details again. Your chosen answers are kept.' },
}
