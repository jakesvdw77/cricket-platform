import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { MatchAvailabilityTab } from './MatchAvailabilityTab'
import type { MatchAvailabilityPollResponses } from '../../api/matchAvailabilityApi'

const OPEN_MIXED_POLL: MatchAvailabilityPollResponses = {
  pollId: 'poll-1',
  teamId: 'team-1',
  open: true,
  availableCount: 2,
  unavailableCount: 1,
  unsureCount: 1,
  noResponseCount: 1,
  responses: [
    { playerProfileId: 'p1', firstName: 'Jane', lastName: 'Smith', squadJerseyNumber: 7, status: 'AVAILABLE' },
    { playerProfileId: 'p2', firstName: 'Bob', lastName: 'Jones', squadJerseyNumber: 4, status: 'AVAILABLE' },
    { playerProfileId: 'p3', firstName: 'Amy', lastName: 'Lee', squadJerseyNumber: null, status: 'UNAVAILABLE' },
    { playerProfileId: 'p4', firstName: 'Sam', lastName: 'Patel', squadJerseyNumber: null, status: 'UNSURE' },
    { playerProfileId: 'p5', firstName: 'Lee', lastName: 'Nguyen', squadJerseyNumber: null, status: null },
  ],
  publicPath: '/poll/poll-1',
}

const meta: Meta<typeof MatchAvailabilityTab> = {
  title: 'Components/MatchAvailabilityTab',
  component: MatchAvailabilityTab,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 640 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof MatchAvailabilityTab>

const noop = () => undefined

export const NoPollYet: Story = {
  args: {
    label: 'the home side',
    poll: null,
    onCreate: noop,
    onOpen: noop,
    onClose: noop,
    onShareInvite: noop,
  },
}

export const OpenWithMixedResponses: Story = {
  args: {
    ...NoPollYet.args,
    poll: OPEN_MIXED_POLL,
  },
}

export const Closed: Story = {
  args: {
    ...NoPollYet.args,
    poll: { ...OPEN_MIXED_POLL, open: false },
  },
}

export const Loading: Story = {
  args: {
    ...NoPollYet.args,
    isLoading: true,
  },
}

export const WithServerError: Story = {
  args: {
    ...NoPollYet.args,
    poll: OPEN_MIXED_POLL,
    errorMessage: "Something went wrong updating this poll. Please try again.",
  },
}

export const MobileViewport: Story = {
  args: OpenWithMixedResponses.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}
