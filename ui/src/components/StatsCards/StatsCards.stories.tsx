import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
import { Typography } from '@mui/material'
import { BRAND } from '../../brandTokens'
import { StatsCardGrid } from './StatsCardGrid'
import { StatsCardShell } from './StatsCardShell'
import { sortCards } from './statsCardOrder'
import type { CardCtx, StatsCardDef, StatsGroupDef } from './statsCardTypes'

// docs/specs/147: the shell in each state, and the grid with a synthetic card family to show that a new card is a definition and nothing else.
const meta: Meta = {
  title: 'Components/StatsCards',
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div style={{ maxWidth: 1000, padding: 16, background: BRAND.green900, color: BRAND.cream }}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
}
export default meta

const face = (text: string) => <Typography sx={{ fontSize: 40, fontWeight: 700 }}>{text}</Typography>
const common = { title: 'Season In A Card', scopeLabel: '2025/26 · All teams', basis: { counted: 6, total: 7 }, summary: 'Sam has 412 runs in 9 innings.', front: face('412'), back: face('Average 61.4') }

export const Ready: StoryObj = { render: () => <StatsCardShell {...common} tag="HAVE" state="ready" /> }
export const Partial: StoryObj = { render: () => <StatsCardShell {...common} tag="HAVE" state="partial" partialNote="Balls faced were recorded in 5 of 9 innings." /> }
export const Empty: StoryObj = { render: () => <StatsCardShell {...common} tag="HAVE" state="empty" emptyText="Not enough innings yet." /> }
export const NotCaptured: StoryObj = { render: () => <StatsCardShell {...common} tag="NOT_CAPTURED" state="missing" whenMissing="notCaptured" missingText="The scorecard does not record partnerships." /> }

// A synthetic payload and card family: nothing in the grid knows about them.
interface Demo {
  runs: number
  wickets: number
}
const ctx: CardCtx = { firstName: 'Sam', scopeLabel: '2025/26 · All teams', resultHref: (id) => `/result/${id}`, drillHref: (target) => `/drill/${target.kind}` }
const groups: StatsGroupDef[] = [
  { id: 'batting', label: 'Batting' },
  { id: 'bowling', label: 'Bowling' },
]
const card = (id: string, group: 'batting' | 'bowling', order: number, title: string, pick: (payload: Demo) => number): StatsCardDef<Demo> => ({
  id,
  page: 'mine',
  group,
  title: () => title,
  tag: 'HAVE',
  needs: [group === 'batting' ? 'runs' : 'wickets'],
  order,
  whenMissing: 'hide',
  state: (payload) => (pick(payload) === 0 ? 'empty' : 'ready'),
  summary: (payload) => `${title}: ${pick(payload)}`,
  Front: ({ payload }) => face(String(pick(payload))),
  Back: ({ payload }) => face(`Story: ${pick(payload)}`),
})
const defs = [card('mine.runs', 'batting', 1, 'Runs', (p) => p.runs), card('mine.more', 'batting', 2, 'Another Card', (p) => p.runs * 2), card('mine.wickets', 'bowling', 1, 'Wickets', (p) => p.wickets)]

export const GridWithSyntheticCards: StoryObj = {
  render: () => <StatsCardGrid<Demo> payload={{ runs: 412, wickets: 0 }} ctx={ctx} cards={sortCards(defs, 'mine', groups)} groups={groups} basis={{ counted: 6, total: 7 }} />,
}
