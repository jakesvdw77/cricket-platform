import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { FieldCard } from './FieldCard'
import { makeField } from '../../test/fieldFixtures'
import { ManageMenu } from '../ManageMenu'

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
    viewTo: '/manage/fixtures/fields/field-1',
    actions: <ManageMenu trigger="kebab" dense label="Actions for Riverside Oval" groups={[{ id: 'a', heading: 'Actions', items: [{ id: 'open', title: 'Open Field' }] }]} />,
  },
}
export default meta

type Story = StoryObj<typeof FieldCard>

// docs/specs/099 and 134: one flat shape for every status - the same rows, no footer bar (the page passes its kebab as `actions`).
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
    admin: true,
  },
}
export const MobileViewport: Story = { args: Verified.args, parameters: { viewport: { defaultViewport: 'mobile' } } }
