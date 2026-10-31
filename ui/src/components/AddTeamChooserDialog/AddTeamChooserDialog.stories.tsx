import type { Meta, StoryObj } from '@storybook/react-vite'
import { AddTeamChooserDialog } from './AddTeamChooserDialog'

const meta: Meta<typeof AddTeamChooserDialog> = {
  title: 'Components/AddTeamChooserDialog',
  component: AddTeamChooserDialog,
  args: { open: true, onClose: () => undefined, onChooseOwn: () => undefined, onChooseOpponent: () => undefined, onChooseCopy: () => undefined },
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof AddTeamChooserDialog>

export const Default: Story = {}

export const CopyDisabled: Story = { args: { copyDisabledReason: 'Pick a season first.' } }

export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } }
