import type { Meta, StoryObj } from '@storybook/react-vite'
import { Typography } from '@mui/material'
import { Button } from '../Button'
import { Card } from './Card'

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof Card>

export const Default: Story = {
  args: {
    title: 'Season 2026',
    children: <Typography variant="body2">Riverside CC · Open 1st XI</Typography>,
  },
}

export const WithFooter: Story = {
  args: {
    title: 'Riverside CC vs Colts',
    children: <Typography variant="body2">Saturday, 14:00 — Home ground</Typography>,
    footer: (
      <Button size="sm" variant="secondary">
        View scorecard
      </Button>
    ),
  },
}

export const NoTitle: Story = {
  args: {
    children: <Typography variant="body2">A card with no header.</Typography>,
  },
}
