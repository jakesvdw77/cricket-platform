import type { Meta, StoryObj } from '@storybook/react-vite'
import { TeamTable } from './TeamTable'
import type { TeamTableRow } from './TeamTable'
import type { Team } from '../../api/teamApi'

function row(id: string, name: string, overrides: Partial<TeamTableRow> = {}, team: Partial<Team> = {}): TeamTableRow {
  return {
    team: {
      id,
      clubId: 'club-1',
      sectionId: 'section-1',
      name,
      logoUrl: null,
      abbreviation: null,
      groundName: null,
      socialLinks: [],
      active: true,
      createdAt: '',
      updatedAt: '',
      updatedBy: null,
      ...team,
    },
    sectionName: 'Men',
    playerCount: 14,
    matchCount: 8,
    captainName: 'Jane Smith',
    loaded: true,
    to: `/manage/sections/section-1/teams/${id}`,
    ...overrides,
  }
}

const meta: Meta<typeof TeamTable> = {
  title: 'Components/TeamTable',
  component: TeamTable,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof TeamTable>

// docs/specs/092 (A): zebra rows; the second has no captain (amber), the third an empty squad, the last is inactive.
export const Default: Story = {
  args: {
    rows: [
      row('a', '1st XI'),
      row('b', '2nd XI', { captainName: null, playerCount: 11 }),
      row('c', 'Colts', { playerCount: 0, matchCount: 0, captainName: null, sectionName: 'Juniors' }),
      row('d', 'Veterans', {}, { active: false }),
    ],
  },
}

// While the squads and matches load, the figures show a dash instead of a wrong zero.
export const Loading: Story = {
  args: { rows: [row('a', '1st XI', { loaded: false }), row('b', '2nd XI', { loaded: false })] },
}
