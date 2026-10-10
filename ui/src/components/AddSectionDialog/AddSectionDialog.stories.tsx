import type { Meta, StoryObj } from '@storybook/react-vite'
import { AddSectionDialog } from './AddSectionDialog'
import type { Section } from '../../api/sectionApi'

const BOYS: Section = {
  id: 'boys',
  clubId: 'club-1',
  parentSectionId: 'juniors',
  name: 'Boys',
  minAge: null,
  maxAge: null,
  gender: null,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: null,
}

const meta: Meta<typeof AddSectionDialog> = {
  title: 'Components/AddSectionDialog',
  component: AddSectionDialog,
  args: { open: true, parent: BOYS, parentPath: 'Juniors, Boys', onClose: () => {}, onCreate: async () => {} },
}
export default meta

type Story = StoryObj<typeof AddSectionDialog>

export const UnderASection: Story = {}

export const TopLevel: Story = { args: { parent: null, parentPath: undefined } }

export const Pending: Story = { args: { pending: true } }

export const WithError: Story = { args: { error: 'We could not add that section. Try again.' } }
