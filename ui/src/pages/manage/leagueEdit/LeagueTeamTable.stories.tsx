import type { Meta, StoryObj } from '@storybook/react-vite'
import { LeagueTeamTable } from './LeagueTeamTable'
import type { LeagueTeam } from '../../../api/leagueTeamApi'

function leagueTeam(overrides: Partial<LeagueTeam>): LeagueTeam {
  return {
    id: 'lt-1',
    leagueId: 'league-1',
    seasonId: 'season-1',
    name: 'Centurion Brits CC',
    abbreviation: 'CBC',
    logoUrl: null,
    active: true,
    referencedByMatchCount: 0,
    ...overrides,
  }
}

const meta: Meta<typeof LeagueTeamTable> = {
  title: 'Pages/Manage/LeagueTeamTable',
  component: LeagueTeamTable,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof LeagueTeamTable>

// docs/specs/095: an active team used in matches, an unused one (a muted dash) and an inactive one (muted row).
export const Default: Story = {
  args: {
    teams: [
      leagueTeam({ id: 'a', referencedByMatchCount: 3 }),
      leagueTeam({ id: 'b', name: 'Laudium Cricket Club', abbreviation: 'LCC' }),
      leagueTeam({ id: 'c', name: 'Police', abbreviation: null, active: false, referencedByMatchCount: 1 }),
    ],
    onEdit: () => undefined,
    onToggleActive: () => undefined,
    onRemove: () => undefined,
  },
}

// Name with the abbreviation and matches under it, the status chip and the three-dot menu.
export const Phone: Story = { args: Default.args, parameters: { viewport: { defaultViewport: 'mobile' } } }
