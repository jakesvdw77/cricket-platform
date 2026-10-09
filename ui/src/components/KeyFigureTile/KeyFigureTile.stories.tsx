import type { Meta, StoryObj } from '@storybook/react-vite'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import { KeyFigureTile } from './KeyFigureTile'

const meta: Meta<typeof KeyFigureTile> = {
  title: 'Components/KeyFigureTile',
  component: KeyFigureTile,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div style={{ maxWidth: 280 }}><Story /></div>],
}
export default meta

type Story = StoryObj<typeof KeyFigureTile>

export const Number: Story = { args: { icon: <EventAvailableOutlinedIcon />, value: '12', label: 'Games this season' } }

export const Text: Story = {
  args: { icon: <EventAvailableOutlinedIcon />, value: 'TVL Division 1 T20', label: 'League · 2026/2027', textValue: true },
}

// docs/specs/089: a time that is within 24 hours reads amber.
export const Warning: Story = {
  args: { icon: <EventAvailableOutlinedIcon />, value: 'Thu 15 Oct', label: 'Starts 07:15 · in 5 hours', tone: 'warning' },
}

// A picker: the tile opens a menu owned by the page (Select team page Captain and Wicketkeeper).
export const Picker: Story = {
  args: { icon: <EventAvailableOutlinedIcon />, value: 'Michiel Boshoff', label: 'Captain', textValue: true, onClick: () => {}, ariaLabel: 'Captain: Michiel Boshoff, change' },
}
