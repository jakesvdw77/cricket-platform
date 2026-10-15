import { describe, expect, it } from 'vitest'
import type { BattingEntry, BowlingEntry, ResultDraft } from '../../../api/matchResultApi'
import type { MatchAward, ResultPlayer, Scorecard, ScorecardPrefillSide } from '../../../api/matchResultApi'
import { applyDerivedCredits, matchPlayersFor, reconcileSubstitutes, removalOf, swapPlayer, applyCalculatedFigure, editInningsFigure, figureCorrected, inningsSuggestions, syncInningsFromScorecard, wicketsOwned } from './scorecardDraft'

const batter = (key: string, runs: number | null, howOut: BattingEntry['howOut']): BattingEntry => ({
  battingSide: 'HOME', inningsKind: 'REGULAR', resultPlayerId: null, playerClientKey: key, position: 1, howOut, runs, balls: null, fours: null, sixes: null, featuredOverride: null,
})
const bowler = (key: string, balls: number, runs: number, wickets: number): BowlingEntry => ({
  battingSide: 'AWAY', inningsKind: 'REGULAR', resultPlayerId: null, playerClientKey: key, bowlingOrder: 1, balls, maidens: 0, runs, wickets, wides: null, noBalls: null, featuredOverride: null,
})
const draft = (extra: Partial<ResultDraft['innings'] extends (infer I)[] | undefined ? I : never> = {}): ResultDraft => ({
  innings: [
    { sequence: 1, kind: 'REGULAR', battingSide: 'HOME', runs: null, wickets: null, balls: null, wides: 3, byes: 2, ...extra },
    { sequence: 2, kind: 'REGULAR', battingSide: 'AWAY', runs: null, wickets: null, balls: null, byes: 4, nonBowlerWickets: 1 },
  ],
  scorecard: {
    players: [],
    batting: [batter('a', 50, 'CAUGHT'), batter('b', 30, 'RUN_OUT'), batter('c', 10, 'RETIRED_NOT_OUT'), batter('d', null, 'NOT_OUT')],
    bowling: [bowler('x', 120, 80, 2), bowler('y', 60, 20, 1)],
    fielding: [],
    awards: [],
  },
})

describe('calculated innings', () => {
  it('our innings: batters runs + extras, wickets = dismissals (retired not out is not one)', () => {
    expect(inningsSuggestions(draft()).get(1)).toMatchObject({ runs: 50 + 30 + 10 + 5, wickets: 2 })
  })

  it('the opposition innings: bowlers runs + byes, wickets + non-bowler wickets, balls summed', () => {
    expect(inningsSuggestions(draft()).get(2)).toMatchObject({ runs: 100 + 4, wickets: 3 + 1, balls: 180 })
  })

  it('sync fills the figures and marks them calculated', () => {
    const synced = syncInningsFromScorecard(draft())
    expect(synced.innings?.[0]).toMatchObject({ runs: 95, wickets: 2, runsCorrected: false, wicketsCorrected: false })
    expect(synced.innings?.[1]).toMatchObject({ runs: 104, wickets: 4, balls: 180 })
  })

  it('follows later edits while calculated', () => {
    const synced = syncInningsFromScorecard(draft())
    const edited = syncInningsFromScorecard({ ...synced, scorecard: { ...synced.scorecard!, batting: [batter('a', 60, 'CAUGHT')] } })
    expect(edited.innings?.[0].runs).toBe(65)
  })

  it('a corrected figure is kept, flagged, and handed back by Use calculated', () => {
    const synced = syncInningsFromScorecard(draft())
    const corrected = editInningsFigure(synced, 1, 'runs', 100)
    expect(corrected.innings?.[0].runs).toBe(100)
    expect(figureCorrected(corrected.innings![0], 'runs', 95)).toBe(true)
    const more = syncInningsFromScorecard({ ...corrected, scorecard: { ...corrected.scorecard!, batting: [batter('a', 70, 'CAUGHT')] } })
    expect(more.innings?.[0].runs).toBe(100)
    expect(applyCalculatedFigure(more, 1, 'runs').innings?.[0].runs).toBe(75)
  })

  it('a corrected figure that equals the calculation again follows the scorecard', () => {
    const corrected = editInningsFigure(syncInningsFromScorecard(draft()), 1, 'runs', 100)
    const level = editInningsFigure(corrected, 1, 'runs', 95)
    expect(figureCorrected(level.innings![0], 'runs', 95)).toBe(false)
    expect(level.innings?.[0].runsCorrected).toBe(false)
  })

  it('typed wickets stay the manager\'s (and drive the fill) until Use calculated', () => {
    const typed = editInningsFigure(syncInningsFromScorecard(draft()), 1, 'wickets', 6)
    expect(wicketsOwned(typed.innings![0])).toBe(true)
    const equalNow = editInningsFigure(typed, 1, 'wickets', 2)
    expect(wicketsOwned(equalNow.innings![0])).toBe(true)
    expect(wicketsOwned(applyCalculatedFigure(equalNow, 1, 'wickets').innings![0])).toBe(false)
  })

  it('loaded figures that differ from the scorecard are treated as corrected', () => {
    const loaded = draft({ runs: 200, wickets: 6 })
    expect(syncInningsFromScorecard(loaded).innings?.[0]).toMatchObject({ runs: 200, wickets: 6 })
  })
})

describe('wides and no-balls from the bowlers', () => {
  it('add up to the innings extras without being added to the runs again', () => {
    const d = draft()
    d.scorecard!.bowling = [{ ...bowler('x', 120, 80, 2), wides: 5, noBalls: 1 }, { ...bowler('y', 60, 20, 1), wides: 2, noBalls: null }]
    const calc = inningsSuggestions(d).get(2)
    expect(calc).toMatchObject({ wides: 7, noBalls: 1, runs: 100 + 4 })
    const synced = syncInningsFromScorecard(d)
    expect(synced.innings?.[1]).toMatchObject({ wides: 7, noBalls: 1, widesCorrected: false })
    const edited = editInningsFigure(synced, 2, 'wides', 9)
    expect(figureCorrected(edited.innings![1], 'wides', 7)).toBe(true)
    expect(syncInningsFromScorecard(edited).innings?.[1].wides).toBe(9)
  })
})

const player = (key: string, profile: string | null, patch: Partial<ResultPlayer> = {}): ResultPlayer => ({
  clientKey: key, side: 'HOME', playerProfileId: profile, displayName: profile ? null : `Guest ${key}`, plannedBattingOrder: null, replacedPlayerProfileId: null, substitute: false,
  firstName: profile ? key.toUpperCase() : null, lastName: profile ? 'Smith' : null, ...patch,
})

describe('swap, the 12th man and the side list', () => {
  const card = (): Scorecard => ({
    players: [player('a', 'pa'), player('b', 'pb')],
    batting: [batter('a', 40, 'CAUGHT')],
    bowling: [bowler('a', 12, 10, 1)],
    fielding: [],
    awards: [{ awardType: 'PLAYER_OF_MATCH', side: 'HOME', playerClientKey: 'a', resultPlayerId: null, displayName: null } as MatchAward],
  })

  it('a swap changes the one result player, so the batting row, bowling entry and award follow', () => {
    const swapped = swapPlayer(card(), 'a', { playerProfileId: 'pz', firstName: 'Zed', lastName: 'Zulu' })
    expect(swapped.players.filter((p) => p.playerProfileId === 'pa')).toHaveLength(0)
    expect(swapped.players.find((p) => p.clientKey === 'a')).toMatchObject({ playerProfileId: 'pz', replacedPlayerProfileId: 'pa', firstName: 'Zed' })
    expect(swapped.batting[0]).toMatchObject({ playerClientKey: 'a', runs: 40 })
    expect(swapped.bowling[0]).toMatchObject({ playerClientKey: 'a', wickets: 1 })
    expect(swapped.awards[0].playerClientKey).toBe('a')
  })

  it('a swap onto someone already on the side is refused', () => {
    expect(swapPlayer(card(), 'a', { playerProfileId: 'pb', firstName: 'B', lastName: 'Smith' })).toEqual(card())
  })

  const prefillSide: ScorecardPrefillSide = {
    side: 'HOME',
    teamId: 't',
    teamName: 'XI',
    players: [
      ...Array.from({ length: 11 }, (_, i) => ({ playerProfileId: `p${i}`, firstName: `P${i}`, lastName: 'X', plannedBattingOrder: i + 1, role: i === 3 ? ('BOWLER' as const) : ('BATSMAN' as const), substitute: false })),
      { playerProfileId: 'p12', firstName: 'Twelfth', lastName: 'Man', plannedBattingOrder: null, role: 'BATSMAN' as const, substitute: true },
    ],
  }

  it('the match players are the side list (11 + the 12th man), bowlers first', () => {
    const players = prefillSide.players.map((p) => player(p.playerProfileId, p.playerProfileId, { substitute: p.substitute, firstName: p.firstName, lastName: p.lastName }))
    const list = matchPlayersFor({ players, batting: [], bowling: [], fielding: [], awards: [] }, 'HOME', prefillSide)
    expect(list).toHaveLength(12)
    expect(list[0].key).toBe('p3')
    expect(list.find((p) => p.key === 'p12')).toMatchObject({ substitute: true, firstName: 'Twelfth' })
  })

  it('the 12th man is promoted when they bowl and goes back when they no longer do', () => {
    const subs = new Set(['p12'])
    const twelfth = player('t', 'p12', { substitute: true })
    const base: Scorecard = { players: [twelfth], batting: [], bowling: [], fielding: [], awards: [] }
    const bowled = reconcileSubstitutes({ ...base, bowling: [bowler('t', 6, 5, 0)] }, subs)
    expect(bowled.players[0].substitute).toBe(false)
    expect(reconcileSubstitutes({ ...bowled, bowling: [] }, subs).players[0].substitute).toBe(true)
    // someone who was never the 12th man is not demoted
    const other = reconcileSubstitutes({ players: [player('q', 'pq')], batting: [], bowling: [], fielding: [], awards: [] }, subs)
    expect(other.players[0].substitute).toBe(false)
  })

  it('removal: the selection is set to Did not bat, a manual player with other entries is blocked, others are removed', () => {
    const sc = { ...card(), players: [...card().players, player('m', null)], bowling: [bowler('m', 6, 1, 0)] }
    expect(removalOf(sc, 'a', new Set(['pa']), 'A')).toEqual({ kind: 'dnb' })
    expect(removalOf(sc, 'm', new Set(), 'Guest m').kind).toBe('blocked')
    expect(removalOf(sc, 'b', new Set(), 'B')).toEqual({ kind: 'remove' })
  })
})

describe('bowling rows from dismissals', () => {
  const sc = (bowlerOf: string | null): Scorecard => ({
    players: [player('x', null, { side: 'AWAY', opposition: true }), player('b', 'pb')],
    batting: [{ ...batter('b', 10, 'BOWLED'), bowlerPlayerId: bowlerOf }],
    bowling: [],
    fielding: [],
    awards: [],
  })

  it('creates a DERIVED bowling row for a named bowler and removes it again while it is still empty', () => {
    const made = applyDerivedCredits(sc('x'))
    expect(made.bowling).toHaveLength(1)
    expect(made.bowling[0]).toMatchObject({ playerClientKey: 'x', wicketsSource: 'DERIVED', wickets: 1, bowlingOrder: 1, balls: null })
    const gone = applyDerivedCredits({ ...made, batting: made.batting.map((e) => ({ ...e, bowlerPlayerId: null })) })
    expect(gone.bowling).toHaveLength(0)
  })

  it('never removes a row with typed figures', () => {
    const made = applyDerivedCredits(sc('x'))
    const typed = { ...made, bowling: made.bowling.map((e) => ({ ...e, balls: 12 })), batting: made.batting.map((e) => ({ ...e, bowlerPlayerId: null })) }
    expect(applyDerivedCredits(typed).bowling).toHaveLength(1)
  })
})

describe('innings balls from the batting card', () => {
  const draftFor = (balls: Array<number | null>, noBalls: number | null, byes: number | null): ResultDraft => ({
    innings: [{ sequence: 1, kind: 'REGULAR', battingSide: 'HOME', runs: null, wickets: null, balls: null, noBalls, byes }],
    scorecard: {
      players: [],
      batting: balls.map((b, i) => ({ ...batter(`p${i}`, 10, 'CAUGHT'), balls: b })),
      bowling: [],
      fielding: [],
      awards: [],
    },
  })

  it('is the sum of the balls faced when there are no no-balls (STUMPS 1st innings: 180 = 30.0 overs)', () => {
    expect(inningsSuggestions(draftFor([60, 50, 40, 30], null, null)).get(1)?.balls).toBe(180)
  })

  it('takes the no-balls off and ignores byes (STUMPS 2nd innings: 107 faced, 1 no-ball, 4 byes = 106 = 17.4 overs)', () => {
    expect(inningsSuggestions(draftFor([57, 50], 1, 4)).get(1)?.balls).toBe(106)
  })

  it('suggests nothing while a batter has no balls entered', () => {
    expect(inningsSuggestions(draftFor([60, null], null, null)).get(1)?.balls ?? null).toBeNull()
  })
})
