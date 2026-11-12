import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
import { BRAND } from '../../brandTokens'
import { ColumnChart } from './ColumnChart'
import { Donut } from './Donut'
import { HorizontalBars } from './HorizontalBars'
import { LineChart } from './LineChart'
import { ProgressBars } from './ProgressBars'

// docs/specs/147: the shared stats drawings on the dark console ground, with fixture numbers (a real card is given the server's).
const meta: Meta = {
  title: 'Components/StatsDrawings',
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div style={{ maxWidth: 340, padding: 16, background: BRAND.green900, color: BRAND.cream }}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
}
export default meta

const innings = [
  { key: 'a', value: 12, name: '12 against Rovers, 4 October', href: '/hub/result/a' },
  { key: 'b', value: 47, notOut: true, name: '47 not out against Eagles, 11 October', href: '/hub/result/b' },
  { key: 'c', value: 0, name: '0 against Lions, 18 October', href: '/hub/result/c' },
  { key: 'd', value: 63, name: '63 against Hawks, 25 October', href: '/hub/result/d' },
  { key: 'e', value: 31, name: '31 against Rovers, 1 November', href: '/hub/result/e' },
]

export const InningsLine: StoryObj = {
  render: () => (
    <LineChart
      points={innings}
      average={[12, 29.5, 29.5, 30.5, 30.6]}
      guides={[
        { value: 30, label: '30' },
        { value: 50, label: '50' },
      ]}
      alt="Runs in five innings: 12, 47 not out, 0, 63, 31. Running average 30.6."
      startLabel="4 Oct"
      endLabel="1 Nov"
    />
  ),
}
export const InningsLineSinglePoint: StoryObj = { render: () => <LineChart points={[innings[0]]} alt="One innings: 12 runs." /> }
export const DismissalsDonut: StoryObj = {
  render: () => (
    <Donut
      slices={[
        { key: 'no', label: 'Not out', value: 3 },
        { key: 'ct', label: 'Caught', value: 5 },
        { key: 'bw', label: 'Bowled', value: 2 },
        { key: 'ro', label: 'Run out', value: 1 },
      ]}
      centre="11"
      centreCaption="innings"
      alt="How the batter was out in 11 innings: 3 not out, 5 caught, 2 bowled, 1 run out."
    />
  ),
}
export const ScoreBands: StoryObj = {
  render: () => (
    <HorizontalBars
      rows={[
        { key: '0', label: '0 to 9', value: 4, valueLabel: '4', href: '/hub/drill?filter=BAND_0_9' },
        { key: '1', label: '10 to 29', value: 6, valueLabel: '6' },
        { key: '2', label: '30 to 49', value: 3, valueLabel: '3' },
        { key: '3', label: '50 plus', value: 1, valueLabel: '1' },
      ]}
      alt="Scores in bands: 4 of 0 to 9, 6 of 10 to 29, 3 of 30 to 49, 1 of 50 plus."
    />
  ),
}
export const MilestoneProgress: StoryObj = {
  render: () => (
    <ProgressBars
      rows={[
        { key: 'runs', label: 'Runs to 500', value: 412, target: 500, text: '412 of 500, 88 to go' },
        { key: 'wkts', label: 'Wickets to 25', value: 19, target: 25, text: '19 of 25, 6 to go' },
      ]}
      alt="Runs 412 of 500, 88 to go. Wickets 19 of 25, 6 to go."
    />
  ),
}

export const BowlingColumns: StoryObj = {
  render: () => (
    <div style={{ height: 150 }}>
      <ColumnChart
        alt="Wickets in the last three innings bowled."
        columns={[
          { key: 'a', value: 3, valueLabel: '3', label: '4 Oct', sub: 'Econ 4.50', href: '/hub/result/a', name: '3 wickets, 4 October. Open the match.' },
          { key: 'b', value: 0, valueLabel: '0', label: '11 Oct', sub: 'Econ 6.10', href: '/hub/result/b', name: '0 wickets, 11 October. Open the match.' },
          { key: 'c', value: 2, valueLabel: '2', label: '18 Oct', sub: 'Econ 3.80', href: '/hub/result/c', name: '2 wickets, 18 October. Open the match.' },
        ]}
      />
    </div>
  ),
}
