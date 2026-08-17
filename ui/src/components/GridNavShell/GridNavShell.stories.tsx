import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box, Typography } from '@mui/material'
import { Card } from '../Card'
import { GridNavShell } from './GridNavShell'

const meta: Meta<typeof GridNavShell> = {
  title: 'Components/GridNavShell',
  component: GridNavShell,
  parameters: { layout: 'fullscreen' },
}
export default meta

type Story = StoryObj<typeof GridNavShell>

const sampleGrid = (
  <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }}>
    <Card title="Sections & Age Groups">
      <Typography variant="body2" color="text.secondary">
        Set up age-group sections
      </Typography>
    </Card>
    <Card title="Teams">
      <Typography variant="body2" color="text.secondary">
        Register teams
      </Typography>
    </Card>
    <Card title="Players">
      <Typography variant="body2" color="text.secondary">
        Manage the player roster
      </Typography>
    </Card>
  </Box>
)

const args = {
  brand: 'Riverside CC',
  user: { name: 'Sam Manager', email: 'sam@riverside.cc' },
  onLogout: () => {},
  children: sampleGrid,
}

export const Mobile: Story = {
  args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const Desktop: Story = {
  args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
