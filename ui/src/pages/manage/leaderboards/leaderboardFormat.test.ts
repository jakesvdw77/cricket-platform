import { describe, expect, it } from 'vitest'
import type { LeaderboardBoardInfo, LeaderboardRow } from '../../../api/leaderboardApi'
import { awardLine, cellText, figureText, matchLine, minimumLabel, rankText, sampleLine, statsLink, unrankedReason } from './leaderboardFormat'
import { resolveLeaderboardTab } from './leaderboardTabConfig'

const cell = (over: Record<string, unknown> = {}) => ({ value: null, runs: null, wickets: null, notOut: null, ...over })
const row = (over: Partial<LeaderboardRow> = {}): LeaderboardRow => ({
  rank: 1, playerId: 'p', firstName: 'A', lastName: 'B', active: true, figure: 10, matches: 1, innings: null, sample: null, smallSample: false, detail: null, ...over,
})
const board = (over: Partial<LeaderboardBoardInfo> = {}): LeaderboardBoardInfo => ({
  code: 'MOST_RUNS', group: 'BATTING', label: 'Most runs', figureLabel: 'Runs', direction: 'HIGHEST', minimumKind: 'NONE', help: '', awardEligible: true, awardDefault: true, ...over,
})

describe('figureText', () => {
  it('uses two decimals for averages and rates, one for bowling strike rate, none for counts', () => {
    expect(figureText('BATTING_AVERAGE', 29.4)).toBe('29.40')
    expect(figureText('ECONOMY_RATE', 5.8)).toBe('5.80')
    expect(figureText('BOWLING_STRIKE_RATE', 17.46)).toBe('17.5')
    expect(figureText('MOST_RUNS', 412)).toBe('412')
  })
  it('formats best bowling, highest score with a star, and null as a dash', () => {
    expect(figureText('BEST_BOWLING', { wickets: 4, runs: 17 })).toBe('4/17')
    expect(figureText('HIGHEST_SCORE', { runs: 94, notOut: true })).toBe('94*')
    expect(figureText('HIGHEST_SCORE', { runs: 94, notOut: false })).toBe('94')
    expect(figureText('MOST_RUNS', null)).toBe('–')
  })
})

describe('cellText', () => {
  it('shows a dash for a missing cell or a null value (the dots column when never recorded)', () => {
    expect(cellText('bowling', 'dots', undefined)).toBe('–')
    expect(cellText('bowling', 'dots', cell())).toBe('–')
  })
  it('formats highest score and best bowling cells', () => {
    expect(cellText('batting', 'highestScore', cell({ runs: 94, notOut: true }))).toBe('94*')
    expect(cellText('batting', 'highestScore', cell({ runs: 12, notOut: false }))).toBe('12')
    expect(cellText('batting', 'highestScore', cell())).toBe('–')
    expect(cellText('bowling', 'best', cell({ wickets: 4, runs: 17 }))).toBe('4/17')
    expect(cellText('bowling', 'best', cell())).toBe('–')
  })
  it('formats overs in cricket notation when balls are known, else the server value', () => {
    expect(cellText('bowling', 'overs', cell({ value: 36.67, balls: 220, ballsPerOver: 6 }))).toBe('36.4')
    expect(cellText('bowling', 'overs', cell({ value: 36.67, balls: 220, ballsPerOver: null }))).toBe('36.67')
  })
  it('uses two decimals for average, strikeRate and economy only', () => {
    expect(cellText('batting', 'average', cell({ value: 30 }))).toBe('30.00')
    expect(cellText('bowling', 'economy', cell({ value: 5.8 }))).toBe('5.80')
    expect(cellText('batting', 'strikeRate', cell({ value: 85.5 }))).toBe('85.50')
    expect(cellText('bowling', 'average', cell({ value: 21.4 }))).toBe('21.40')
    expect(cellText('batting', 'runs', cell({ value: 412 }))).toBe('412')
    expect(cellText('bowling', 'wickets', cell({ value: 0 }))).toBe('0')
  })
})

describe('cellText strike rate is group-aware', () => {
  it('bowling strike rate shows one decimal, batting strike rate two', () => {
    expect(cellText('bowling', 'strikeRate', cell({ value: 17.46 }))).toBe('17.5')
    expect(cellText('bowling', 'strikeRate', cell({ value: 18 }))).toBe('18.0')
    expect(cellText('Bowling', 'strikeRate', cell({ value: 18 }))).toBe('18.0')
    expect(cellText('batting', 'strikeRate', cell({ value: 17.46 }))).toBe('17.46')
    expect(cellText('bowling', 'strikeRate', cell())).toBe('–')
  })
})

describe('rank, sample, match and award lines', () => {
  it('rankText gives a dash for the unranked group', () => {
    expect(rankText(2)).toBe('2')
    expect(rankText(null)).toBe('–')
  })
  it('sampleLine: batting innings and balls, bowling overs and wickets, mixed over lengths show balls', () => {
    expect(sampleLine(row())).toBeNull()
    expect(sampleLine(row({ sample: { innings: 3, ballsFaced: 41, balls: null, overs: null, ballsPerOver: null, wickets: null } }))).toBe('3 innings, 41 balls')
    expect(sampleLine(row({ sample: { innings: 1, ballsFaced: 1, balls: null, overs: null, ballsPerOver: null, wickets: null } }))).toBe('1 innings, 1 ball')
    expect(sampleLine(row({ sample: { innings: null, ballsFaced: null, balls: 26, overs: 4.2, ballsPerOver: 6, wickets: 2 } }))).toBe('4.2 overs, 2 wickets')
    expect(sampleLine(row({ sample: { innings: null, ballsFaced: null, balls: 26, overs: null, ballsPerOver: null, wickets: 1 } }))).toBe('26 balls, 1 wicket')
  })
  it('matchLine joins opponent and date, and is null without detail', () => {
    expect(matchLine(row())).toBeNull()
    expect(matchLine(row({ detail: { matchId: 'm', matchDate: '2026-03-14T10:00:00Z', opponent: 'Riverside' } }))).toMatch(/^v Riverside, 14 Mar/)
    expect(matchLine(row({ detail: { matchId: 'm', matchDate: 'garbage', opponent: null } }))).toBeNull()
  })
  it('awardLine adds the figure label on counting boards and the sample behind a rate', () => {
    expect(awardLine(board(), row({ figure: 412, innings: 14 }))).toBe('412 runs · 14 innings')
    expect(awardLine(board({ code: 'BATTING_AVERAGE', minimumKind: 'INNINGS', figureLabel: 'Average' }), row({ figure: 41.5, sample: { innings: 6, ballsFaced: 90, balls: null, overs: null, ballsPerOver: null, wickets: null } }))).toBe('41.50 · 6 innings, 90 balls')
    expect(awardLine(board(), row({ figure: 5 }))).toBe('5 runs')
  })
})

describe('unrankedReason, minimumLabel, tabs', () => {
  it('names why a player is not ranked by the sorted column', () => {
    expect(unrankedReason('batting', 'average')).toBe('no dismissals yet')
    expect(unrankedReason('bowling', 'average')).toBe('no wickets yet')
    expect(unrankedReason('batting', 'runs')).toBe('no figure yet')
  })
  it('labels the minimum by its unit', () => {
    expect(minimumLabel('OVERS')).toBe('Minimum overs')
    expect(minimumLabel('INNINGS')).toBe('Minimum innings')
  })
  it('an unknown or missing ?tab= is Batting', () => {
    expect(resolveLeaderboardTab('awards')).toBe('awards')
    expect(resolveLeaderboardTab('fielding')).toBe('fielding')
    expect(resolveLeaderboardTab('nonsense')).toBe('batting')
    expect(resolveLeaderboardTab(null)).toBe('batting')
  })
})

describe('statsLink', () => {
  it('carries all four filters, sending an empty value for none so All seasons stays All seasons', () => {
    expect(statsLink('p-1', { seasonId: 's-1', leagueId: 'l-1', teamId: 't-1', sectionId: 'x-1' })).toBe(
      '/manage/players/p-1/stats?seasonId=s-1&leagueId=l-1&teamId=t-1&sectionId=x-1',
    )
    expect(statsLink('p-1', {})).toBe('/manage/players/p-1/stats?seasonId=&leagueId=&teamId=&sectionId=')
  })
})
