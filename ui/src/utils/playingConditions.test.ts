import { describe, expect, it } from 'vitest'
import { describeBallsPerOver, describeFreeHit, resolveEffectiveMaxOversPerBowler, resolvePlayingConditionsPayload } from './playingConditions'
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
    maxBallsPerOver: null,
    freeHitOnNoBall: true,
    fieldingRestrictionsNotes: 'Two fielders outside the circle.',
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
      maxBallsPerOver: null,
      freeHitOnNoBall: true,
      fieldingRestrictionsNotes: 'Two fielders outside the circle.',
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
    })
  })

  it('still resolves a payload — with a PDF-only record\'s structured fields as-saved — when documentUrl is null but maxOversPerInnings is set', () => {
    const pdfOnly: LeaguePlayingConditions = { ...baseRecord, documentUrl: '/media/rules.pdf', uploadedAt: '2026-01-01T00:00:00Z' }
    expect(resolvePlayingConditionsPayload(pdfOnly)).not.toBeNull()
  })
})

const fullRecord: LeaguePlayingConditions = {
  id: 'r1', leagueId: 'l1', seasonId: 's1', documentUrl: null, uploadedAt: null, uploadedBy: null,
  maxOversPerInnings: 20, powerplayOvers: 6, maxOversPerBowler: 4, maxBallsPerOver: null, freeHitOnNoBall: true,
  fieldingRestrictionsNotes: null, allowSubstitutions: false, pointsForWin: 2, pointsForLoss: 0, pointsForDraw: 1,
  pointsForNoResult: 1, pointsForForfeitWin: 2, bonusPointsEnabled: false, bonusBattingOversThreshold: null,
  bonusBowlingRestrictionPercentage: null, additionalNotes: null,
}

describe('describeBallsPerOver and describeFreeHit (docs/specs/124)', () => {
  it('words the limit, and no limit for null or undefined', () => {
    expect(describeBallsPerOver(8)).toBe('At most 8, wides and no balls included')
    expect(describeBallsPerOver(null)).toBe('No limit')
    expect(describeBallsPerOver(undefined)).toBe('No limit')
  })

  it('words the free hit as Yes unless it is explicitly off', () => {
    expect(describeFreeHit(true)).toBe('Yes')
    expect(describeFreeHit(undefined)).toBe('Yes')
    expect(describeFreeHit(false)).toBe('No')
  })

  it('carries both fields into the payload and defaults a record that predates them', () => {
    const record = { ...fullRecord, maxBallsPerOver: 8, freeHitOnNoBall: false }
    expect(resolvePlayingConditionsPayload(record)).toMatchObject({ maxBallsPerOver: 8, freeHitOnNoBall: false })
    const old = { ...fullRecord, maxBallsPerOver: undefined, freeHitOnNoBall: undefined } as never
    expect(resolvePlayingConditionsPayload(old)).toMatchObject({ maxBallsPerOver: null, freeHitOnNoBall: true })
  })
})
