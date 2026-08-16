import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { SocialLinksRow } from './SocialLinksRow'

const meta: Meta<typeof SocialLinksRow> = {
  title: 'Components/SocialLinksRow',
  component: SocialLinksRow,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof SocialLinksRow>

const links = [
  { platform: 'facebook', url: 'https://facebook.com/cricketlegend' },
  { platform: 'instagram', url: 'https://instagram.com/cricketlegend' },
  { platform: 'x', url: 'https://x.com/cricketlegend' },
  { platform: 'linkedin', url: 'https://linkedin.com/company/cricketlegend' },
  { platform: 'youtube', url: 'https://youtube.com/@cricketlegend' },
] as const

export const OnLightSurface: Story = {
  args: { links: [...links] },
}

export const OnDarkSurface: Story = {
  args: { links: [...links] },
  decorators: [
    (Story) => (
      <Box sx={{ bgcolor: 'text.primary', color: 'background.paper', p: 3, borderRadius: 2 }}>
        <Story />
      </Box>
    ),
  ],
}
