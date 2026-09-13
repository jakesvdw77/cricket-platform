import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { PlayingXiBuilder } from './PlayingXiBuilder'
import type { SquadMember } from '../../api/teamSquadApi'
import type { MatchSidePlayer } from '../../api/matchSideApi'

function makeSquadMember(overrides: Partial<SquadMember> = {}): SquadMember {
  return {
    id: 'squad-row-1',
    playerProfileId: 'player-1',
    personId: 'person-1',
    clubId: 'club-1',
    firstName: 'Jane',
    lastName: 'Smith',
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
    squadJerseyNumber: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

const SQUAD: SquadMember[] = [
  makeSquadMember({ id: 'squad-p1', playerProfileId: 'p1', firstName: 'Jane', lastName: 'Smith', squadJerseyNumber: 7 }),
  makeSquadMember({ id: 'squad-p2', playerProfileId: 'p2', firstName: 'Bob', lastName: 'Jones' }),
  makeSquadMember({ id: 'squad-p3', playerProfileId: 'p3', firstName: 'Amy', lastName: 'Lee' }),
  makeSquadMember({ id: 'squad-p4', playerProfileId: 'p4', firstName: 'Sam', lastName: 'Patel' }),
  makeSquadMember({ id: 'squad-p5', playerProfileId: 'p5', firstName: 'Lee', lastName: 'Nguyen' }),
]

const XI: MatchSidePlayer[] = [
  { playerProfileId: 'p1', battingOrder: 1, role: 'BATSMAN' },
  { playerProfileId: 'p2', battingOrder: 2, role: 'BATSMAN' },
  { playerProfileId: 'p3', battingOrder: 3, role: 'ALL_ROUNDER' },
]

const meta: Meta<typeof PlayingXiBuilder> = {
  title: 'Components/PlayingXiBuilder',
  component: PlayingXiBuilder,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 720 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof PlayingXiBuilder>

const noop = () => undefined

export const Empty: Story = {
  args: {
    squad: SQUAD,
    xi: [],
    captainPlayerId: null,
    wicketKeeperPlayerId: null,
    twelfthManPlayerId: null,
    cap: 11,
    onAddPlayer: noop,
    onRemovePlayer: noop,
    onChangeRole: noop,
    onReorderPlayers: noop,
    onChangeCaptain: noop,
    onChangeWicketKeeper: noop,
    onChangeTwelfthMan: noop,
  },
}

export const WithPlayersAdded: Story = {
  args: {
    ...Empty.args,
    xi: XI,
    captainPlayerId: 'p1',
    wicketKeeperPlayerId: 'p2',
    twelfthManPlayerId: 'p4',
  },
}

export const CapReached: Story = {
  args: {
    ...Empty.args,
    xi: XI,
    cap: 3,
  },
}

export const WithServerError: Story = {
  args: {
    ...Empty.args,
    xi: XI,
    errorMessage: "This player's age falls outside the league's eligible range.",
  },
}

export const MobileViewport: Story = {
  args: WithPlayersAdded.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: WithPlayersAdded.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: WithPlayersAdded.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
