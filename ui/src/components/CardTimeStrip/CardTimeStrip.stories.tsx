import type { Meta, StoryObj } from '@storybook/react-vite'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined'
import { Countdown } from '../Countdown'
import { CardTimeStrip } from './CardTimeStrip'

const meta: Meta<typeof CardTimeStrip> = {
  title: 'Components/CardTimeStrip',
  component: CardTimeStrip,
  decorators: [(Story) => <div style={{ maxWidth: 360 }}><Story /></div>],
}
export default meta

type Story = StoryObj<typeof CardTimeStrip>

const soon = new Date(Date.now() + 20 * 3_600_000).toISOString()
const later = new Date(Date.now() + 5 * 24 * 3_600_000).toISOString()

// docs/specs/087: the match card's strip - more than a day away, neutral.
export const MatchStartsLater: Story = {
  args: { icon: <EventOutlinedIcon fontSize="small" />, label: 'Starts', value: 'Sat 17 Oct · 13:00', trailing: <Countdown target={later} phrase="to go" ariaPrefix="Starts in" /> },
}

// Within 24 hours: amber.
export const MatchStartsSoon: Story = {
  args: { icon: <EventOutlinedIcon fontSize="small" />, label: 'Starts', value: 'Sat 10 Oct · 13:00', tone: 'warning', trailing: <Countdown target={soon} phrase="to go" ariaPrefix="Starts in" /> },
}

export const Played: Story = {
  args: { icon: <EventOutlinedIcon fontSize="small" />, label: 'Played', value: 'Sat 3 Oct · 13:00' },
}

// The poll card's "Poll closes" strip, with a pencil.
export const PollCloses: Story = {
  args: {
    icon: <EventBusyOutlinedIcon fontSize="small" />,
    label: 'Poll closes',
    value: 'Fri 9 Oct · 22:00',
    tone: 'warning',
    action: <button type="button" aria-label="Edit close time">Edit</button>,
    trailing: <Countdown target={soon} phrase="left" ariaPrefix="Closes in" />,
  },
}
