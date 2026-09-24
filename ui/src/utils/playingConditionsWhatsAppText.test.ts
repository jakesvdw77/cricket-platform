import { describe, expect, it } from 'vitest'
import { generatePlayingConditionsWhatsAppText } from './playingConditionsWhatsAppText'
import type { PlayingConditionsPayload } from '../api/leaguePlayingConditionsApi'

const baseConditions: PlayingConditionsPayload = {
  maxOversPerInnings: 20,
  powerplayOvers: 6,
  maxOversPerBowler: null,
  fieldingRestrictionsNotes: 'Two fielders outside the circle.',
  pointsForWin: 2,
  pointsForLoss: 0,
  pointsForDraw: 1,
  pointsForNoResult: 1,
  pointsForForfeitWin: 2,
  bonusPointsEnabled: false,
  bonusBattingOversThreshold: null,
  bonusBowlingRestrictionPercentage: null,
  additionalNotes: 'DLS applies for rain-affected matches.',
}

describe('generatePlayingConditionsWhatsAppText', () => {
  it('wraps the header line in WhatsApp bold markers and includes the league name and season label', () => {
    const text = generatePlayingConditionsWhatsAppText('Riverside T20 League', '2026', baseConditions)

    expect(text).toContain('*Riverside T20 League — Playing Conditions*')
    expect(text.split('\n\n')[0]).toContain('2026')
  })

  it('omits the Bonus Points block entirely when bonusPointsEnabled is false', () => {
    const text = generatePlayingConditionsWhatsAppText('Riverside T20 League', '2026', baseConditions)

    expect(text).not.toContain('*Bonus Points*')
  })

  it('includes the Bonus Points block, with the right threshold values, when bonusPointsEnabled is true', () => {
    const conditions: PlayingConditionsPayload = {
      ...baseConditions,
      bonusPointsEnabled: true,
      bonusBattingOversThreshold: 17,
      bonusBowlingRestrictionPercentage: 80,
    }

    const text = generatePlayingConditionsWhatsAppText('Riverside T20 League', '2026', conditions)

    expect(text).toContain('*Bonus Points*')
    expect(text).toContain('Chase the target before over 17 for a bonus point')
    expect(text).toContain('Restrict them to 80% of the target (or bowl them out) before over 17 for a bonus point')
  })

  it('omits the Bonus Points block when bonusPointsEnabled is true but a threshold is still null', () => {
    const conditions: PlayingConditionsPayload = {
      ...baseConditions,
      bonusPointsEnabled: true,
      bonusBattingOversThreshold: 17,
      bonusBowlingRestrictionPercentage: null,
    }

    const text = generatePlayingConditionsWhatsAppText('Riverside T20 League', '2026', conditions)

    expect(text).not.toContain('*Bonus Points*')
  })

  it('states the explicit maxOversPerBowler value when set, not the auto-computed one', () => {
    const conditions: PlayingConditionsPayload = { ...baseConditions, maxOversPerBowler: 3 }

    const text = generatePlayingConditionsWhatsAppText('Riverside T20 League', '2026', conditions)

    expect(text).toContain('Max overs per bowler: 3')
  })

  it('states the auto-computed ceil(overs / 5) value when maxOversPerBowler is null', () => {
    const text = generatePlayingConditionsWhatsAppText('Riverside T20 League', '2026', baseConditions)

    expect(text).toContain('Max overs per bowler: 4')
  })

  it('reflects updated points and thresholds in the output', () => {
    const original = generatePlayingConditionsWhatsAppText('Riverside T20 League', '2026', baseConditions)
    const changed = generatePlayingConditionsWhatsAppText('Riverside T20 League', '2026', {
      ...baseConditions,
      pointsForWin: 4,
      pointsForDraw: 2,
    })

    expect(original).toContain('Win: 2')
    expect(changed).toContain('Win: 4')
    expect(changed).toContain('Draw: 2')
    expect(changed).not.toBe(original)
  })

  it('never restates the free-text fieldingRestrictionsNotes or additionalNotes fields', () => {
    const text = generatePlayingConditionsWhatsAppText('Riverside T20 League', '2026', baseConditions)

    expect(text).not.toContain('Two fielders outside the circle.')
    expect(text).not.toContain('DLS applies for rain-affected matches.')
  })
})
