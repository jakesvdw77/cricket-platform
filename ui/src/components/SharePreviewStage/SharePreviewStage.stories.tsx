import type { Meta, StoryObj } from '@storybook/react-vite'
import { Typography } from '@mui/material'
import { SharePreviewStage } from './SharePreviewStage'

const meta: Meta<typeof SharePreviewStage> = {
  title: 'Components/SharePreviewStage',
  component: SharePreviewStage,
  parameters: { layout: 'padded' },
  args: {
    caption: 'This is what will be sent.',
    children: <Typography>Riverside won by 5 wickets</Typography>,
  },
}
export default meta

type Story = StoryObj<typeof SharePreviewStage>

export const Default: Story = {}
export const Mobile: Story = { parameters: { viewport: { defaultViewport: 'mobile' } } }
export const Tablet: Story = { parameters: { viewport: { defaultViewport: 'tablet' } } }
export const Desktop: Story = { parameters: { viewport: { defaultViewport: 'desktop' } } }
