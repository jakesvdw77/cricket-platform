import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { BRAND } from '../../brandTokens'
import { BrandMark } from './BrandMark'

const meta: Meta<typeof BrandMark> = { title: 'Components/BrandMark', component: BrandMark }
export default meta
type Story = StoryObj<typeof BrandMark>

export const Default: Story = { args: { size: 48 } }

export const OnDarkHeaderWithEdge: Story = {
  args: { size: 34, edge: true },
  render: (args) => (
    <Box sx={{ bgcolor: BRAND.green900, p: 2, display: 'inline-flex' }}>
      <BrandMark {...args} />
    </Box>
  ),
}
