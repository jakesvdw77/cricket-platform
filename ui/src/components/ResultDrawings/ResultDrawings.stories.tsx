import type { Meta, StoryObj } from '@storybook/react-vite'
import { alpha } from '@mui/material/styles'
import { BRAND } from '../../brandTokens'
import { OverBlocks } from './OverBlocks'
import { RunsMixBar } from './RunsMixBar'

// docs/specs/145: the two Player Hub result drawings on the dark console ground, with the data the cards use.
const meta: Meta = {
  title: 'Components/ResultDrawings',
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 340, padding: 16, background: alpha(BRAND.green900, 1), color: BRAND.cream }}>
        <Story />
      </div>
    ),
  ],
}
export default meta

export const BattingFiftyWithBoundaries: StoryObj = { render: () => <RunsMixBar runs={52} fours={6} sixes={1} /> }
export const BattingNoBoundaries: StoryObj = { render: () => <RunsMixBar runs={9} fours={0} sixes={0} /> }
export const BowlingTwoWickets: StoryObj = { render: () => <OverBlocks balls={36} ballsPerOver={6} wickets={2} maidens={1} /> }
export const BowlingPartOver: StoryObj = { render: () => <OverBlocks balls={26} ballsPerOver={6} wickets={0} maidens={0} /> }
