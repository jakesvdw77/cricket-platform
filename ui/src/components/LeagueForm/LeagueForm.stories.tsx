import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { LeagueForm } from './LeagueForm'

const meta: Meta<typeof LeagueForm> = {
  title: 'Components/LeagueForm',
  component: LeagueForm,
  parameters: { layout: 'padded' },
  // LeagueForm's own <form> renders the same one/two-column grid RecordFormScreen provides in the
  // real app (see SponsorForm.stories.tsx's identical decorator for this tabbed-form shape) —
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

type Story = StoryObj<typeof LeagueForm>

export const NewLeague: Story = {
  args: { onSubmit: () => undefined },
}

export const AgeRestrictedLeague: Story = {
  args: {
    onSubmit: () => undefined,
    initialValues: { name: 'Junior U15 League', maxPlayingXiSize: 11, minAge: 13, maxAge: 15, ageCutoffDate: '2026-12-31' },
  },
}

// Every tab is enabled from the start, in both create and edit mode — no ClubForm-style
// "save the parent first" gating (mirrors SponsorForm.stories.tsx's own Edit story).
export const VetsLeagueWithProfile: Story = {
  args: {
    onSubmit: () => undefined,
    initialValues: {
      name: 'Vets League',
      maxPlayingXiSize: 12,
      minAge: 40,
      format: 'T30',
      phone: '+27 21 555 0177',
      website: 'https://riverside-vets.example.com',
      email: 'vets@riverside.example.com',
      logoUrl: '/media/managed/league-logo.png',
      socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/riverside-vets' }],
    },
  },
}

export const MobileViewport: Story = {
  args: VetsLeagueWithProfile.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: VetsLeagueWithProfile.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: VetsLeagueWithProfile.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
