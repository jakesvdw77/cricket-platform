import { describe, expect, it } from 'vitest'
import {
  countText,
  highTotalText,
  matchLineText,
  netRunRateCard,
  netRunRateReason,
  netRunRateText,
  rateText,
  recordedCaption,
  teamBasisLines,
  teamCellText,
  teamPageBasisLines,
  teamStatsLink,
  teamUnrankedReason,
  winPercentText,
} from './teamStatsFormat'

// docs/specs/116-team-stats.md: display helpers only (2 decimals, win percentage 1 decimal, signed net run rate, "212/6").
describe('teamStatsFormat', () => {
  it('signs net run rate to 2 decimals, with no sign for zero and a dash for null', () => {
    expect(netRunRateText(0.84)).toBe('+0.84')
    expect(netRunRateText(-1.12)).toBe('-1.12')
    expect(netRunRateText(0)).toBe('0.00')
    expect(netRunRateText(0.005)).toBe('+0.01')
    expect(netRunRateText(null)).toBe('–')
    expect(netRunRateText(undefined)).toBe('–')
  })

  it('shows win percentage to 1 decimal, rates to 2 decimals, counts with thousands separators, null as a dash', () => {
    expect(winPercentText(69.23)).toBe('69.2')
    expect(winPercentText(100)).toBe('100.0')
    expect(winPercentText(0)).toBe('0.0')
    expect(winPercentText(null)).toBe('–')
    expect(rateText(5.1)).toBe('5.10')
    expect(rateText(null)).toBe('–')
    expect(countText(1842)).toBe('1,842')
    expect(countText(0)).toBe('0')
    expect(countText(null)).toBe('–')
  })

  it('writes the highest total as runs/wickets, runs alone without wickets, a dash without runs', () => {
    expect(highTotalText({ value: 212, runs: 212, wickets: 6 })).toBe('212/6')
    expect(highTotalText({ value: 212, runs: 212, wickets: null })).toBe('212')
    expect(highTotalText({ value: null, runs: null, wickets: null })).toBe('–')
    expect(highTotalText(undefined)).toBe('–')
  })

  it('formats a table cell by column code', () => {
    expect(teamCellText('runs', { value: 1842 })).toBe('1,842')
    expect(teamCellText('winPercent', { value: 50 })).toBe('50.0')
    expect(teamCellText('economy', { value: 4.8 })).toBe('4.80')
    expect(teamCellText('highTotal', { value: 90, runs: 90, wickets: 10 })).toBe('90/10')
    expect(teamCellText('netRunRate', { value: 0.84, status: 'SHOWN' })).toBe('+0.84')
    expect(teamCellText('netRunRate', { value: 0.84, status: 'NOT_ONE_COMPETITION' })).toBe('–')
    expect(teamCellText('won', undefined)).toBe('–')
    expect(teamCellText('anything', { value: 7 })).toBe('7')
  })

  it('explains a dashed net run rate and nothing else', () => {
    expect(netRunRateReason({ value: null, status: 'NOT_ONE_COMPETITION' })).toMatch(/more than one league or season/)
    expect(netRunRateReason({ value: null, status: 'NO_USABLE_RESULTS' })).toMatch(/won or tied results/)
    expect(netRunRateReason({ value: 1, status: 'SHOWN' })).toBeNull()
    expect(netRunRateReason(undefined)).toBeNull()
  })

  it('names why the unranked group is unranked by the sorted column', () => {
    expect(teamUnrankedReason('winPercent')).toBe('no decisive result yet')
    expect(teamUnrankedReason('bowlingAverage')).toBe('no wickets taken yet')
    expect(teamUnrankedReason('netRunRate')).toBe('no net run rate to show')
    expect(teamUnrankedReason('won')).toBe('no figure yet')
  })

  describe('basis lines', () => {
    const basis = { resultsCounted: 31, internalResults: 2, resultsNoBallBowled: 1, forfeits: 1, teamsListed: 5, teamsRanked: 5, belowMinimum: 0 }

    it('table: only the parts that are not zero, with singular and plural wording', () => {
      expect(teamBasisLines({ ...basis, internalResults: 0, resultsNoBallBowled: 0, forfeits: 0, resultsCounted: 1 })).toEqual(['Based on 1 published result.'])
      const lines = teamBasisLines(basis)
      expect(lines).toHaveLength(4)
      expect(lines[1]).toBe('2 internal matches are counted once for each team.')
      expect(lines[2]).toBe('1 result with no ball bowled is not counted.')
      expect(lines[3]).toMatch(/^1 forfeit is counted in P: a forfeit is a loss for the team that conceded and a win for the one that received it/)
      expect(teamBasisLines({ ...basis, internalResults: 1, resultsNoBallBowled: 2, forfeits: 3 }).slice(1, 3)).toEqual([
        '1 internal match is counted once for each team.',
        '2 results with no ball bowled are not counted.',
      ])
    })

    it('page: forfeits received and conceded are worded as wins and losses', () => {
      const page = (received: number, conceded: number) =>
        teamPageBasisLines({ resultsCounted: 4, internalResults: 0, resultsNoBallBowled: 0, forfeits: { received, conceded }, resultsWithBothInnings: 4 })
      expect(page(0, 0)).toEqual(['Based on 4 published results.'])
      expect(page(1, 0)[1]).toBe('Forfeits received 1 is counted as a win.')
      expect(page(0, 1)[1]).toBe('Forfeits conceded 1 is counted as a loss.')
      expect(page(2, 0)[1]).toBe('Forfeits received 2 are counted as wins.')
      expect(page(0, 3)[1]).toBe('Forfeits conceded 3 are counted as losses.')
      expect(page(1, 2)[1]).toBe('Forfeits received 1 and conceded 2 are counted as wins and losses.')
    })
  })

  it('builds the row link with Season and League (empty = All) and the competition only when chosen', () => {
    expect(teamStatsLink('t1', { seasonId: 's1', leagueId: 'l1' }, 'LEAGUE')).toBe('/manage/teams/t1/stats?seasonId=s1&leagueId=l1&competition=LEAGUE')
    expect(teamStatsLink('t1', { seasonId: null, leagueId: undefined }, null)).toBe('/manage/teams/t1/stats?seasonId=&leagueId=')
  })

  it('writes the match line from the opponent and date, leaving out what is missing', () => {
    expect(matchLineText({ opponentName: 'Riverside CC', matchDate: '2026-03-14T12:00:00Z' })).toBe('v Riverside CC, 14 Mar 2026')
    expect(matchLineText({ opponentName: null, matchDate: '2026-03-14T12:00:00Z' })).toBe('14 Mar 2026')
    expect(matchLineText({ opponentName: 'Riverside CC', matchDate: null })).toBe('v Riverside CC')
    expect(matchLineText({ opponentName: null, matchDate: null })).toBe('')
  })

  it('captions coverage only when some innings did not record the figure', () => {
    expect(recordedCaption(9, 14)).toBe('from 9 of 14 innings that recorded it')
    expect(recordedCaption(0, 14)).toBe('from 0 of 14 innings that recorded it')
    expect(recordedCaption(14, 14)).toBeUndefined()
    expect(recordedCaption(3, 0)).toBeUndefined()
    expect(recordedCaption(null, 14)).toBeUndefined()
    expect(recordedCaption(2, 5, 'with balls')).toBe('from 2 of 5 innings with balls')
  })

  it('writes the net run rate card for each status, without the rule name', () => {
    const base = { rule: 'FULL_QUOTA', matchesUsed: 8, matchesCounted: 11, leagueId: null, seasonId: null }
    expect(netRunRateCard({ ...base, status: 'SHOWN', value: 0.84 })).toEqual({ value: '+0.84', detail: 'Based on 8 of 11 results, one league in one season.' })
    expect(netRunRateCard({ ...base, status: 'SHOWN', value: -0.2, matchesUsed: 1, matchesCounted: 1 }).detail).toBe('Based on 1 of 1 result, one league in one season.')
    const hidden = netRunRateCard({ ...base, status: 'NOT_ONE_COMPETITION', value: null })
    expect(hidden.value).toBe('–')
    expect(hidden.detail).toMatch(/Choose one league and season/)
    expect(netRunRateCard({ ...base, status: 'NO_USABLE_RESULTS', value: null }).detail).toMatch(/won or tied results/)
    for (const status of ['SHOWN', 'NOT_ONE_COMPETITION', 'NO_USABLE_RESULTS'] as const) {
      expect(JSON.stringify(netRunRateCard({ ...base, status, value: 1 }))).not.toMatch(/full[- ]quota/i)
    }
  })
})
