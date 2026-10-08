import type { Meta, StoryObj } from '@storybook/react-vite'
import { ResponsesByPlayer } from './ResponsesByPlayer'
import type { ResponseRow } from './responseHelpers'
import type { SectionAvailabilityRoundBracket } from '../../../../api/sectionAvailabilityApi'

const bracket = (windowId: string, windowDate: string, dayPart: 'MORNING' | 'AFTERNOON'): SectionAvailabilityRoundBracket => ({
  windowId, windowDate, dayPart, availableCount: 0, unsureCount: 0, unavailableCount: 0, noResponseCount: 0, coveredMatchCount: 1,
})
const answer = (windowId: string, status: 'AVAILABLE' | 'UNSURE' | 'UNAVAILABLE' | null) => ({
  windowId, dayPart: 'MORNING' as const, windowDate: '2026-10-15', status,
})
const row = (id: string, firstName: string, lastName: string, a: Array<'AVAILABLE' | 'UNSURE' | 'UNAVAILABLE' | null>): ResponseRow => ({
  playerProfileId: id, firstName, lastName, jerseyNumber: null, statuses: a.map((status, index) => answer(`w${index + 1}`, status)),
})

const ROWS = [
  row('p1', 'Anton', 'de Villiers', ['AVAILABLE', 'AVAILABLE']),
  row('p2', 'Brain', 'Best', ['AVAILABLE', null]),
  row('p3', 'Emile', 'van der Merwe', ['UNAVAILABLE', 'UNSURE']),
  row('p4', 'Jaco', 'van der Westhuizen', [null, null]),
]

// docs/specs/085 (J): the Player tab with status chips and sortable headings.
const meta: Meta<typeof ResponsesByPlayer> = {
  title: 'Pages/Manage/ResponsesByPlayer',
  component: ResponsesByPlayer,
  parameters: { layout: 'padded' },
  args: { rows: ROWS, override: { pendingKey: null, onOverride: async () => true } },
}
export default meta

type Story = StoryObj<typeof ResponsesByPlayer>

export const SingleSlot: Story = { args: { brackets: [bracket('w1', '2026-10-15', 'MORNING')] } }
export const SeveralSlots: Story = {
  args: { brackets: [bracket('w1', '2026-10-15', 'MORNING'), bracket('w2', '2026-10-30', 'AFTERNOON')] },
}
