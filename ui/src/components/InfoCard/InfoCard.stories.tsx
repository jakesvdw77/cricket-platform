import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button as MuiButton } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import { InfoCard } from './InfoCard'

const meta: Meta<typeof InfoCard> = {
  title: 'Components/InfoCard',
  component: InfoCard,
  parameters: { layout: 'padded' },
  args: {
    title: 'Club structure',
    icon: <AccountTreeOutlinedIcon />,
    fields: [
      { label: 'Sections', value: '9' },
      { label: 'Notes', value: null },
    ],
  },
}
export default meta

type Story = StoryObj<typeof InfoCard>

export const Default: Story = {}

export const WithNote: Story = { args: { note: 'More coming soon' } }

export const WithHeaderAction: Story = {
  args: {
    headerAction: (
      <MuiButton variant="outlined" size="small" startIcon={<AddIcon />}>
        Add section
      </MuiButton>
    ),
  },
}
