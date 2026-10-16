import type { Meta, StoryObj } from '@storybook/react-vite'
import { PlayerQuickForm } from './PlayerQuickForm'

const meta: Meta<typeof PlayerQuickForm> = {
  title: 'Components/PlayerQuickForm',
  component: PlayerQuickForm,
  args: { submitLabel: 'Create and link', onSubmit: () => undefined },
}
export default meta

type Story = StoryObj<typeof PlayerQuickForm>

export const Empty: Story = {}
export const PrefilledFromAGuestName: Story = { args: { initialFirstName: 'Jan', initialLastName: 'van der Berg' } }
export const Saving: Story = { args: { initialFirstName: 'Jan', initialLastName: 'van der Berg', pending: true } }
export const ServerError: Story = { args: { initialFirstName: 'Jan', initialLastName: 'van der Berg', error: 'A player with this name and date of birth already exists.' } }
