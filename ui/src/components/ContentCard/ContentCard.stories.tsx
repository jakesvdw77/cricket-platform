import type { Meta, StoryObj } from '@storybook/react-vite'
import { Typography } from '@mui/material'
import { ContentCard } from './ContentCard'

const meta: Meta<typeof ContentCard> = {
  title: 'Components/ContentCard',
  component: ContentCard,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof ContentCard>

export const Default: Story = {
  args: {
    children: (
      <>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Details
        </Typography>
        <Typography variant="body2" color="text.secondary">
          A white, shadowed surface floating above the page wash — the shared body-content
          treatment for RecordDetailScreen's sections and RecordFormScreen's field grid/actions
          bar.
        </Typography>
      </>
    ),
  },
}
