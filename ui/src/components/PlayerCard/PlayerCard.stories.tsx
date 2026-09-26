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
    ...overrides,
  }
}

const meta: Meta<typeof PlayerCard> = {
  title: 'Components/PlayerCard',
  component: PlayerCard,
  parameters: { layout: 'padded' },
  // No local MemoryRouter decorator here — .storybook/preview.tsx already wraps every story in
  // one globally, same precedent TeamCard.stories.tsx/RecordCard.stories.tsx establish. PlayerCard
  // makes no React Query calls of its own, so no QueryClientProvider decorator is needed either.
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 360 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof PlayerCard>

// docs/specs/061-player-card-avatar-redesign.md's approved "Detailed" density — jersey number,
// phone, full cricket info, and two tagged sections (section + overflow chip) all populated.
export const Detailed: Story = {
  args: {
    player: makePlayer({
      jerseyNumber: 16,
      phone: '082 555 1234',
      battingStance: 'RIGHT_HANDED',
      bowlingArm: 'RIGHT_ARM',
      bowlingType: 'OFF_BREAK',
    }),
    sectionNames: ['Colts A', 'Colts B'],
    viewTo: '/manage/players/player-1',
    editTo: '/manage/players/player-1/edit',
  },
}

// Every optional field cleanly omitted — no error, no empty icon (the spec's Acceptance Criteria).
export const Minimal: Story = {
  args: {
    player: makePlayer(),
    sectionNames: [],
    viewTo: '/manage/players/player-1',
    editTo: '/manage/players/player-1/edit',
  },
}

export const Inactive: Story = {
  args: {
    ...Detailed.args,
    badge: { label: 'Inactive', tone: 'muted' },
  },
}

export const MobileViewport: Story = {
  args: Detailed.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: Detailed.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: Detailed.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
