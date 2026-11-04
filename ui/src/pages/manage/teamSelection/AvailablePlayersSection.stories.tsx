import type { Meta, StoryObj } from '@storybook/react-vite'
import { AvailablePlayersSection } from './AvailablePlayersSection'
import type { SelectionPoolEntry } from '../../../api/matchSelectionApi'

const entry = (id: string, first: string, last: string): SelectionPoolEntry => ({ playerProfileId: id, firstName: first, lastName: last, jerseyNumber: null, availability: 'AVAILABLE', selected: false, selectable: true, reason: null, reasonText: null, taken: null })

const meta: Meta<typeof AvailablePlayersSection> = {
  title: 'Pages/Manage/TeamSelection/AvailablePlayersSection',
  component: AvailablePlayersSection,
  parameters: { layout: 'padded' },
  args: { entries: [entry('a', 'Ann', 'Smith'), entry('b', 'Bob', 'Jones'), entry('c', 'Cy', 'Naidoo')], selectedCount: 8, maxSelected: 11, onSelectOtherPlayer: () => undefined, onCreatePlayer: () => undefined, onAddPlayer: () => undefined },
}
export default meta

type Story = StoryObj<typeof AvailablePlayersSection>

// docs/specs/137: open while the team has room, closed on arrival when it is full.
export const HasRoom: Story = {}
export const TeamFull: Story = { args: { selectedCount: 11 } }
export const NobodyElse: Story = { args: { entries: [] } }
