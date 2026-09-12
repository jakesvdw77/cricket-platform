import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { LeagueForm } from './LeagueForm'

const meta: Meta<typeof LeagueForm> = {
  title: 'Components/LeagueForm',
  component: LeagueForm,
  parameters: { layout: 'padded' },
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

export const VetsLeague: Story = {
  args: {
    onSubmit: () => undefined,
    initialValues: { name: 'Vets League', maxPlayingXiSize: 12, allowSubstitutions: true, minAge: 40 },
  },
}

export const MobileViewport: Story = {
  args: NewLeague.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: NewLeague.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: NewLeague.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
