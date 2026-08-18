import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box, Typography } from '@mui/material'
import { MemoryRouter } from 'react-router-dom'
import { Input } from '../Input'
import { Button } from '../Button'
import { RecordFormScreen } from './RecordFormScreen'

const meta: Meta<typeof RecordFormScreen> = {
  title: 'Components/RecordFormScreen',
  component: RecordFormScreen,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof RecordFormScreen>

export const Default: Story = {
  args: {
    title: 'Add Product',
    backTo: '/admin/configuration/products',
    backLabel: 'Back to Products',
    actions: (
      <>
        <Button variant="ghost">Cancel</Button>
        <Button>Save</Button>
      </>
    ),
    children: (
      <>
        <Input label="Code" />
        <Input label="Name" />
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Input label="Description" multiline minRows={3} />
        </Box>
        <Input label="Price" />
        <Input label="Currency" />
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Typography variant="body2" color="text.secondary">
            Full-width fields span both columns from the md breakpoint up.
          </Typography>
        </Box>
      </>
    ),
  },
}
