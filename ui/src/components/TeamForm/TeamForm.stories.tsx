import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { TeamForm } from './TeamForm'

const meta: Meta<typeof TeamForm> = {
  title: 'Components/TeamForm',
  component: TeamForm,
  parameters: { layout: 'padded' },
  // TeamForm's <form> renders with display: 'contents' so its fields become direct grid items of
  // the parent grid — decorate with the same grid RecordFormScreen provides in the real app (see
  // ClubContactForm.stories.tsx's identical decorator) so this preview reflects the actual
  // one/two-column layout.
  decorators: [
    (Story) => (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof TeamForm>

// Section-scoped create/edit flow — the section is already fixed by the route, so no picker
// renders at all (docs/specs/026-teams.md's re-parenting Non-goal).
export const WithoutSectionPicker: Story = {
  args: {
    onSubmit: () => undefined,
  },
}

export const EditExistingTeam: Story = {
  args: {
    onSubmit: () => undefined,
    initialValues: { name: '1st XI' },
  },
}

// No team logo of its own yet — falls back to showing the club's logo as an unambiguous default
// (docs/specs/027-team-profile.md).
export const FallsBackToClubLogo: Story = {
  args: {
    onSubmit: () => undefined,
    initialValues: { name: '1st XI' },
    clubLogoUrl: 'https://placehold.co/120x120?text=Club',
  },
}

// A team logo override is already set — shows the "Reset to club logo" action instead of the
// fallback caption.
export const WithLogoOverride: Story = {
  args: {
    onSubmit: () => undefined,
    initialValues: { name: '1st XI', logoUrl: 'https://placehold.co/120x120?text=Team' },
    clubLogoUrl: 'https://placehold.co/120x120?text=Club',
  },
}

// The club-wide directory's create flow — a required Section picker renders above the name field.
export const WithSectionPicker: Story = {
  args: {
    onSubmit: () => undefined,
    sections: [
      { id: 'section-1', name: 'Men' },
      { id: 'section-2', name: 'Women' },
      { id: 'section-3', name: 'Juniors — U13' },
    ],
  },
}

// docs/standards/design-system.md's Storybook rule requires a viewport story at 375/768/1280 for
// every component — same trio ClubContactForm.stories.tsx already establishes for this exact
// flat-field-grid anatomy.
export const MobileViewport: Story = {
  args: WithSectionPicker.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: WithSectionPicker.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: WithSectionPicker.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
