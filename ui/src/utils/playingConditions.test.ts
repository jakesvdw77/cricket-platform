import { describe, expect, it } from 'vitest'
import { resolveEffectiveMaxOversPerBowler, resolvePlayingConditionsPayload } from './playingConditions'
import type { LeaguePlayingConditions } from '../api/leaguePlayingConditionsApi'

describe('resolveEffectiveMaxOversPerBowler', () => {
  it('returns the explicit value as-is when maxOversPerBowler is set', () => {
    expect(resolveEffectiveMaxOversPerBowler(20, 3)).toBe(3)
  })

  it('applies the ceil(overs / 5) rule when maxOversPerBowler is null', () => {
    expect(resolveEffectiveMaxOversPerBowler(20, null)).toBe(4)
    // Not evenly divisible by 5 — confirms it's a genuine ceil, not a floor/round.
    expect(resolveEffectiveMaxOversPerBowler(22, null)).toBe(5)
  })

  it('returns null when maxOversPerInnings is itself null, regardless of maxOversPerBowler', () => {
    expect(resolveEffectiveMaxOversPerBowler(null, null)).toBeNull()
  })
})

describe('resolvePlayingConditionsPayload', () => {
  const baseRecord: LeaguePlayingConditions = {
    id: 'record-1',
    leagueId: 'league-1',
    seasonId: 'season-1',
    documentUrl: null,
    uploadedAt: null,
    uploadedBy: null,
    maxOversPerInnings: 20,
    powerplayOvers: 6,
    maxOversPerBowler: 4,
    fieldingRestrictionsNotes: 'Two fielders outside the circle.',
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

  it('returns null when the record itself is null or undefined', () => {
    expect(resolvePlayingConditionsPayload(null)).toBeNull()
    expect(resolvePlayingConditionsPayload(undefined)).toBeNull()
  })

  it('returns null — "structured fields never saved" — when maxOversPerInnings is null', () => {
    expect(resolvePlayingConditionsPayload({ ...baseRecord, maxOversPerInnings: null })).toBeNull()
  })

  it('maps the read shape to the writable payload shape field-for-field when structured fields have been saved', () => {
    expect(resolvePlayingConditionsPayload(baseRecord)).toEqual({
      maxOversPerInnings: 20,
      powerplayOvers: 6,
      maxOversPerBowler: 4,
      fieldingRestrictionsNotes: 'Two fielders outside the circle.',
      pointsForWin: 4,
      pointsForLoss: 0,
      pointsForDraw: 2,
      pointsForNoResult: 2,
      pointsForForfeitWin: 4,
      bonusPointsEnabled: true,
      bonusBattingOversThreshold: 17,
      bonusBowlingRestrictionPercentage: 80,
      additionalNotes: 'DLS applies for rain-affected matches.',
    })
  })

  it('still resolves a payload — with a PDF-only record\'s structured fields as-saved — when documentUrl is null but maxOversPerInnings is set', () => {
    const pdfOnly: LeaguePlayingConditions = { ...baseRecord, documentUrl: '/media/rules.pdf', uploadedAt: '2026-01-01T00:00:00Z' }
    expect(resolvePlayingConditionsPayload(pdfOnly)).not.toBeNull()
  })
})
