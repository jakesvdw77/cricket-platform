import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { AvailabilityRespondentAvatars } from './AvailabilityRespondentAvatars'
import type { AvailabilityRespondent } from '../../api/matchAvailabilityApi'

const FEW_RESPONDENTS: AvailabilityRespondent[] = [
  { playerProfileId: 'p1', firstName: 'Jane', lastName: 'Smith', squadJerseyNumber: 7 },
  { playerProfileId: 'p2', firstName: 'Bob', lastName: 'Jones', squadJerseyNumber: 4 },
]

const MANY_RESPONDENTS: AvailabilityRespondent[] = [
  { playerProfileId: 'p1', firstName: 'Jane', lastName: 'Smith', squadJerseyNumber: 7 },
  { playerProfileId: 'p2', firstName: 'Bob', lastName: 'Jones', squadJerseyNumber: 4 },
  { playerProfileId: 'p3', firstName: 'Amy', lastName: 'Lee', squadJerseyNumber: null },
  { playerProfileId: 'p4', firstName: 'Sam', lastName: 'Patel', squadJerseyNumber: 11 },
  { playerProfileId: 'p5', firstName: 'Lee', lastName: 'Nguyen', squadJerseyNumber: null },
]

// docs/specs/048-match-availability-wrap-layout.md: the real screenshot-confirmed case
// (9 Available respondents) driving the new 'wrap' layout — MatchDetailPage.tsx's SideAvailability
// opts into this instead of the compact AvatarGroup truncation above.
const NINE_RESPONDENTS: AvailabilityRespondent[] = [
  { playerProfileId: 'w1', firstName: 'Maya', lastName: 'Osei', squadJerseyNumber: 3 },
  { playerProfileId: 'w2', firstName: 'Ethan', lastName: 'Moore', squadJerseyNumber: 9 },
  { playerProfileId: 'w3', firstName: 'Jasmine', lastName: 'Ahmed', squadJerseyNumber: 21 },
  { playerProfileId: 'w4', firstName: 'Oliver', lastName: 'Chen', squadJerseyNumber: 15 },
  { playerProfileId: 'w5', firstName: 'Priya', lastName: 'Rao', squadJerseyNumber: null },
  { playerProfileId: 'w6', firstName: 'Kai', lastName: 'Thompson', squadJerseyNumber: 8 },
  { playerProfileId: 'w7', firstName: 'Isla', lastName: 'Walker', squadJerseyNumber: 12 },
  { playerProfileId: 'w8', firstName: 'Noah', lastName: 'Fitzgerald', squadJerseyNumber: null },
  { playerProfileId: 'w9', firstName: 'Ruby', lastName: 'Singh', squadJerseyNumber: 6 },
]

// docs/specs/048-match-availability-wrap-layout.md: exercises the WRAP_LAYOUT_MAX (24) fallback —
// 25 respondents renders 24 individual avatars plus one trailing "+1" summary avatar.
const TWENTY_FIVE_RESPONDENTS: AvailabilityRespondent[] = Array.from({ length: 25 }, (_, index) => ({
  playerProfileId: `w${index + 1}`,
  firstName: `Player`,
  lastName: `${index + 1}`,
  squadJerseyNumber: index + 1,
}))

const meta: Meta<typeof AvailabilityRespondentAvatars> = {
  title: 'Components/AvailabilityRespondentAvatars',
  component: AvailabilityRespondentAvatars,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 320 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof AvailabilityRespondentAvatars>

export const Available: Story = {
  args: { status: 'AVAILABLE', respondents: FEW_RESPONDENTS, count: 2 },
}

export const Unavailable: Story = {
  args: { status: 'UNAVAILABLE', respondents: FEW_RESPONDENTS, count: 2 },
}

export const Unsure: Story = {
  args: { status: 'UNSURE', respondents: FEW_RESPONDENTS, count: 2 },
}

export const OverflowBeyondMax: Story = {
  args: { status: 'AVAILABLE', respondents: MANY_RESPONDENTS, count: 5 },
}

export const Empty: Story = {
  args: { status: 'AVAILABLE', respondents: [], count: 0 },
}

export const MobileViewport: Story = {
  args: OverflowBeyondMax.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const WrapLayout: Story = {
  args: { status: 'AVAILABLE', respondents: NINE_RESPONDENTS, count: 9, layout: 'wrap' },
}

export const WrapLayoutOverflow: Story = {
  args: { status: 'AVAILABLE', respondents: TWENTY_FIVE_RESPONDENTS, count: 25, layout: 'wrap' },
}
