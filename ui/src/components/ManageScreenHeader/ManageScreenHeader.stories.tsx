import type { Meta, StoryObj } from '@storybook/react-vite'
import { ManageScreenHeader } from './ManageScreenHeader'

// No local MemoryRouter decorator — .storybook/preview.tsx already wraps every story in one
// globally (see RecordFormScreen.stories.tsx's same note).
const meta: Meta<typeof ManageScreenHeader> = {
  title: 'Components/ManageScreenHeader',
  component: ManageScreenHeader,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof ManageScreenHeader>

export const Default: Story = {
  args: { title: 'Club Contacts' },
}

export const CustomBackTarget: Story = {
  args: { title: 'Sponsor Contacts', backTo: '/manage/sponsors', backLabel: 'Back to Sponsors' },
}
