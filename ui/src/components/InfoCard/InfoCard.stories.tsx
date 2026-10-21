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

export const ChipsFirstLargeFields: Story = {
  args: {
    title: 'Cricket',
    chips: [
      { label: 'Bats: Right-hand', on: true },
      { label: 'Bowls: Right-arm medium', on: true },
      { label: 'Wicketkeeper', on: false },
    ],
    chipsFirst: true,
    fieldSize: 'large',
    columns: 3,
    fields: [
      { label: 'Matches', value: '24' },
      { label: 'Runs', value: '412' },
      { label: 'Wickets', value: '18' },
    ],
  },
}

// Large field text with the key figure tinted by its meaning; fewer than six fields draw 2 columns on a phone and 3 from md.
export const LargeFieldsWithEmphasis: Story = {
  args: {
    title: 'Record',
    fieldSize: 'large',
    fields: [
      { label: 'Played', value: '24', emphasis: 'primary' },
      { label: 'Won', value: '15', emphasis: 'success' },
      { label: 'Lost', value: '7', emphasis: 'error' },
      { label: 'Tied', value: '1', caption: 'of 24' },
    ],
  },
}

// Six or more large fields: 2 columns on a phone, 3 from sm, 4 from md.
export const LargeFieldsFourColumns: Story = {
  args: {
    title: 'Batting',
    fieldSize: 'large',
    fields: [
      { label: 'Runs', value: '3120', emphasis: 'primary' },
      { label: 'Wickets lost', value: '142' },
      { label: 'Innings', value: '24' },
      { label: 'Average', value: '21.97' },
      { label: 'Run rate', value: '4.8' },
      { label: 'Balls faced', value: '3900' },
    ],
  },
}
