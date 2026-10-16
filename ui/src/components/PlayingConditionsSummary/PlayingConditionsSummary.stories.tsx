import type { Meta, StoryObj } from '@storybook/react-vite'
import { PlayingConditionsSummary } from './PlayingConditionsSummary'
import type { LeaguePlayingConditions } from '../../api/leaguePlayingConditionsApi'

const conditions: LeaguePlayingConditions = {
  id: 'pc-1',
  leagueId: 'league-1',
  seasonId: 'season-1',
  documentUrl: null,
  uploadedAt: null,
  uploadedBy: null,
  maxOversPerInnings: 40,
  powerplayOvers: 10,
  maxOversPerBowler: null,
  fieldingRestrictionsNotes: 'No more than two fielders outside the circle in the first ten overs.',
  allowSubstitutions: true,
  pointsForWin: 4,
  pointsForLoss: 0,
  pointsForDraw: 2,
  pointsForNoResult: 2,
  pointsForForfeitWin: 4,
  bonusPointsEnabled: false,
  bonusBattingOversThreshold: null,
  bonusBowlingRestrictionPercentage: null,
  additionalNotes: 'Wides and no balls are one run.',
}

const meta: Meta<typeof PlayingConditionsSummary> = {
  title: 'Components/PlayingConditionsSummary',
  component: PlayingConditionsSummary,
  parameters: { layout: 'padded' },
  args: { leagueName: 'Saturday League', seasonLabel: '2026/27', conditions },
}
export default meta

type Story = StoryObj<typeof PlayingConditionsSummary>

export const Default: Story = {}

export const WithPdf: Story = { args: { conditions: { ...conditions, documentUrl: 'https://example.com/conditions.pdf', maxOversPerBowler: 8 } } }

export const OversMismatch: Story = { args: { scheduledOvers: 20 } }

export const NoneOnFile: Story = { args: { conditions: null } }
