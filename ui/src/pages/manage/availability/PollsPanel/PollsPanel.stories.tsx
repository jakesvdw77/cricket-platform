import type { Meta, StoryObj } from '@storybook/react-vite'
import { PollsPanel } from './PollsPanel'
import type { PollPanelRow } from '../pollPanelRows'

const HOUR = 3_600_000
const fromNow = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString()

const ROWS: PollPanelRow[] = [
  { key: 'g1', kind: 'GROUP', title: 'Thursday 15 October - Over 40 fixtures', open: true, autoClose: true, scheduledCloseAt: fromNow(30), answered: 15, total: 18, path: '/manage/availability/group/g1' },
  { key: 's1', kind: 'SQUAD', title: 'Irene Villagers 1 vs POHBS', open: true, autoClose: true, scheduledCloseAt: fromNow(130), answered: 3, total: 11, path: '/manage/availability/squad/m1/s1' },
  { key: 's2', kind: 'SQUAD', title: 'Irene Villagers 2 vs CBC 1', open: false, autoClose: true, scheduledCloseAt: fromNow(-60), answered: 9, total: 11, path: '/manage/availability/squad/m2/s2' },
]

// The router comes from the Storybook preview.
const meta: Meta<typeof PollsPanel> = {
  title: 'Pages/Manage/PollsPanel',
  component: PollsPanel,
  args: { open: true, onClose: () => undefined, kind: 'all', rows: ROWS, showClosed: true, scope: 'Vets › Over 40' },
}
export default meta

type Story = StoryObj<typeof PollsPanel>

export const PollsShown: Story = {}
export const OpenPolls: Story = { args: { showClosed: false, rows: ROWS.filter((row) => row.open) } }
export const ClosingWithin48Hours: Story = { args: { kind: 'closing-soon', showClosed: false } }
export const Loading: Story = { args: { rows: null } }
export const Empty: Story = { args: { rows: [] } }
