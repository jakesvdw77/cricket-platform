import { describe, expect, it } from 'vitest'
import {
  ballsText,
  bowlingDetail,
  bowlingFigure,
  competitionLabel,
  fieldingText,
  hasNoScorecard,
  howOutWord,
  inningsLine,
  opponentLabel,
  openResultLabel,
  runsText,
  teamsLabel,
} from './matchesFormat'
import { makeMatchRow, noScorecardRow } from '../../../test/playerMatchesFixtures'

// docs/specs/115-player-match-list.md: the display helpers choose words and dashes; the figures come from the server.
const inn = (over: Partial<Parameters<typeof runsText>[0]> = {}) => ({ runs: 56, balls: 41, notOut: false, howOut: 'CAUGHT' as const, fours: null, sixes: null, ...over })

describe('howOutWord', () => {
  it.each([
    ['CAUGHT', 'caught'],
    ['BOWLED', 'bowled'],
    ['LBW', 'lbw'],
    ['RUN_OUT', 'run out'],
    ['NOT_OUT', 'not out'],
  ] as const)('%s reads %s', (type, word) => {
    expect(howOutWord(type)).toBe(word)
  })

  it('is empty without a dismissal', () => {
    expect(howOutWord(null)).toBe('')
    expect(howOutWord(undefined)).toBe('')
  })
})

describe('runsText / inningsLine / ballsText', () => {
  it('stars a not-out innings and dashes missing runs', () => {
    expect(runsText(inn({ runs: 87, notOut: true }))).toBe('87*')
    expect(runsText(inn())).toBe('56')
    expect(runsText(inn({ runs: null }))).toBe('–')
  })

  it('writes the phone line with balls and how out, leaving unrecorded parts out', () => {
    expect(inningsLine(inn({ runs: 56, notOut: true, howOut: 'NOT_OUT' }))).toBe('56* off 41 · not out')
    expect(inningsLine(inn({ balls: null, howOut: null }))).toBe('56')
  })

  it('shows one innings balls or a dash, and the sum only when some innings recorded balls', () => {
    expect(ballsText([inn()], 41)).toBe('41')
    expect(ballsText([inn({ balls: null })], null)).toBe('–')
    expect(ballsText([inn({ balls: 10 }), inn({ balls: null })], 10)).toBe('10')
    expect(ballsText([inn({ balls: null }), inn({ balls: null })], 0)).toBe('–')
  })
})

describe('bowling and fielding text', () => {
  it('writes wickets over runs and the detail with overs through the match balls per over', () => {
    const bowling = { status: 'BOWLED' as const, balls: 24, maidens: 1, runs: 21, wickets: 2, dots: 8 }
    expect(bowlingFigure(bowling)).toBe('2/21')
    expect(bowlingDetail(bowling, 6)).toBe('4.0 ov · 1 mdn · 8 dots')
    expect(bowlingDetail({ ...bowling, balls: 26 }, 6)).toBe('4.2 ov · 1 mdn · 8 dots')
    expect(bowlingDetail({ ...bowling, balls: 22 }, 8)).toBe('2.6 ov · 1 mdn · 8 dots')
  })

  it('writes a dash, not a zero, for a missing wickets or runs figure', () => {
    expect(bowlingFigure({ status: 'BOWLED', balls: 24, maidens: 0, runs: null, wickets: 2, dots: null })).toBe('2/–')
    expect(bowlingFigure({ status: 'BOWLED', balls: 24, maidens: 0, runs: 14, wickets: null, dots: null })).toBe('–/14')
  })

  it('leaves the dots out when not recorded', () => {
    expect(bowlingDetail({ status: 'BOWLED', balls: 24, maidens: 0, runs: 14, wickets: 0, dots: null }, 6)).toBe('4.0 ov · 0 mdn')
  })

  it('names only non-zero credits, short in the table and long on the card, and is null when there are none', () => {
    const f = { status: 'RECORDED' as const, catches: 2, stumpings: 1, runOuts: 1 }
    expect(fieldingText(f)).toBe('2 ct · 1 st · 1 ro')
    expect(fieldingText(f, true)).toBe('2 catches · 1 stumping · 1 run-out')
    expect(fieldingText({ status: 'RECORDED', catches: 1, stumpings: 0, runOuts: 0 }, true)).toBe('1 catch')
    expect(fieldingText({ status: 'RECORDED', catches: 0, stumpings: 0, runOuts: 0 })).toBeNull()
  })
})

describe('row labels', () => {
  it('falls back to Friendly when there is no league, and uses the league name otherwise', () => {
    expect(competitionLabel(makeMatchRow())).toBe('Premier League')
    expect(competitionLabel(makeMatchRow({ competition: 'FRIENDLY', leagueId: null, leagueName: null }))).toBe('Friendly')
  })

  it('reads Internal match for a derby, joins both teams with v, and dashes a missing opponent', () => {
    const derby = makeMatchRow({
      derby: true,
      opponentName: null,
      ourTeams: [{ side: 'HOME', teamId: 'a', teamName: 'U15 A' }, { side: 'AWAY', teamId: 'b', teamName: 'U15 B' }],
    })
    expect(opponentLabel(derby)).toBe('Internal match')
    expect(teamsLabel(derby)).toBe('U15 A v U15 B')
    expect(opponentLabel(makeMatchRow({ opponentName: null }))).toBe('–')
    expect(opponentLabel(makeMatchRow())).toBe('Riverside')
  })

  it('builds the accessible name of the row link', () => {
    expect(openResultLabel('14 March 2026', makeMatchRow())).toBe('14 March 2026 against Riverside, open result')
    expect(openResultLabel('14 March 2026', makeMatchRow({ derby: true, opponentName: null }))).toBe('14 March 2026 against an internal match, open result')
  })

  it('is no scorecard only when all three blocks are NO_CARD', () => {
    expect(hasNoScorecard(noScorecardRow())).toBe(true)
    expect(hasNoScorecard(makeMatchRow({ bowling: { status: 'NO_CARD' }, fielding: { status: 'NO_CARD' } }))).toBe(false)
  })
})
