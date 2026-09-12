import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { SeasonForm } from './SeasonForm'

const meta: Meta<typeof SeasonForm> = {
  title: 'Components/SeasonForm',
  component: SeasonForm,
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

type Story = StoryObj<typeof SeasonForm>

export const NewSeason: Story = {
  args: { onSubmit: () => undefined },
}

export const EditExistingSeason: Story = {
  args: {
    onSubmit: () => undefined,
    initialValues: { label: '2026', startDate: '2026-01-01', endDate: '2026-12-31' },
  },
}

export const MobileViewport: Story = {
  args: NewSeason.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: NewSeason.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: NewSeason.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
