import { describe, expect, it } from 'vitest'
import type { Innings, MatchResult, ResultDraft } from '../../../api/matchResultApi'
import {
  addSuperOver,
  applyBattingOrder,
  applySuggestion,
  draftFromResult,
  emptyDraft,
  firstBatterFromToss,
  isBlankDraft,
  removeLastSuperOver,
  toPayload,
  withToss,
  withoutSuperOvers,
  tossIncomplete,
} from './resultDraftHelpers'

const inn = (sequence: number, battingSide: 'HOME' | 'AWAY', runs: number | null, wickets: number | null = 5, balls: number | null = 240): Innings => ({
  sequence,
  kind: sequence <= 2 ? 'REGULAR' : 'SUPER_OVER',
  battingSide,
  runs,
  wickets,
  balls,
})

const won = (patch: Partial<ResultDraft> = {}): ResultDraft => ({
  ...emptyDraft(),
  outcomeType: 'WON',
  winningSide: 'HOME',
  marginType: 'RUNS',
  marginValue: 24,
  innings: [inn(1, 'HOME', 200), inn(2, 'AWAY', 176, 9)],
  ...patch,
})

describe('toPayload', () => {
  it('sends a partial regular innings with its missing figures null, but a super over only with all three', () => {
    const payload = toPayload(won({ innings: [inn(1, 'HOME', 200), inn(2, 'AWAY', 176, null), inn(3, 'HOME', null)] }))
    expect(payload.innings?.map((item) => item.sequence)).toEqual([1, 2])
    expect(payload.innings?.[1]).toMatchObject({ runs: 176, wickets: null })
  })

  it('sends only the innings fields the server accepts', () => {
    const payload = toPayload(won())
    expect(payload.innings?.[0]).toEqual({ sequence: 1, kind: 'REGULAR', battingSide: 'HOME', runs: 200, wickets: 5, balls: 240 })
  })

  it('drops a margin, winner and DLS figures an outcome does not use', () => {
    const payload = toPayload(won({ outcomeType: 'TIE', dlsTarget: 150, dlsRevisedBalls: 120 }))
    expect(payload).toMatchObject({
      outcomeType: 'TIE',
      winningSide: null,
      marginType: null,
      marginValue: null,
      dlsTarget: null,
      dlsRevisedBalls: null,
      decidedBy: 'REGULAR',
    })
  })

  it('keeps the winner of a forfeit but never a margin', () => {
    const payload = toPayload(won({ outcomeType: 'FORFEIT' }))
    expect(payload.winningSide).toBe('HOME')
    expect(payload.marginValue).toBeNull()
  })

  it('keeps DLS figures only for a DLS win and drops the margin only for a super over win', () => {
    expect(toPayload(won({ decidedBy: 'DLS', dlsTarget: 150, dlsRevisedBalls: 180 }))).toMatchObject({ dlsTarget: 150, dlsRevisedBalls: 180, marginValue: 24 })
    expect(toPayload(won({ decidedBy: 'REGULAR', dlsTarget: 150 })).dlsTarget).toBeNull()
    expect(toPayload(won({ decidedBy: 'SUPER_OVER' }))).toMatchObject({ marginType: null, marginValue: null })
  })

  it('keeps super over innings only when decided by a super over', () => {
    const innings = [inn(1, 'HOME', 150), inn(2, 'AWAY', 150, 9), inn(3, 'AWAY', 12, 1, 6), inn(4, 'HOME', 8, 2, 6)]
    expect(toPayload(won({ decidedBy: 'SUPER_OVER', innings })).innings).toHaveLength(4)
    expect(toPayload(won({ decidedBy: 'REGULAR', innings })).innings).toHaveLength(2)
  })

  it('drops the toss decision without a toss winner and trims the note to null when blank', () => {
    expect(toPayload(won({ tossWonBy: null, tossDecision: 'BAT' })).tossDecision).toBeNull()
    expect(toPayload(won({ note: '   ' })).note).toBeNull()
    expect(toPayload(won({ note: '  rain  ' })).note).toBe('rain')
  })

  it('defaults balls per over to 6', () => {
    expect(toPayload({ ...won(), ballsPerOver: null }).ballsPerOver).toBe(6)
  })

  it('turns an empty form into a payload of nulls with no innings', () => {
    expect(toPayload(emptyDraft())).toMatchObject({ outcomeType: null, winningSide: null, innings: [] })
  })
})

describe('firstBatterFromToss', () => {
  it('is the toss winner when they bat and the other side when they bowl', () => {
    expect(firstBatterFromToss({ tossWonBy: 'HOME', tossDecision: 'BAT' })).toBe('HOME')
    expect(firstBatterFromToss({ tossWonBy: 'HOME', tossDecision: 'BOWL' })).toBe('AWAY')
    expect(firstBatterFromToss({ tossWonBy: 'AWAY', tossDecision: 'BOWL' })).toBe('HOME')
  })

  it('is null while the toss or its decision is missing', () => {
    expect(firstBatterFromToss({ tossWonBy: null, tossDecision: null })).toBeNull()
    expect(firstBatterFromToss({ tossWonBy: 'HOME', tossDecision: null })).toBeNull()
  })
})

describe('applyBattingOrder', () => {
  it('re-orders the innings so the figures travel with their side', () => {
    const draft = won({ innings: [inn(1, 'HOME', 200, 5), inn(2, 'AWAY', 176, 9)] })
    const result = applyBattingOrder(draft, 'AWAY').innings!
    expect(result.map((item) => [item.sequence, item.battingSide, item.runs])).toEqual([
      [1, 'AWAY', 176],
      [2, 'HOME', 200],
    ])
  })

  it('is a no-op when the side already batted first', () => {
    const draft = won()
    expect(applyBattingOrder(draft, 'HOME').innings).toEqual(draft.innings)
  })

  it('creates a blank innings for a side that has none and leaves super overs alone', () => {
    const draft = won({ innings: [inn(1, 'HOME', 150), inn(3, 'AWAY', 9, 1, 6)] })
    const result = applyBattingOrder(draft, 'HOME').innings!
    expect(result.map((item) => [item.sequence, item.battingSide, item.runs])).toEqual([
      [1, 'HOME', 150],
      [2, 'AWAY', null],
      [3, 'AWAY', 9],
    ])
  })

  it('withToss re-orders only when the toss fixes the order', () => {
    const draft = won()
    expect(withToss(draft, { tossWonBy: 'AWAY', tossDecision: 'BAT' }).innings?.[0].battingSide).toBe('AWAY')
    const undecided = withToss(draft, { tossWonBy: 'AWAY', tossDecision: null })
    expect(undecided.innings).toEqual(draft.innings)
    expect(undecided.tossWonBy).toBe('AWAY')
  })
})

describe('super over helpers', () => {
  it('withoutSuperOvers drops only the super over innings', () => {
    const draft = won({ innings: [inn(1, 'HOME', 150), inn(2, 'AWAY', 150), inn(3, 'AWAY', 5, 0, 6), inn(4, 'HOME', 4, 0, 6)] })
    expect(withoutSuperOvers(draft).innings?.map((item) => item.sequence)).toEqual([1, 2])
  })

  it('adds super overs in pairs with the second batter first, then swapping', () => {
    const base = won({ innings: [inn(1, 'HOME', 150), inn(2, 'AWAY', 150)] })
    const one = addSuperOver(base)
    expect(one.innings?.slice(2).map((item) => [item.sequence, item.battingSide, item.kind])).toEqual([
      [3, 'AWAY', 'SUPER_OVER'],
      [4, 'HOME', 'SUPER_OVER'],
    ])
    const two = addSuperOver(one)
    expect(two.innings?.slice(4).map((item) => [item.sequence, item.battingSide])).toEqual([
      [5, 'HOME'],
      [6, 'AWAY'],
    ])
    expect(removeLastSuperOver(two).innings).toHaveLength(4)
    expect(removeLastSuperOver(base)).toBe(base)
  })
})

describe('applySuggestion', () => {
  const suggestion = { outcomeType: 'WON' as const, decidedBy: 'REGULAR' as const, winningSide: 'AWAY' as const, marginType: 'WICKETS' as const, marginValue: 3 }
  const withSuper = won({ decidedBy: 'SUPER_OVER', innings: [inn(1, 'HOME', 150), inn(2, 'AWAY', 150), inn(3, 'AWAY', 5, 0, 6), inn(4, 'HOME', 4, 0, 6)] })

  it('writes outcome, winner and margin and drops super overs unless the suggestion is a super over win', () => {
    const result = applySuggestion(withSuper, suggestion)
    expect(result).toMatchObject({ outcomeType: 'WON', decidedBy: 'REGULAR', winningSide: 'AWAY', marginType: 'WICKETS', marginValue: 3 })
    expect(result.innings).toHaveLength(2)
  })

  it('keeps super overs for a super over suggestion', () => {
    const result = applySuggestion(withSuper, { ...suggestion, decidedBy: 'SUPER_OVER', marginType: null, marginValue: null })
    expect(result.innings).toHaveLength(4)
    expect(result.marginValue).toBeNull()
  })

  it('turns a tie suggestion into a tie with no winner', () => {
    expect(applySuggestion(won(), { outcomeType: 'TIE', decidedBy: 'REGULAR', winningSide: null, marginType: null, marginValue: null })).toMatchObject({ outcomeType: 'TIE', winningSide: null })
  })
})

describe('draftFromResult and isBlankDraft', () => {
  it('starts both regular innings blank for a new result', () => {
    const draft = emptyDraft()
    expect(draft.innings?.map((item) => [item.sequence, item.battingSide])).toEqual([[1, 'HOME'], [2, 'AWAY']])
    expect(isBlankDraft(draft)).toBe(true)
  })

  it('is not blank once anything is entered', () => {
    expect(isBlankDraft({ ...emptyDraft(), scheduledBalls: 240 })).toBe(false)
    expect(isBlankDraft({ ...emptyDraft(), tossWonBy: 'HOME' })).toBe(false)
  })

  it('fills the missing regular innings of a stored result from the one it has', () => {
    const stored = { ...won(), id: 'r1', innings: [inn(2, 'AWAY', 100)] } as unknown as MatchResult
    expect(draftFromResult(stored).innings?.map((item) => [item.sequence, item.battingSide, item.runs])).toEqual([
      [1, 'HOME', null],
      [2, 'AWAY', 100],
    ])
    expect(draftFromResult(null)).toEqual(emptyDraft())
  })
})

describe('toPayload batting rows without a how out', () => {
  const row = (key: string, patch: object) => ({ battingSide: 'HOME' as const, inningsKind: 'REGULAR' as const, playerClientKey: key, resultPlayerId: null, position: 1, howOut: null, runs: null, balls: null, fours: null, sixes: null, featuredOverride: null, ...patch })

  it('sends a row with figures and no how out (howOut null, no bowler or fielder) and skips a row with neither', () => {
    const draft = won({ scorecard: { players: [], bowling: [], fielding: [], awards: [], batting: [row('a', { runs: 12, bowlerPlayerId: 'x', fielderPlayerId: 'y' }), row('b', {}), row('c', { howOut: 'CAUGHT', runs: 3, bowlerPlayerId: 'x' })] } })
    const batting = toPayload(draft).scorecard?.batting ?? []
    expect(batting.map((entry) => entry.playerClientKey)).toEqual(['a', 'c'])
    expect(batting[0]).toMatchObject({ howOut: null, runs: 12, bowlerPlayerId: null, fielderPlayerId: null })
    expect(batting[1]).toMatchObject({ howOut: 'CAUGHT', bowlerPlayerId: 'x', fielderPlayerId: null })
  })
})

describe('toPayload scorecard sections', () => {
  const player = (key: string, patch: object = {}) => ({ clientKey: key, side: 'HOME' as const, playerProfileId: 'p-' + key, displayName: null, plannedBattingOrder: null, replacedPlayerProfileId: null, substitute: false, ...patch })

  it('sends a players-only scorecard with no innings and no outcome', () => {
    const payload = toPayload({ ...emptyDraft(), scorecard: { players: [player('a'), player('b', { substitute: true })], batting: [], bowling: [], fielding: [], awards: [] } })
    expect(payload.innings ?? []).toEqual([])
    expect(payload.outcomeType ?? null).toBeNull()
    expect(payload.scorecard?.players).toHaveLength(2)
    expect(isBlankDraft({ ...emptyDraft(), scorecard: { players: [player('a')], batting: [], bowling: [], fielding: [], awards: [] } })).toBe(false)
  })

  it('keeps the opposition flag on its players and sends nothing for a draft with no scorecard', () => {
    const opp = player('x', { side: 'AWAY', playerProfileId: null, displayName: 'Sam Jones', opposition: true })
    const payload = toPayload(won({ scorecard: { players: [opp], batting: [], bowling: [], fielding: [], awards: [] } }))
    expect(payload.scorecard?.players[0]).toMatchObject({ opposition: true, displayName: 'Sam Jones' })
    expect(toPayload(won()).scorecard).toBeUndefined()
  })

  it('leaves out bowlers and fielders without figures, the client-only flags, and a Did not bat position', () => {
    const batting = { battingSide: 'HOME' as const, inningsKind: 'REGULAR' as const, playerClientKey: 'a', position: 4, howOut: 'DID_NOT_BAT' as const, runs: null, balls: null, fours: null, sixes: null, featuredOverride: null, auto: true }
    const bowlRow = { battingSide: 'AWAY' as const, inningsKind: 'REGULAR' as const, playerClientKey: 'b', bowlingOrder: 1, balls: null, maidens: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0, featuredOverride: null, untouched: true }
    const payload = toPayload(won({ scorecard: { players: [player('a'), player('b')], batting: [batting], bowling: [bowlRow], fielding: [], awards: [] } }))
    expect(payload.scorecard?.batting[0]).toMatchObject({ howOut: 'DID_NOT_BAT', position: null })
    expect(payload.scorecard?.batting[0]).not.toHaveProperty('auto')
    expect(payload.scorecard?.bowling).toEqual([])
  })
})

describe('tossIncomplete', () => {
  it('is true with no toss, with a winner but no decision, and with a decision but no winner', () => {
    expect(tossIncomplete({ tossWonBy: null, tossDecision: null })).toBe(true)
    expect(tossIncomplete({ tossWonBy: 'HOME', tossDecision: null })).toBe(true)
    expect(tossIncomplete({ tossWonBy: null, tossDecision: 'BAT' })).toBe(true)
  })

  it('is false once both the winner and the decision are given', () => {
    expect(tossIncomplete({ tossWonBy: 'AWAY', tossDecision: 'BOWL' })).toBe(false)
  })
})
