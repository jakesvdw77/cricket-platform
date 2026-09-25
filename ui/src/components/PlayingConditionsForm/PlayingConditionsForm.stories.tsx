import type { Meta, StoryObj } from '@storybook/react-vite'
import { Box } from '@mui/material'
import { userEvent, within } from 'storybook/test'
import { PlayingConditionsForm } from './PlayingConditionsForm'
import type { PlayingConditionsPayload } from '../../api/leaguePlayingConditionsApi'

const meta: Meta<typeof PlayingConditionsForm> = {
  title: 'Components/PlayingConditionsForm',
  component: PlayingConditionsForm,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <Box sx={{ maxWidth: 720 }}>
        <Story />
      </Box>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof PlayingConditionsForm>

const savedValues: PlayingConditionsPayload = {
  maxOversPerInnings: 20,
  powerplayOvers: 6,
  maxOversPerBowler: 4,
  fieldingRestrictionsNotes: 'Two fielders outside the 30-yard circle during the powerplay.',
  allowSubstitutions: true,
  pointsForWin: 4,
  pointsForLoss: 0,
  pointsForDraw: 2,
  pointsForNoResult: 2,
  pointsForForfeitWin: 4,
  bonusPointsEnabled: true,
  bonusBattingOversThreshold: 17,
  bonusBowlingRestrictionPercentage: 80,
  additionalNotes: 'DLS applies for rain-affected matches.',
}

// First-ever save for this league+season — seeded T20 point defaults, no bonus fields mounted.
export const NewSeason: Story = {
  args: { onSubmit: () => undefined, pending: false },
}

export const SavedValues: Story = {
  args: { onSubmit: () => undefined, pending: false, initialValues: savedValues },
}

// Play function checks the bonus checkbox to actually exercise the "genuinely unmounted, not
// disabled" threshold fields — same pattern TeamSheetCommunicationDialog's own WhatsAppSelected
// story uses for a state only reachable via interaction, not a settable prop.
export const BonusPointsEnabled: Story = {
  args: { onSubmit: () => undefined, pending: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByLabelText(/enable bonus points/i))
    await canvas.findByLabelText('Early-chase overs threshold')
  },
}

export const Pending: Story = {
  args: { onSubmit: () => undefined, pending: true, initialValues: savedValues },
}

export const ErrorState: Story = {
  args: { onSubmit: () => undefined, pending: false, error: new Error('boom') },
}

export const MobileViewport: Story = {
  args: NewSeason.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: NewSeason.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: NewSeason.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}
