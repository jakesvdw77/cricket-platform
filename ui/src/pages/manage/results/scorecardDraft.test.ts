import { describe, expect, it } from 'vitest'
import type { BattingEntry, BowlingEntry, ResultDraft } from '../../../api/matchResultApi'
import type { MatchAward, ResultPlayer, Scorecard, ScorecardPrefillSide } from '../../../api/matchResultApi'
import { addPlayer, defaultSideFor, normalizeLoaded, applyDerivedCredits, matchPlayersFor, reconcileSubstitutes, removalOf, swapPlayer, applyCalculatedFigure, editInningsFigure, figureCorrected, inningsSuggestions, syncInningsFromScorecard, wicketsOwned } from './scorecardDraft'

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
    expect(made.bowling[0]).toMatchObject({ playerClientKey: 'x', wicketsSource: 'DERIVED', wickets: 1, bowlingOrder: 1, balls: null, runs: 0, maidens: 0, untouched: true })
    const gone = applyDerivedCredits({ ...made, batting: made.batting.map((e) => ({ ...e, bowlerPlayerId: null })) })
    expect(gone.bowling).toHaveLength(0)
  })

  it('never removes a row with typed figures', () => {
    const made = applyDerivedCredits(sc('x'))
    const typed = { ...made, bowling: made.bowling.map((e) => ({ ...e, balls: 12, untouched: false })), batting: made.batting.map((e) => ({ ...e, bowlerPlayerId: null })) }
    expect(applyDerivedCredits(typed).bowling).toHaveLength(1)
  })
})

describe('bowling rows start at zero but say nothing until touched', () => {
  it('an auto-created row has zero defaults, blank overs, and no calculated runs, wides or no-balls', () => {
    const base: Scorecard = {
      players: [player('x', null, { side: 'AWAY', opposition: true }), player('b', 'pb')],
      batting: [{ ...batter('b', 10, 'BOWLED'), bowlerPlayerId: 'x' }],
      bowling: [],
      fielding: [],
      awards: [],
    }
    const made = applyDerivedCredits(base)
    expect(made.bowling[0]).toMatchObject({ balls: null, maidens: 0, runs: 0, dots: 0, wides: 0, noBalls: 0, wickets: 1, untouched: true })
    const sugg = inningsSuggestions({ innings: [{ sequence: 1, kind: 'REGULAR', battingSide: 'HOME', runs: null, wickets: null, balls: null }], scorecard: { ...made, batting: [] } })
    expect(sugg.get(1)?.wides ?? null).toBeNull()
    expect(sugg.get(1)?.runs ?? null).toBeNull()
  })
})

describe('inningsSuggestions: untouched zeros and overs', () => {
  const inningsOnly = (): ResultDraft => ({ innings: [{ sequence: 1, kind: 'REGULAR', battingSide: 'HOME', runs: null, wickets: null, balls: null }], scorecard: { players: [], batting: [], bowling: [], fielding: [], awards: [] } })

  it('ignores batters still on their untouched zeros', () => {
    const d = inningsOnly()
    d.scorecard!.batting = [{ ...batter('a', 0, 'NOT_OUT'), untouched: true }, { ...batter('b', 0, 'NOT_OUT'), untouched: true }]
    expect(inningsSuggestions(d).get(1)).toBeUndefined()
  })

  it('counts a typed 0 once the manager touched the row', () => {
    const d = inningsOnly()
    d.scorecard!.batting = [batter('a', 0, 'BOWLED'), batter('b', 12, 'NOT_OUT')]
    expect(inningsSuggestions(d).get(1)).toMatchObject({ runs: 12, wickets: 1 })
  })

  it('takes the overs from the bowlers only, never from the batters\' balls', () => {
    const d = inningsOnly()
    d.scorecard!.batting = [{ ...batter('a', 30, 'BOWLED'), balls: 25 }]
    expect(inningsSuggestions(d).get(1)?.balls ?? null).toBeNull()
    d.scorecard!.bowling = [{ ...bowler('x', 18, 20, 1), battingSide: 'HOME' }, { ...bowler('y', 12, 9, 0), battingSide: 'HOME' }]
    expect(inningsSuggestions(d).get(1)?.balls).toBe(30)
  })
})

describe('defaultSideFor', () => {
  const ours = [{ side: 'HOME' as const }]
  const toss = (tossWonBy: 'HOME' | 'AWAY', tossDecision: 'BAT' | 'BOWL'): ResultDraft => ({ tossWonBy, tossDecision, innings: [] })

  it('opens Batting on the side that bats first and Bowling on the side that bowls first', () => {
    expect(defaultSideFor('batting', toss('AWAY', 'BAT'), ours)).toBe('AWAY')
    expect(defaultSideFor('bowling', toss('AWAY', 'BAT'), ours)).toBe('HOME')
    expect(defaultSideFor('batting', toss('AWAY', 'BOWL'), ours)).toBe('HOME')
  })

  it('falls back to the first innings once started, else Home, and to the first ours side on other steps', () => {
    const started: ResultDraft = { innings: [{ sequence: 1, kind: 'REGULAR', battingSide: 'AWAY', runs: 100, wickets: null, balls: null }] }
    expect(defaultSideFor('batting', started, ours)).toBe('AWAY')
    expect(defaultSideFor('batting', { innings: [] }, ours)).toBe('HOME')
    expect(defaultSideFor('teams', toss('HOME', 'BAT'), [{ side: 'AWAY' }])).toBe('AWAY')
  })
})

describe('addPlayer', () => {
  const empty = (): Scorecard => ({ players: [], batting: [], bowling: [], fielding: [], awards: [] })

  it('adds a registered player with a batting row and reuses them the second time', () => {
    const first = addPlayer(empty(), 'HOME', { playerProfileId: 'p1', firstName: 'A', lastName: 'Smith' }, 'DID_NOT_BAT')
    expect(first.scorecard.players).toHaveLength(1)
    expect(first.scorecard.batting).toHaveLength(1)
    const again = addPlayer(first.scorecard, 'HOME', { playerProfileId: 'p1', firstName: 'A', lastName: 'Smith' }, 'DID_NOT_BAT')
    expect(again.scorecard.players).toHaveLength(1)
    expect(again.key).toBe(first.key)
  })

  it('reuses a typed name without regard to case, but a same name on the other side is a different player', () => {
    const first = addPlayer(empty(), 'AWAY', { playerProfileId: null, displayName: 'Sam Jones', opposition: true }, null)
    const again = addPlayer(first.scorecard, 'AWAY', { playerProfileId: null, displayName: ' sam jones ', opposition: true }, null)
    expect(again.scorecard.players).toHaveLength(1)
    expect(again.key).toBe(first.key)
    const other = addPlayer(again.scorecard, 'HOME', { playerProfileId: null, displayName: 'Sam Jones' }, null)
    expect(other.scorecard.players).toHaveLength(2)
    expect(other.scorecard.players[1]).toMatchObject({ guest: true, opposition: false })
    expect(first.scorecard.players[0]).toMatchObject({ opposition: true, guest: false })
  })

  it('promotes the 12th man instead of adding them twice', () => {
    const base: Scorecard = { ...empty(), players: [player('t', 'p12', { substitute: true })] }
    const next = addPlayer(base, 'HOME', { playerProfileId: 'p12', firstName: 'T', lastName: 'M' }, null)
    expect(next.scorecard.players).toHaveLength(1)
    expect(next.scorecard.players[0].substitute).toBe(false)
  })
})

describe('normalizeLoaded', () => {
  it('gives every non-substitute player a batting row, an automatic Did not bat when missing, and leaves the 12th man without one', () => {
    const loaded: Scorecard = {
      players: [player('a', 'pa'), player('b', 'pb'), player('t', 'pt', { substitute: true })],
      batting: [batter('a', 20, 'CAUGHT')],
      bowling: [], fielding: [], awards: [],
    }
    const rows = normalizeLoaded(loaded).batting
    expect(rows.map((row) => row.playerClientKey)).toEqual(['a', 'b'])
    expect(rows[1]).toMatchObject({ howOut: 'DID_NOT_BAT', auto: true })
    expect(rows[0].howOut).toBe('CAUGHT')
  })

  it('marks a saved Did not bat as automatic again so it is re-derived', () => {
    const loaded: Scorecard = { players: [player('a', 'pa')], batting: [batter('a', null, 'DID_NOT_BAT')], bowling: [], fielding: [], awards: [] }
    expect(normalizeLoaded(loaded).batting[0].auto).toBe(true)
  })
})

describe('applyDerivedCredits: fielding', () => {
  const card = (howOut: BattingEntry['howOut'], fielder: string | null, fielding: Scorecard['fielding'] = []): Scorecard => ({
    players: [player('f', null, { side: 'AWAY', opposition: true }), player('b', 'pb')],
    batting: [{ ...batter('b', 10, howOut), fielderPlayerId: fielder, bowlerPlayerId: null }],
    bowling: [], fielding, awards: [],
  })

  it('creates a DERIVED fielding row at one credit and removes it again at none', () => {
    const made = applyDerivedCredits(card('CAUGHT', 'f'))
    expect(made.fielding).toHaveLength(1)
    expect(made.fielding[0]).toMatchObject({ playerClientKey: 'f', catches: 1, creditsSource: 'DERIVED' })
    const gone = applyDerivedCredits({ ...made, batting: made.batting.map((e) => ({ ...e, howOut: 'NOT_OUT' as const })) })
    expect(gone.fielding).toHaveLength(0)
  })

  it('never touches a MANUAL fielding row', () => {
    const manual = { battingSide: 'HOME' as const, inningsKind: 'REGULAR' as const, playerClientKey: 'f', catches: 5, stumpings: 0, runOuts: 0, featuredOverride: null }
    const kept = applyDerivedCredits(card('CAUGHT', 'f', [manual]))
    expect(kept.fielding).toEqual([manual])
  })
})
