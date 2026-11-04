import type { Meta, StoryObj } from '@storybook/react-vite'
import { AddPollChooserDialog } from './AddPollChooserDialog'

// docs/specs/136 and page-anatomy section 8: Add Poll is one button that opens this chooser; the router comes from preview.
const meta: Meta<typeof AddPollChooserDialog> = {
  title: 'Pages/Manage/AddPollChooserDialog',
  component: AddPollChooserDialog,
  args: { open: true, onClose: () => undefined },
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof AddPollChooserDialog>

export const Default: Story = {}

export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } }
