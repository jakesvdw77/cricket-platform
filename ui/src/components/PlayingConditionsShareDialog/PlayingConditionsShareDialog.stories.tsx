import type { Meta, StoryObj } from '@storybook/react-vite'
import { userEvent, within } from 'storybook/test'
import { PlayingConditionsShareDialog } from './PlayingConditionsShareDialog'
import type { PlayingConditionsPayload } from '../../api/leaguePlayingConditionsApi'

const conditions: PlayingConditionsPayload = {
  maxOversPerInnings: 20,
  powerplayOvers: 6,
  maxOversPerBowler: 4,
  fieldingRestrictionsNotes: 'Two fielders outside the circle in the powerplay.',
  pointsForWin: 2,
  pointsForLoss: 0,
  pointsForDraw: 1,
  pointsForNoResult: 1,
  pointsForForfeitWin: 2,
  bonusPointsEnabled: true,
  bonusBattingOversThreshold: 17,
  bonusBowlingRestrictionPercentage: 80,
  additionalNotes: 'DLS applies for rain-affected matches.',
}

const meta: Meta<typeof PlayingConditionsShareDialog> = {
  title: 'Components/PlayingConditionsShareDialog',
  component: PlayingConditionsShareDialog,
  parameters: { layout: 'centered' },
}
export default meta

type Story = StoryObj<typeof PlayingConditionsShareDialog>

export const Default: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    hasStructuredFields: true,
    leagueName: 'Riverside T20 League',
    seasonLabel: '2026',
    conditions,
    onSharePdf: async () => undefined,
  },
}

// Nothing saved yet for the selected season — an info Alert replaces the option list, both
// footer actions disabled.
export const NothingSavedYet: Story = {
  args: {
    ...Default.args,
    hasStructuredFields: false,
    conditions: null,
  },
}

// A rejected onSharePdf surfaces an inline error and keeps the dialog open for retry — the play
// function clicks "Open PDF" to actually exercise that failure path, since the error is local
// state only reachable via that interaction, not a settable prop.
export const ErrorState: Story = {
  args: {
    ...Default.args,
    onSharePdf: async () => {
      throw new Error("Couldn't generate the summary. Please try again.")
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('button', { name: /open pdf/i }))
    await canvas.findByText("Couldn't generate the summary. Please try again.")
  },
}

// Selecting "WhatsApp" reveals the generated, editable text area in place of the (nonexistent,
// for PDF) preview area.
export const WhatsAppSelected: Story = {
  args: Default.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByText('WhatsApp'))
    await canvas.findByRole('textbox', { name: /whatsapp message/i })
  },
}

export const MobileViewport: Story = {
  args: Default.args,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const TabletViewport: Story = {
  args: Default.args,
  parameters: { viewport: { defaultViewport: 'tablet' } },
}

export const DesktopViewport: Story = {
  args: Default.args,
  parameters: { viewport: { defaultViewport: 'desktop' } },
}

export const WhatsAppMobileViewport: Story = {
  args: WhatsAppSelected.args,
  play: WhatsAppSelected.play,
  parameters: { viewport: { defaultViewport: 'mobile' } },
}
