import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { SponsorForm } from './SponsorForm'

const meta: Meta<typeof SponsorForm> = {
  title: 'Components/SponsorForm',
  component: SponsorForm,
  parameters: { layout: 'padded' },
  // SponsorForm's own <form> renders the same one/two-column grid RecordFormScreen provides in
  // the real app (see ClubForm.stories.tsx's identical decorator for this tabbed-form shape) —
  // decorate with that same grid so this preview reflects the actual layout.
  decorators: [
    (Story) => (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof SponsorForm>

export const Create: Story = {
  args: {
    onSubmit: () => undefined,
  },
}

// Every tab is enabled from the start, in both create and edit mode — unlike ClubForm, there is
// no "save the parent first" gating here (docs/plans/023-sponsors.md's Context section).
export const Edit: Story = {
  args: {
    onSubmit: () => undefined,
    initialValues: {
      name: 'Riverside Hardware',
      website: 'https://riverside-hardware.example.com',
      email: 'sponsor@riverside-hardware.example.com',
      phone: '+27 21 555 0177',
      logoUrl: '/media/managed/sponsor-logo.png',
      bannerUrl: '/media/managed/sponsor-banner.png',
      socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/riverside-hardware' }],
    },
  },
}

// docs/standards/design-system.md's Storybook rule requires a viewport story at 375/768/1280 for
// every component — same trio ClubForm.stories.tsx/ClubContactForm.stories.tsx already establish.
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
