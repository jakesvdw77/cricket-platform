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

// docs/specs/099: a link tile - the match page's Field tile opens the field.
export const AsLink: Story = {
  args: { icon: <EventAvailableOutlinedIcon />, value: 'Riverside Oval', label: 'Field · Unverified', textValue: true, tone: 'warning', to: '/manage/fixtures/fields/field-1' },
}

// docs/specs/089 (Match page actions, 2026-10-16): a button under the caption (the match page's poll tile).
export const WithAction: Story = {
  args: { icon: <EventAvailableOutlinedIcon />, value: 'None', label: 'No poll yet', textValue: true, action: <button type="button">Open availability</button> },
}
