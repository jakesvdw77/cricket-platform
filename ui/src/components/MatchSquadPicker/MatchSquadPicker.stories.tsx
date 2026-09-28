import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { MatchSquadPicker } from './MatchSquadPicker'
import type { MatchSquadCandidate, MatchSquadMember } from '../../api/matchSquadApi'

const CANDIDATES: MatchSquadCandidate[] = [
  { playerProfileId: 'p1', firstName: 'Jane', lastName: 'Smith', jerseyNumber: 7, pickedElsewhere: null },
  { playerProfileId: 'p2', firstName: 'Amy', lastName: 'Lee', jerseyNumber: null, pickedElsewhere: null },
  {
    playerProfileId: 'p3',
    firstName: 'Sam',
    lastName: 'Patel',
    jerseyNumber: 11,
    pickedElsewhere: { matchId: 'match-2', teamId: 'team-2', teamName: 'U13 Girls' },
  },
]

function makeMember(overrides: Partial<MatchSquadMember>): MatchSquadMember {
  return {
    id: 'squad-row-1',
    playerProfileId: 'p4',
    personId: 'person-4',
    clubId: 'club-1',
    firstName: 'Bob',
    lastName: 'Jones',
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
    squadJerseyNumber: 4,
    isCaptain: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

const SELECTED: MatchSquadMember[] = [makeMember({})]

const meta: Meta<typeof MatchSquadPicker> = {
  title: 'Components/MatchSquadPicker',
  component: MatchSquadPicker,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 900 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof MatchSquadPicker>

const noop = () => undefined

export const NoWindowYet: Story = {
  args: {
    candidates: [],
    selected: [],
    windowId: null,
    windowOpen: false,
    label: 'the home side',
    createWindowHref: '/manage/section-availability?sectionId=section-1',
    onAdd: noop,
    onRemove: noop,
    onUpdateJerseyNumber: noop,
  },
}

export const WithCandidatesAndSelected: Story = {
  args: {
    ...NoWindowYet.args,
    candidates: CANDIDATES,
    selected: SELECTED,
    windowId: 'window-1',
    windowOpen: true,
  },
}

export const ClosedWindow: Story = {
  args: {
    ...WithCandidatesAndSelected.args,
    windowOpen: false,
  },
}

export const WithServerError: Story = {
  args: {
    ...WithCandidatesAndSelected.args,
    errorMessage: 'Already picked for this bracket elsewhere.',
  },
}

export const MobileViewport: Story = {
  args: WithCandidatesAndSelected.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}
