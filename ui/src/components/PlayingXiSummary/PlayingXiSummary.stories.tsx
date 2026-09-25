import type { Meta, StoryObj } from '@storybook/react-vite'
import { PlayingXiSummary } from './PlayingXiSummary'
import type { SquadMember } from '../../api/teamSquadApi'

const meta: Meta<typeof PlayingXiSummary> = {
  title: 'Components/PlayingXiSummary',
  component: PlayingXiSummary,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof PlayingXiSummary>

function squadMember(overrides: Partial<SquadMember> & { playerProfileId: string }): SquadMember {
  return {
    id: `squad-${overrides.playerProfileId}`,
    personId: `person-${overrides.playerProfileId}`,
    clubId: 'club-1',
    firstName: 'First',
    lastName: 'Last',
    dateOfBirth: null,
    gender: null,
    photoUrl: null,
    clubMembershipNumber: null,
    medicalAidProvider: null,
    medicalAidMemberNumber: null,
    phone: null,
    email: null,
    altContactName: null,
    altContactPhone: null,
    battingStance: null,
    bowlingArm: null,
    bowlingType: null,
    isWicketKeeper: false,
    active: true,
    sectionIds: [],
    jerseyNumber: null,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    squadJerseyNumber: null,
    isCaptain: false,
    ...overrides,
  }
}

const squad: SquadMember[] = [
  squadMember({ playerProfileId: 'p-1', firstName: 'Jane', lastName: 'Smith', squadJerseyNumber: 7 }),
  squadMember({ playerProfileId: 'p-2', firstName: 'Sam', lastName: 'Lee', squadJerseyNumber: 4 }),
  squadMember({ playerProfileId: 'p-3', firstName: 'Alex', lastName: 'Jones', squadJerseyNumber: 12 }),
  squadMember({ playerProfileId: 'p-4', firstName: 'Pat', lastName: 'Nguyen' }),
]

export const SelectedXi: Story = {
  args: {
    squad,
    xi: [
      { playerProfileId: 'p-1', battingOrder: 1, role: 'BATSMAN' },
      { playerProfileId: 'p-2', battingOrder: 2, role: 'BOWLER' },
      { playerProfileId: 'p-4', battingOrder: 3, role: 'ALL_ROUNDER' },
    ],
    captainPlayerId: 'p-1',
    wicketKeeperPlayerId: 'p-2',
    twelfthManPlayerId: 'p-3',
  },
}

export const NoXiSelectedYet: Story = {
  args: {
    squad,
    xi: [],
    captainPlayerId: null,
    wicketKeeperPlayerId: null,
    twelfthManPlayerId: null,
  },
}

export const MobileViewport: Story = {
  args: SelectedXi.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}
