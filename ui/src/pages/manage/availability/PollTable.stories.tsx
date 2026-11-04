import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { PollTable } from './PollTable'
import { ToolbarCard } from '../../../components/ToolbarCard'
import type { PollPanelRow } from './pollPanelRows'

const HOUR = 3_600_000
const fromNow = (ms: number) => new Date(Date.now() + ms).toISOString()

const meta: Meta<typeof PollTable> = {
  title: 'Pages/Manage/PollTable',
  component: PollTable,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof PollTable>

const rows: PollPanelRow[] = [
  { key: 's1', kind: 'SQUAD', title: 'Irene Villagers 1 vs POHBS', subtitle: 'Squad poll · Home · Thu 15 Oct', open: true, autoClose: true, scheduledCloseAt: fromNow(120 * HOUR), answered: 10, total: 14, path: '/manage/availability/squad/m1/p1' },
  { key: 'g1', kind: 'GROUP', title: 'Over 40s weekend 17–18 Oct', subtitle: 'Group poll · Vets', open: true, autoClose: true, scheduledCloseAt: fromNow(7 * HOUR), answered: 18, total: 25, bestSlot: true, path: '/manage/availability/group/r1' },
  { key: 's2', kind: 'SQUAD', title: 'Irene Villagers 2 vs Centurion', subtitle: 'Squad poll · Away · Sat 17 Oct', open: true, autoClose: false, scheduledCloseAt: null, answered: 6, total: 13, path: '/manage/availability/squad/m2/p2' },
  { key: 'g2', kind: 'GROUP', title: 'Under 15 Saturday 24 Oct', subtitle: 'Group poll · U15', open: false, autoClose: true, scheduledCloseAt: fromNow(-96 * HOUR), answered: 12, total: 12, path: '/manage/availability/group/r2' },
]

// docs/specs/090 (A): zebra rows; the second closes within 24 hours (amber); the third has no auto-close; the last is closed.
export const Default: Story = { args: { rows } }

// docs/specs/136: the fused card, a toolbar above the rows (one card, one hairline).
export const WithToolbar: Story = {
  args: { rows, toolbar: <ToolbarCard fused><Box sx={{ p: 1 }}>Filters, sort and Cards | List go here</Box></ToolbarCard> },
}

// With a toolbar and no rows the message replaces the table inside the same card.
export const EmptyWithToolbar: Story = {
  args: {
    rows: [],
    toolbar: <ToolbarCard fused><Box sx={{ p: 1 }}>Filters, sort and Cards | List go here</Box></ToolbarCard>,
    empty: <Box sx={{ p: 3, textAlign: 'center' }}>No matching polls</Box>,
  },
}

// The last cell's actions button (the page passes PollRowMenu; a plain button stands in so the story needs no data).
export const WithActions: Story = {
  args: { rows, renderActions: (row) => <button type="button" aria-label={`Actions for ${row.title}`}>⋮</button> },
}

export const Phone: Story = { args: { rows }, parameters: { viewport: { defaultViewport: 'mobile1' } } }
