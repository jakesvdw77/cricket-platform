import { describe, expect, it } from 'vitest'
import {
  battingFigure, bowlingFigure, cardKind, chipFigure, competitionText, economy, economyText, extrasLine, formSentence, howOutWords, offBalls,
  opponentCode, ourTeamsText, oversText, oversToBalls, playerStripText, resultBanner, resultPath, resultTone, resultWord, resultsQuery,
  scopeLabel, scopeQuery, storyLine, streakLetter, versusText,
} from './resultsFormat'
import { battingRow, bowlingRow, didNotBatRow, noCardRow } from '../../../test/hubResultFixtures'
import { resultRow } from '../../../test/tickerFixtures'

// docs/specs/145 Test Plan, Frontend: the pure words and figures of the Results screens. The server decides every figure; these only choose words.
describe('result words, letters and tone', () => {
  it('names each outcome and gives each its streak letter', () => {
    expect(resultWord('NO_RESULT')).toBe('No Result')
    expect(resultWord('INTERNAL')).toBe('Internal Match')
    expect(['WON', 'LOST', 'TIED', 'DRAWN', 'NO_RESULT', 'ABANDONED', 'INTERNAL'].map((o) => streakLetter(o as never)).join('')).toBe('WLTDNAI')
  })

  it('tones a win, a loss and a tie and leaves every other outcome plain', () => {
    expect(resultTone('WON')).toBe('win')
    expect(resultTone('LOST')).toBe('loss')
    expect(resultTone('TIED')).toBe('tie')
    expect(['DRAWN', 'NO_RESULT', 'ABANDONED', 'INTERNAL'].map((o) => resultTone(o as never))).toEqual(['neutral', 'neutral', 'neutral', 'neutral'])
  })

  it('uses the server result line, else the word for the outcome', () => {
    expect(resultBanner({ resultLine: ' Villagers won by 24 runs ', result: 'WON' })).toBe('Villagers won by 24 runs')
    expect(resultBanner({ resultLine: '  ', result: 'LOST' })).toBe('Lost')
    expect(resultBanner({ resultLine: null, result: 'TIED' })).toBe('Tied')
  })
})

describe('figures', () => {
  it('marks a not out score with a star on the last innings only', () => {
    const out = battingRow()
    expect(battingFigure(out)).toBe('46')
    const notOut = battingRow({ batting: { ...out.batting, innings: [{ runs: 20, balls: 10, notOut: false, fours: 0, sixes: 0 }, { runs: 26, balls: 20, notOut: true, fours: 0, sixes: 0 }], runs: 46 } })
    expect(battingFigure(notOut)).toBe('46*')
    expect(battingFigure(battingRow({ batting: { ...out.batting, innings: null } }))).toBe('46')
  })

  it('writes bowling as wickets for runs', () => {
    expect(bowlingFigure(bowlingRow())).toBe('2/21')
  })

  it('writes overs from legal balls, with a part over and the singular', () => {
    expect(oversText(36, 6)).toBe('6 overs')
    expect(oversText(26, 6)).toBe('4.2 overs')
    expect(oversText(6, 6)).toBe('1 over')
    expect(oversText(16, 8)).toBe('2 overs')
    expect(oversText(12, 0)).toBe('2 overs')
  })

  it('rounds economy to one decimal and has none with no balls bowled', () => {
    expect(economy(21, 24, 6)).toBe(5.3)
    expect(economy(10, 0, 6)).toBeNull()
    expect(economyText(bowlingRow())).toBe('economy 5.3')
    expect(economyText(didNotBatRow())).toBeNull()
  })

  it('turns overs text into legal balls', () => {
    expect(oversToBalls('36.4', 6)).toBe(220)
    expect(oversToBalls('8', 8)).toBe(64)
    expect(oversToBalls('x', 6)).toBe(0)
  })

  it('writes the off-balls text and the extras line', () => {
    expect(offBalls(46, 1)).toBe('46 off 1 ball')
    expect(offBalls(46, 68)).toBe('46 off 68 balls')
    expect(extrasLine({ extras: 8, wides: 3, noBalls: 1, byes: 2, legByes: 2, penaltyRuns: 0 })).toBe('Extras 8 (w 3, nb 1, b 2, lb 2)')
    expect(extrasLine({ extras: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0, penaltyRuns: 5 })).toBe('Extras 0 (pen 5)')
    expect(extrasLine({ extras: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0, penaltyRuns: 0 })).toBe('Extras 0')
  })
})

describe('cardKind and the chip figure', () => {
  it('gives a batter the batting card and a bowler the bowling card', () => {
    expect(cardKind(battingRow())).toBe('batting')
    expect(cardKind(bowlingRow())).toBe('bowling')
  })

  it('lets a wicket weigh about 15 runs when a player did both', () => {
    const both = (runs: number, wickets: number) => battingRow({ batting: { ...battingRow().batting, runs }, bowling: { ...bowlingRow().bowling, wickets } })
    expect(cardKind(both(9, 3))).toBe('bowling')
    expect(cardKind(both(46, 3))).toBe('batting')
    expect(cardKind(both(45, 3))).toBe('batting')
  })

  it('gives did-not-bat and no-card matches the plain card', () => {
    expect(cardKind(didNotBatRow())).toBe('noBat')
    expect(cardKind(noCardRow())).toBe('noBat')
  })

  it('shows the headline figure, DNB, or a dash under a streak chip', () => {
    expect(chipFigure(battingRow())).toBe('46')
    expect(chipFigure(bowlingRow())).toBe('2/21')
    expect(chipFigure(didNotBatRow())).toBe('DNB')
    expect(chipFigure(noCardRow())).toBe('-')
  })
})

describe('names and labels', () => {
  it('codes the opponent in three letters and a derby as INT', () => {
    expect(opponentCode({ opponentName: 'Pretoria A', derby: false })).toBe('PRE')
    expect(opponentCode({ opponentName: null, derby: false })).toBe('INT')
    expect(opponentCode({ opponentName: 'Rovers', derby: true })).toBe('INT')
  })

  it('writes versus text for an opponent and a derby', () => {
    expect(versusText(resultRow())).toBe('v Rovers')
    expect(versusText(resultRow({ derby: true, homeName: 'Villagers A', awayName: 'Villagers B' }))).toBe('Villagers A v Villagers B')
  })

  it('joins our teams and names a friendly or the league', () => {
    expect(ourTeamsText({ ourTeams: [{ side: 'HOME', teamName: 'U15 A' }, { side: 'AWAY', teamName: 'U15 B' }] })).toBe('U15 A and U15 B')
    expect(competitionText({ competition: 'LEAGUE', leagueName: 'Diamond League' })).toBe('Diamond League')
    expect(competitionText({ competition: 'LEAGUE', leagueName: null })).toBe('League')
    expect(competitionText({ competition: 'FRIENDLY', leagueName: 'ignored' })).toBe('Friendly')
  })

  it('counts a form sentence and leaves out a zero lost or tied', () => {
    const rows = [resultRow({ result: 'WON' }), resultRow({ result: 'WON' }), resultRow({ result: 'LOST' }), resultRow({ result: 'TIED' })]
    expect(formSentence(rows)).toBe('2 won, 1 lost, 1 tied in the last 4')
    expect(formSentence([resultRow({ result: 'WON' })])).toBe('1 won in the last 1')
  })
})

describe('story and strip text, always naming the player', () => {
  it('tells a batting story from the figures and the result', () => {
    expect(storyLine(battingRow())).toBe('46 runs in the win, with 5 boundaries.')
    expect(storyLine(battingRow({ result: 'LOST', batting: { ...battingRow().batting, innings: [{ runs: 52, balls: 40, notOut: false, fours: 0, sixes: 0 }], runs: 52, fours: 0, sixes: 0 } }))).toBe('A fifty in a loss.')
    expect(storyLine(battingRow({ batting: { ...battingRow().batting, innings: [{ runs: 104, balls: 80, notOut: true, fours: 0, sixes: 0 }], runs: 104, fours: 1, sixes: 0 } }))).toBe('A century in the win, with 1 boundary.')
    expect(storyLine(battingRow({ batting: { ...battingRow().batting, innings: [{ runs: 12, balls: 8, notOut: true, fours: 0, sixes: 0 }], runs: 12, fours: 0, sixes: 0 } }))).toBe('Not out on 12 in the win.')
  })

  it('tells a bowling story, a wicketless spell, and a haul', () => {
    expect(storyLine(bowlingRow())).toBe('2 wickets for 21 in the win, 1 maiden.')
    expect(storyLine(bowlingRow({ bowling: { ...bowlingRow().bowling, wickets: 0, runs: 18, maidens: 0 } }))).toBe('No wicket, 18 runs conceded in the win.')
    expect(storyLine(bowlingRow({ result: 'TIED', bowling: { ...bowlingRow().bowling, wickets: 5, maidens: 0 } }))).toBe('A five-wicket haul in a tie.')
  })

  it('tells the did-not-bat and no-card stories', () => {
    expect(storyLine(noCardRow())).toBe('No scorecard was captured for this match.')
    expect(storyLine(didNotBatRow({ fielding: { status: 'RECORDED', catches: 2, stumpings: 0, runOuts: 0 } }))).toBe('2 catches in the field.')
    expect(storyLine(didNotBatRow())).toBe('Part of the team that day.')
  })

  it('writes the strip with the first name for every card', () => {
    expect(playerStripText(battingRow(), 'Aman')).toBe('Aman batted 46, off 40 balls, 4 fours, 1 six')
    expect(playerStripText(bowlingRow(), 'Aman')).toBe('Aman bowled 2/21, 4 overs')
    expect(playerStripText(didNotBatRow(), 'Aman')).toBe('Aman did not bat')
    expect(playerStripText(didNotBatRow({ fielding: { status: 'RECORDED', catches: 1, stumpings: 0, runOuts: 0 } }), 'Aman')).toBe('Aman did not bat, 1 catch')
    expect(playerStripText(noCardRow(), 'Aman')).toBe('No scorecard captured')
  })

  it('never says "you" in any story or strip', () => {
    const rows = [battingRow(), bowlingRow(), didNotBatRow(), noCardRow(), battingRow({ result: 'LOST' })]
    for (const row of rows) expect(`${storyLine(row)} ${playerStripText(row, 'Aman')}`).not.toMatch(/\byou(r)?\b/i)
  })
})

describe('scope and paths', () => {
  it('labels the scope with the season, the team only when asked, and the league', () => {
    expect(scopeLabel({ season: '2026', team: 'U15', league: 'Diamond League' }, true)).toBe('2026 · U15 · Diamond League')
    expect(scopeLabel({ season: null, team: null, league: null }, true)).toBe('All Seasons · All Teams')
    expect(scopeLabel({ season: '2026', team: 'U15' }, false)).toBe('2026')
  })

  it('builds the query from the scope and keeps only the four scope names from the address', () => {
    expect(scopeQuery({ seasonId: 's1', teamId: 't1', leagueId: 'l1', competition: 'FRIENDLY' })).toBe('season=s1&team=t1&league=l1&competition=FRIENDLY')
    expect(scopeQuery({ seasonId: null })).toBe('')
    expect(resultsQuery(new URLSearchParams('season=s1&foo=bar&team=t1'))).toBe('season=s1&team=t1')
    expect(resultsQuery(new URLSearchParams('foo=bar'))).toBeUndefined()
  })

  it('builds the result path with the scope', () => {
    expect(resultPath('k1', 'm1')).toBe('/account/players/k1/results/m1')
    expect(resultPath('k1', 'm1', 'season=s1')).toBe('/account/players/k1/results/m1?season=s1')
  })
})

describe('how a batter was out', () => {
  it.each([
    ['BOWLED', 'Smith', null, 'b Smith'],
    ['CAUGHT', 'Smith', 'Jones', 'c Jones b Smith'],
    ['CAUGHT', 'Smith', null, 'caught b Smith'],
    ['CAUGHT', null, null, 'caught'],
    ['CAUGHT_AND_BOWLED', 'Smith', null, 'c and b Smith'],
    ['LBW', 'Smith', null, 'lbw b Smith'],
    ['STUMPED', 'Smith', 'Keeper', 'st Keeper b Smith'],
    ['RUN_OUT', null, 'Jones', 'run out (Jones)'],
    ['RUN_OUT', null, null, 'run out'],
    ['HIT_WICKET', 'Smith', null, 'hit wicket b Smith'],
    ['NOT_OUT', null, null, 'not out'],
    ['TIMED_OUT', null, null, 'timed out'],
    ['BOWLED', null, null, 'bowled'],
  ] as const)('%s with bowler %s and fielder %s reads "%s"', (type, bowler, fielder, words) => {
    expect(howOutWords(type, bowler, fielder)).toBe(words)
  })

  it('reads nothing for no dismissal', () => {
    expect(howOutWords(null)).toBe('')
    expect(howOutWords(undefined)).toBe('')
  })
})
