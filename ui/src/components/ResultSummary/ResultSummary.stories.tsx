import type { Meta, StoryObj } from '@storybook/react-vite'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import { DetailLine } from '../DetailLine'
import { ResultSummary } from './ResultSummary'

const meta: Meta<typeof ResultSummary> = {
  title: 'Components/ResultSummary',
  component: ResultSummary,
  parameters: { layout: 'padded' },
}
export default meta

type Story = StoryObj<typeof ResultSummary>

export const Default: Story = {
  args: {
    sides: [
      { key: 'HOME', name: '1st XI', winner: true, innings: [{ kind: 'REGULAR', battingSide: 'HOME', runs: 212, wickets: 6, balls: 240 }] },
      { key: 'AWAY', name: 'Riverside Occasionals', innings: [{ kind: 'REGULAR', battingSide: 'AWAY', runs: 190, wickets: 10, balls: 228 }] },
    ],
    ballsPerOver: 6,
    resultLine: '1st XI won by 22 runs',
    resultColor: 'success.main',
  },
}

export const WithDetails: Story = {
  args: {
    ...Default.args,
    children: <DetailLine icon={<SportsCricketOutlinedIcon fontSize="small" />} label="Toss" value="1st XI won the toss and batted" />,
  },
}

export const NoScoresYet: Story = {
  args: {
    sides: [
      { key: 'HOME', name: '1st XI', innings: [] },
      { key: 'AWAY', name: 'Riverside Occasionals', innings: [] },
    ],
    resultLine: 'Match abandoned',
  },
}
