import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { PlayerCard } from './PlayerCard'
import type { Player } from '../../api/playerApi'

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    personId: 'person-1',
    clubId: 'club-1',
    firstName: 'Sipho',
    lastName: 'Ndlovu',
    dateOfBirth: '2010-04-12',
    gender: 'MALE',
    photoUrl: null,
    clubMembershipNumber: 'RCC-042',
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
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    verificationStatus: 'VERIFIED',
    gamesThisSeason: 0,
    gamesOverall: 0,
    ...overrides,
  }
}

const meta: Meta<typeof PlayerCard> = {
  title: 'Components/PlayerCard',
  component: PlayerCard,
  parameters: { layout: 'padded' },
  decorators: [
    (StoryComponent) => (
      <Box sx={{ maxWidth: 380 }}>
        <StoryComponent />
      </Box>
    ),
  ],
  args: {
    player: makePlayer({
      jerseyNumber: 7,
      phone: '083 555 0177',
      battingStance: 'LEFT_HANDED',
      bowlingArm: 'RIGHT_ARM',
      bowlingType: 'MEDIUM',
      gamesThisSeason: 12,
      gamesOverall: 48,
    }),
    sectionNames: ['Vets'],
    viewTo: '/manage/players/player-1',
    editTo: '/manage/players/player-1/edit',
    onStatusAction: () => undefined,
  },
}
export default meta

type Story = StoryObj<typeof PlayerCard>

// docs/specs/088-players-polls-alignment.md: every card has the same five rows, the same footer and the same height.
export const Verified: Story = {}

// Waiting for the manager: amber badge, the Status menu offers Verify and Reject.
export const Unverified: Story = { args: { player: makePlayer({ verificationStatus: 'UNVERIFIED', jerseyNumber: 12, phone: '082 555 0142' }) } }

// Hidden from the default list; shown with "Show suspended and rejected players", and can be verified again.
export const Rejected: Story = { args: { player: makePlayer({ verificationStatus: 'REJECTED', phone: '072 555 0188' }) } }

// A deactivated player; the Status menu offers Reactivate.
export const Suspended: Story = { args: { player: makePlayer({ active: false, jerseyNumber: 3, phone: '084 555 0121' }) } }

// Nothing on file: the rows stay and show "–", so the card is as tall as a full one.
export const NothingOnFile: Story = {
  args: { player: makePlayer({ dateOfBirth: null, jerseyNumber: null }), sectionNames: [] },
}

export const LongNameAndManySections: Story = {
  args: {
    player: makePlayer({ firstName: 'Christopher Alexander', lastName: 'Montgomery-Hendricks the Third', jerseyNumber: 99, phone: '082 555 0142' }),
    sectionNames: ['Vets', 'Over 40', 'Social'],
  },
}

export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } }

// docs/specs/088: the two games chips are one width whatever the numbers, and present even at 0.
export const GamesPlayedLargeNumbers: Story = { args: { player: makePlayer({ jerseyNumber: 7, phone: '083 555 0177', gamesThisSeason: 14, gamesOverall: 1203 }) } }

export const NeverPlayed: Story = { args: { player: makePlayer({ gamesThisSeason: 0, gamesOverall: 0 }) } }
