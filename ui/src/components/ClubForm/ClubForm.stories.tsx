import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { ClubForm } from './ClubForm'

const meta: Meta<typeof ClubForm> = {
  title: 'Components/ClubForm',
  component: ClubForm,
  parameters: { layout: 'padded' },
  // ClubForm's <form> renders with display: 'contents' so its fields become direct grid items
  // of the parent grid — decorate with the same grid RecordFormScreen provides in the real app
  // so this preview reflects the actual one/two-column layout.
  decorators: [
    (Story) => (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof ClubForm>

export const Create: Story = {
  args: {
    onSubmit: () => undefined,
  },
}

export const Edit: Story = {
  args: {
    onSubmit: () => undefined,
    initialValues: {
      name: 'Riverside Cricket Club',
      slug: 'riverside-cc',
    },
    profileInitialValues: {
      type: 'CLUB',
      logoUrl: '/media/riverside-logo.png',
      bannerUrl: '/media/riverside-banner.png',
      address: {
        number: '12',
        street: 'Main Road',
        city: 'Cape Town',
        provinceState: 'Western Cape',
        country: 'South Africa',
        postalCode: '8001',
      },
      email: 'club@riverside.example.com',
      phone: '+27 21 555 0100',
      website: 'https://riverside-cc.example.com',
    },
  },
}

// docs/standards/design-system.md's Storybook rule — every component gets a story with the
// viewport addon at 375/768/1280, same convention ProductForm.stories.tsx/SubscriptionForm
// .stories.tsx already establish, so mobile-friendliness is visible per-component.
export const MobileViewport: Story = {
  args: Edit.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: Edit.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: Edit.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
