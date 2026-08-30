import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { SectionDetailPanel } from './SectionDetailPanel'
import type { Section } from '../../api/sectionApi'
import type { ClubContact } from '../../api/clubContactApi'

const SECTION: Section = {
  id: 'u13',
  clubId: 'club-1',
  parentSectionId: 'juniors',
  name: 'U13',
  minAge: 11,
  maxAge: 13,
  gender: null,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: null,
}

const CONTACTS: ClubContact[] = [
  {
    id: 'contact-1',
    clubId: 'club-1',
    contact: { firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com', phone: '+27 21 555 0100' },
    role: 'Coach',
    isPrimary: false,
    active: true,
    photoUrl: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
  },
]

const meta: Meta<typeof SectionDetailPanel> = {
  title: 'Components/SectionDetailPanel',
  component: SectionDetailPanel,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 420 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof SectionDetailPanel>

export const WithLinkedContacts: Story = {
  args: {
    section: SECTION,
    breadcrumb: ['Juniors'],
    onUpdate: () => undefined,
    contacts: CONTACTS,
    onLinkExisting: () => undefined,
    onCreateAndLink: () => undefined,
    onUnlink: () => undefined,
  },
}

export const NoContactsYet: Story = {
  args: {
    ...WithLinkedContacts.args,
    contacts: [],
  },
}

export const InactiveSection: Story = {
  args: {
    ...WithLinkedContacts.args,
    section: { ...SECTION, active: false },
    onReactivate: () => undefined,
  },
}

// docs/standards/design-system.md's Storybook rule — a viewport story at 375/768/1280.
export const MobileViewport: Story = {
  args: WithLinkedContacts.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: WithLinkedContacts.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: WithLinkedContacts.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
