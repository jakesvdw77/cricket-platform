import type { Meta, StoryObj } from '@storybook/react-vite'
import { Stack } from '@mui/material'
import { PlayerName } from './PlayerName'
import { splitName } from '../../utils/playerDisplayName'
import type { PersonName } from '../../utils/playerDisplayName'

const venter: PersonName = { id: 'a', firstName: 'Sam', lastName: 'Venter' }
const vdw: PersonName = { id: 'b', firstName: 'Sam', lastName: 'van der Westhuizen' }
const guest: PersonName = { id: 'g', ...splitName('Thabo Naidoo') }
const VIEW = [venter, vdw, guest]

const meta: Meta<typeof PlayerName> = {
  title: 'Components/PlayerName',
  component: PlayerName,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof PlayerName>

export const FullName: Story = {
  render: () => (
    <Stack>
      {VIEW.map((person) => (
        <PlayerName key={person.id} person={person} view={VIEW} mode="full" />
      ))}
    </Stack>
  ),
}

// Two Sams in the view get a surname tag; Thabo does not need one.
export const FirstNameWithTags: Story = {
  render: () => (
    <Stack>
      {VIEW.map((person) => (
        <PlayerName key={person.id} person={person} view={VIEW} mode="first" />
      ))}
    </Stack>
  ),
}
