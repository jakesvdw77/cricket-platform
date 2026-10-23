import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box, Typography } from '@mui/material'
import { PageBackdrop } from './PageBackdrop'

const meta: Meta<typeof PageBackdrop> = {
  title: 'Components/PageBackdrop',
  component: PageBackdrop,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof PageBackdrop>

const card = (
  <Box sx={{ bgcolor: 'background.paper', color: 'text.primary', borderRadius: 2, boxShadow: 1, p: 3, m: 'auto', maxWidth: 560 }}>
    <Typography variant="h6">A white card above the backdrop</Typography>
  </Box>
)

export const Default: Story = { args: { children: card } }
export const WithPhoto: Story = { args: { children: card, imageUrl: 'https://placehold.co/1200x800' } }
