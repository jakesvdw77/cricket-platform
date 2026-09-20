import type { Meta, StoryObj } from '@storybook/react-vite'
import { ManageScreenHeader } from './ManageScreenHeader'
import { Button } from '../Button'

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

// docs/specs/041-list-screen-header-actions.md: a list screen's primary "create" action, rendered
// top-right beside the title instead of inside ListToolbar's own row.
export const WithAction: Story = {
  args: { title: 'Matches', action: <Button onClick={() => undefined}>Add Match</Button> },
}
