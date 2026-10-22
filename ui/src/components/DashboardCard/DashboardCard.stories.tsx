import type { Meta, StoryObj } from '@storybook/react-vite'
import { DashboardCard } from './DashboardCard'
import { BarSeriesChart } from '../charts/BarSeriesChart'

const labels = ['6 Sep', '13 Sep', '20 Sep', '27 Sep', '4 Oct', '11 Oct', '18 Oct', '25 Oct']
const values = [34, 0, 56, 12, null, 41, 23, 94]
const hatched = [false, false, true, false, false, false, false, true]

const chart = (
  <BarSeriesChart
    labels={labels}
    values={values}
    hatched={hatched}
    valueTexts={values.map((value, index) => (value === null ? null : hatched[index] ? `${value}*` : String(value)))}
    referenceValue={37.5}
    referenceLabel="Avg 37.5"
  />
)

const table = {
  caption: 'Runs per innings, oldest first',
  columns: [
    { key: 'date', label: 'Date' },
    { key: 'opponent', label: 'Opponent' },
    { key: 'runs', label: 'Runs', align: 'right' as const },
  ],
  rows: [
    ...labels.map((label, index) => ({ key: label, cells: [label, 'Riverside CC', values[index] === null ? 'Not recorded' : `${values[index]}${hatched[index] ? '*' : ''}`] })),
    { key: 'total', total: true, cells: ['Total', '', '260'] },
  ],
}

const meta: Meta<typeof DashboardCard> = {
  title: 'Components/DashboardCard',
  component: DashboardCard,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div style={{ maxWidth: 720 }}><Story /></div>],
  args: {
    testId: 'runs-per-innings',
    title: 'Runs per innings',
    subtitle: 'Batting',
    description: '7 innings, 2 not out. Best 94* on 25 Oct.',
    coverage: 'Last 8 of 14 innings; the Runs tile counts all 14.',
    table,
    children: chart,
  },
}
export default meta

type Story = StoryObj<typeof DashboardCard>

export const Default: Story = {}

export const WithoutSubtitle: Story = { args: { subtitle: undefined } }

export const WithDirectionNote: Story = { args: { title: 'Economy rate', subtitle: 'Bowling', note: 'Lower is better · runs per over', footer: 'Last 5 matches: 4.35 runs per over, down from 5.20 in the 5 before.' } }

export const Partial: Story = { args: { coverage: 'Based on 9 of 14 matches that have a batting card. 5 matches have only a team list and are not charted.' } }

export const Empty: Story = { args: { empty: { title: 'No batting cards captured', description: 'The runs chart needs a scorecard with a batting card.' } } }

export const Loading: Story = { args: { loading: true } }

export const ErrorState: Story = { args: { error: { onRetry: () => {} } } }

export const Dimmed: Story = { args: { dimmed: true } }
