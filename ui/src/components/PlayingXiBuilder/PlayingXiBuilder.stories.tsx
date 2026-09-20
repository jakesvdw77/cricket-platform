import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { PlayingXiBuilder } from './PlayingXiBuilder'
import type { AvailabilityStatus } from './PlayingXiBuilder'
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

// docs/specs/037-match-improvements.md item 8: the "Add Squad Member" button next to "Add
// player" — purely additive, omitted entirely on every other story above since none pass
// onAddSquadMember.
export const WithAddSquadMember: Story = {
  args: {
    ...WithPlayersAdded.args,
    onAddSquadMember: noop,
  },
}

// docs/specs/037-match-improvements.md item 9: the "Re-select from Previous Match" button next to
// "Add Squad Member" — purely additive, omitted entirely on every other story above since none
// pass onReselectFromPreviousMatch.
export const WithReselectFromPreviousMatch: Story = {
  args: {
    ...WithPlayersAdded.args,
    onReselectFromPreviousMatch: noop,
  },
}

// docs/specs/033-availability-aware-xi-builder.md (revised after live review): both statuses get a
// full-row/option colour tint (red for Unavailable, orange for Unsure) plus a text caption — a
// populated availabilityByPlayerId covering all four states across the fixture squad. p2 (Bob
// Jones, already in the XI) is UNAVAILABLE so the red tint + caption are visible on his ordered-XI
// row; p3 (Amy Lee, already in the XI) is UNSURE so the orange tint + caption are visible on her
// row; p4 (Sam Patel, not yet added) is UNAVAILABLE so the same treatment is visible in both the
// Add-player Autocomplete and the Twelfth Man Select; p5 (Lee Nguyen, not yet added) is UNSURE so
// the orange treatment is visible in both those same pickers; p1 (Jane Smith) is AVAILABLE and
// renders no visual change at all.
export const WithAvailabilityIndicators: Story = {
  args: {
    ...Empty.args,
    xi: XI,
    captainPlayerId: 'p1',
    wicketKeeperPlayerId: 'p2',
    availabilityByPlayerId: new Map<string, AvailabilityStatus>([
      ['p1', 'AVAILABLE'],
      ['p2', 'UNAVAILABLE'],
      ['p3', 'UNSURE'],
      ['p4', 'UNAVAILABLE'],
      ['p5', 'UNSURE'],
    ]),
  },
}

// docs/specs/040-announce-team.md: the header chip + toggle button — omitted entirely on every
// other story above since none pass announced/onToggleAnnounced.
export const NotAnnouncedState: Story = {
  args: {
    ...WithPlayersAdded.args,
    announced: false,
    onToggleAnnounced: noop,
  },
}

export const AnnouncedState: Story = {
  args: {
    ...WithPlayersAdded.args,
    announced: true,
    onToggleAnnounced: noop,
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
