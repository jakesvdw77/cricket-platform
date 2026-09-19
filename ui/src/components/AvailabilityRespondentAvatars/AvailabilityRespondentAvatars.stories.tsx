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
