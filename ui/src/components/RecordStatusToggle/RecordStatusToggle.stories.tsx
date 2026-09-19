import type { Meta, StoryObj } from '@storybook/react-vite'
import { Stack } from '@mui/material'
import { RecordStatusToggle } from './RecordStatusToggle'

const meta: Meta<typeof RecordStatusToggle> = {
  title: 'Components/RecordStatusToggle',
  component: RecordStatusToggle,
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj<typeof RecordStatusToggle>

export const Active: Story = {
  args: { active: true, pending: false, onClick: () => undefined },
}

export const Inactive: Story = {
  args: { active: false, pending: false, onClick: () => undefined },
}

export const DeactivatingPending: Story = {
  args: { active: true, pending: true, onClick: () => undefined },
}

export const ReactivatingPending: Story = {
  args: { active: false, pending: true, onClick: () => undefined },
}

export const BothStates: Story = {
  render: () => (
    <Stack direction="row" spacing={2}>
      <RecordStatusToggle active pending={false} onClick={() => undefined} />
      <RecordStatusToggle active={false} pending={false} onClick={() => undefined} />
    </Stack>
  ),
}

// docs/standards/design-system.md's Workflow step 3: every component gets a story at 375/768/1280.
export const MobileViewport: Story = {
  args: { active: true, pending: false, onClick: () => undefined },
  parameters: { viewport: { defaultViewport: 'mobile' } },
}
