import type { Meta, StoryObj } from '@storybook/react-vite'
import { StatusScreen } from './StatusScreen'

const meta: Meta<typeof StatusScreen> = {
  title: 'Components/StatusScreen',
  component: StatusScreen,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof StatusScreen>

export const NotAuthorised: Story = { args: { kind: 'not-authorised', secondaryAction: { label: 'Sign out', onClick: () => undefined } } }
export const SignedOut: Story = { args: { kind: 'signed-out' } }
export const Suspended: Story = { args: { kind: 'suspended' } }
export const SessionExpired: Story = { args: { kind: 'session-expired' } }
export const NotFound: Story = { args: { kind: 'not-found' } }
export const Unreachable: Story = { args: { kind: 'unreachable' } }
export const ErrorState: Story = { args: { kind: 'error' } }
