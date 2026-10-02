import type { Meta, StoryObj } from '@storybook/react-vite'
import { ConfirmDialog } from './ConfirmDialog'

const meta: Meta<typeof ConfirmDialog> = {
  title: 'Components/ConfirmDialog',
  component: ConfirmDialog,
  args: { open: true, onClose: () => {}, onConfirm: () => {} },
}
export default meta

type Story = StoryObj<typeof ConfirmDialog>

export const Default: Story = {
  args: {
    title: 'Replace the current Playing XI?',
    description: 'This replaces every player, role, and batting-order position currently set.',
    confirmLabel: 'Replace',
  },
}

export const Destructive: Story = {
  args: {
    title: 'Delete this group poll?',
    description: 'Its fixtures can be polled again once it is deleted.',
    confirmLabel: 'Delete',
    destructive: true,
  },
}

export const Pending: Story = {
  args: { ...Destructive.args, pending: true, pendingLabel: 'Deleting…' },
}

export const AcknowledgeOnly: Story = {
  args: {
    title: "Can't delete this poll",
    description: 'Remove the picked squad members from its matches first, then delete the poll.',
    acknowledgeOnly: true,
  },
}
