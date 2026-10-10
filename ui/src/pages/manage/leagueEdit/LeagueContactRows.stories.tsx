import type { Meta, StoryObj } from '@storybook/react-vite'
import { LeagueContactRows } from './LeagueContactRows'
import type { LeagueContact } from '../../../api/leagueContactApi'

function contact(overrides: Partial<LeagueContact>): LeagueContact {
  return {
    id: 'c',
    leagueId: 'league-1',
    contact: { firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@example.com', phone: '+27 21 555 0100' },
    role: 'League Administrator',
    isPrimary: false,
    active: true,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    ...overrides,
  }
}

const meta: Meta<typeof LeagueContactRows> = {
  title: 'Pages/Manage/LeagueContactRows',
  component: LeagueContactRows,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof LeagueContactRows>

// docs/specs/095: zebra rows with a Primary badge, an Inactive badge and a contact with no email or phone.
export const Default: Story = {
  args: {
    leagueId: 'league-1',
    contacts: [
      contact({ id: 'a', isPrimary: true }),
      contact({ id: 'b', contact: { firstName: 'Sam', lastName: 'Jones', email: 'sam@example.com', phone: '+27 82 555 0123' }, role: 'Umpire Coordinator' }),
      contact({ id: 'c', contact: { firstName: 'Lerato', lastName: 'Dlamini', email: '', phone: '' }, role: 'Treasurer', active: false }),
    ],
  },
}

// The empty line, with the Add contact button still in the header.
export const Empty: Story = { args: { leagueId: 'league-1', contacts: [] } }

// Name with the role under it, a chevron and the three-dot menu.
export const Phone: Story = { args: Default.args, parameters: { viewport: { defaultViewport: 'mobile' } } }
