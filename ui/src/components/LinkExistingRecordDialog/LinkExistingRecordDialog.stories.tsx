import type { Meta, StoryObj } from '@storybook/react-vite'
import { LinkExistingRecordDialog } from './LinkExistingRecordDialog'

interface Candidate {
  id: string
  name: string
  detail: string
}

const CANDIDATES: Candidate[] = [
  { id: 'bob', name: 'Bob Jones', detail: 'Coach' },
  { id: 'jane', name: 'Jane Smith', detail: 'Treasurer' },
  { id: 'sam', name: 'Sam Green', detail: 'Groundskeeper' },
]

const meta: Meta<typeof LinkExistingRecordDialog<Candidate>> = {
  title: 'Components/LinkExistingRecordDialog',
  component: LinkExistingRecordDialog<Candidate>,
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj<typeof LinkExistingRecordDialog<Candidate>>

// No extraField — the original ClubStructure.tsx Section↔ClubContact UX: selecting an option
// links it immediately, no confirm button.
export const AutoLinkOnSelect: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    title: 'Link an existing contact',
    candidates: CANDIDATES,
    getOptionLabel: (option) => `${option.name} — ${option.detail}`,
    searchLabel: 'Search contacts',
    searchPlaceholder: 'Search by name or role',
    onLink: () => undefined,
  },
}

// extraField supplied — Team↔ClubContact's team-specific role: select-then-confirm, with
// one-click quick-fill suggestions that populate (not submit) the field.
export const SelectThenConfirmWithRole: Story = {
  args: {
    ...AutoLinkOnSelect.args,
    title: 'Link an existing contact to this team',
    extraField: { label: 'Role', quickFillOptions: ['Manager', 'Coach', 'Assistant Coach'] },
  },
}

export const Loading: Story = {
  args: {
    ...AutoLinkOnSelect.args,
    candidates: [],
    loading: true,
  },
}

export const MobileViewport: Story = {
  args: SelectThenConfirmWithRole.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: SelectThenConfirmWithRole.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: SelectThenConfirmWithRole.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
