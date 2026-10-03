import type { Meta, StoryObj } from '@storybook/react-vite'
import { Chip, Stack } from '@mui/material'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import UpcomingOutlinedIcon from '@mui/icons-material/UpcomingOutlined'
import { DetailLine } from './DetailLine'

const meta: Meta<typeof DetailLine> = {
  title: 'Components/DetailLine',
  component: DetailLine,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof DetailLine>

export const Default: Story = {
  args: { icon: <EventOutlinedIcon fontSize="small" />, label: 'When', value: 'Sat 17 Oct, 10:00' },
}

export const Muted: Story = {
  args: {
    icon: <EventOutlinedIcon fontSize="small" />,
    label: 'First match',
    value: 'Not scheduled yet',
    labelWidth: 78,
    muted: true,
  },
}

export const WithBadgeValue: Story = {
  render: () => (
    <Stack spacing={1.25}>
      <DetailLine
        icon={<UpcomingOutlinedIcon fontSize="small" />}
        label="Next match"
        labelWidth={78}
        value={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <span>Sat 17 Oct, 10:00</span>
            <Chip size="small" label="in 14 days" color="success" />
          </Stack>
        }
      />
    </Stack>
  ),
}
