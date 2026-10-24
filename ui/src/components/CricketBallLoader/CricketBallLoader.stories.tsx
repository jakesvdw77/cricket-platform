import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { CricketBallLoader } from './CricketBallLoader'
import { FullPageLoader } from './FullPageLoader'

const meta: Meta<typeof CricketBallLoader> = {
  title: 'Components/CricketBallLoader',
  component: CricketBallLoader,
}
export default meta

type Story = StoryObj<typeof CricketBallLoader>

export const Default: Story = { args: { size: 'md', tone: 'dark' } }

export const Sizes: Story = {
  render: () => (
    <Box sx={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
      <CricketBallLoader size="sm" tone="dark" />
      <CricketBallLoader size="md" tone="dark" />
      <CricketBallLoader size="lg" tone="dark" />
    </Box>
  ),
}

export const FullPagePlain: StoryObj<typeof FullPageLoader> = { render: () => <FullPageLoader message="Loading overview" /> }

export const FullPageBackdrop: StoryObj<typeof FullPageLoader> = {
  parameters: { layout: 'fullscreen' },
  render: () => <FullPageLoader variant="backdrop" message="Signing you in" />,
}
