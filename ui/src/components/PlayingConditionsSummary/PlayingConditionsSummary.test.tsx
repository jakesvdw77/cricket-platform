import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'
import { baseTheme } from '../../theme'
import type { LeaguePlayingConditions } from '../../api/leaguePlayingConditionsApi'
import { PlayingConditionsSummary } from './PlayingConditionsSummary'
import type { PlayingConditionsSummaryProps } from './PlayingConditionsSummary'

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
  fieldingRestrictionsNotes: 'Two outside the circle.',
  allowSubstitutions: true,
  pointsForWin: 4,
  pointsForLoss: 0,
  pointsForDraw: 2,
  pointsForNoResult: 2,
  pointsForForfeitWin: 4,
  bonusPointsEnabled: false,
  bonusBattingOversThreshold: null,
  bonusBowlingRestrictionPercentage: null,
  additionalNotes: 'Wides are one run.',
}

const show = (props: Partial<PlayingConditionsSummaryProps> = {}) =>
  render(
    <ThemeProvider theme={baseTheme}>
      <PlayingConditionsSummary leagueName="Saturday League" seasonLabel="2026/27" conditions={conditions} {...props} />
    </ThemeProvider>,
  )

describe('PlayingConditionsSummary', () => {
  it('names the league and season and shows the values', () => {
    show()
    expect(screen.getByText('Saturday League')).toBeInTheDocument()
    expect(screen.getByText('2026/27')).toBeInTheDocument()
    expect(screen.getByText('Max overs per innings').nextSibling).toHaveTextContent('40')
    expect(screen.getByText('Powerplay overs').nextSibling).toHaveTextContent('10')
    expect(screen.getByText('Substitutions allowed').nextSibling).toHaveTextContent('Yes')
    expect(screen.getByText('Two outside the circle.')).toBeInTheDocument()
    expect(screen.getByText('Wides are one run.')).toBeInTheDocument()
  })

  it('shows Auto with the computed value for a blank per-bowler maximum, and the set value otherwise', () => {
    const { unmount } = show()
    expect(screen.getByText('Max overs per bowler').nextSibling).toHaveTextContent('Auto (8)')
    unmount()
    show({ conditions: { ...conditions, maxOversPerBowler: 6 } })
    expect(screen.getByText('Max overs per bowler').nextSibling).toHaveTextContent('6')
  })

  it('links to the PDF only when one is stored', () => {
    const { unmount } = show()
    expect(screen.queryByRole('link', { name: 'Playing Conditions.pdf' })).not.toBeInTheDocument()
    unmount()
    show({ conditions: { ...conditions, documentUrl: 'https://example.com/pc.pdf' } })
    expect(screen.getByRole('link', { name: 'Playing Conditions.pdf' })).toHaveAttribute('href', 'https://example.com/pc.pdf')
  })

  it('says so when nothing is on file', () => {
    show({ conditions: null })
    expect(screen.getByText('No playing conditions are on file for this league and season.')).toBeInTheDocument()
  })

  it('notes when the result has other overs than the league plays, and only then', () => {
    const { unmount } = show({ scheduledOvers: 20 })
    expect(screen.getByText('This result is 20 overs; this league plays 40.')).toBeInTheDocument()
    unmount()
    show({ scheduledOvers: 40 })
    expect(screen.queryByText(/This result is/)).not.toBeInTheDocument()
  })
})
