import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { FieldCard } from './FieldCard'
import { makeField } from '../../test/fieldFixtures'

const meta: Meta<typeof FieldCard> = {
  title: 'Components/FieldCard',
  component: FieldCard,
  parameters: { layout: 'padded' },
  decorators: [
    (StoryComponent) => (
      <Box sx={{ maxWidth: 380 }}>
        <StoryComponent />
      </Box>
    ),
  ],
  args: {
    field: makeField({ linkedHome: true }),
    clubId: 'club-1',
    viewTo: '/manage/fixtures/fields/field-1',
    editTo: '/manage/fixtures/fields/field-1/edit',
    onToggleHome: () => undefined,
  },
}
export default meta

type Story = StoryObj<typeof FieldCard>

// docs/specs/099: one shape for every status - the same rows and the same three footer columns.
export const Verified: Story = {}
export const UnverifiedEditable: Story = { args: { field: makeField({ verificationStatus: 'UNVERIFIED', createdByClubId: 'club-1' }) } }
export const Rejected: Story = { args: { field: makeField({ verificationStatus: 'REJECTED', linkedHome: false }) } }
export const EmptyValues: Story = {
  args: {
    field: makeField({
      ownerName: '',
      mapUrl: null,
      address: { number: null, street: null, city: null, provinceState: null, country: null, postalCode: null },
    }),
  },
}
export const PlatformAdmin: Story = {
  args: {
    field: makeField({ verificationStatus: 'UNVERIFIED', linkedClubCount: 1, matchCount: 2 }),
    clubId: undefined,
    onToggleHome: undefined,
    onStatusAction: () => undefined,
  },
}
export const MobileViewport: Story = { args: Verified.args, parameters: { viewport: { defaultViewport: 'mobile' } } }
