import { describe, expect, it } from 'vitest'
import { battingFormItems, bestBowlingText, bowlingFormItems, coverageCaption, decimals, dismissalRows, highestScoreText, notCapturedFor, oversText, percent, resultsPhrase } from './statsFormat'
import { resolvePlayerStatsTab } from './playerStatsTabConfig'

describe('statsFormat', () => {
  it('turns null into a dash and fixes decimals', () => {
    expect(decimals(null, 2)).toBe('–')
    expect(decimals(29.4, 2)).toBe('29.40')
    expect(percent(64)).toBe('64.0%')
    expect(percent(undefined)).toBe('–')
    expect(highestScoreText({ runs: 94, notOut: true })).toBe('94*')
    expect(highestScoreText(null)).toBe('–')
    expect(bestBowlingText({ wickets: 4, runs: 17 })).toBe('4/17')
    expect(bestBowlingText(null)).toBe('–')
  })

  it('shows overs, but a dash for mixed over lengths or nothing bowled', () => {
    expect(oversText(220, [6], false, 3)).toBe('36.4')
    expect(oversText(220, [5, 6], true, 3)).toBe('–')
    expect(oversText(0, [], false, 0)).toBe('–')
  })

  it('only captions coverage when part of the innings recorded the figure', () => {
    expect(coverageCaption(14, 14)).toBeUndefined()
    expect(coverageCaption(0, 0)).toBeUndefined()
    expect(coverageCaption(9, 14)).toBe('from 9 of 14 innings')
    expect(coverageCaption(9, 14, 'that recorded balls')).toBe('from 9 of 14 innings that recorded balls')
  })

  it('pluralises results', () => {
    expect(resultsPhrase(1)).toBe('1 published result')
    expect(resultsPhrase(18)).toBe('18 published results')
  })

  it('lists dismissals in scorecard order, dropping zero counts and not-out style keys', () => {
    expect(dismissalRows({ LBW: 2, CAUGHT: 5, BOWLED: 4, STUMPED: 0, NOT_OUT: 3, notRecorded: 1 }).map((r) => [r.label, r.count])).toEqual([
      ['Bowled', 4], ['Caught', 5], ['LBW', 2],
    ])
  })

  it('form chips: 50+ positive, a duck muted, a not-out nought neutral, star for not out, unrecorded runs a dash', () => {
    const items = battingFormItems([
      { matchId: 'a', matchDate: '', runs: 56, notOut: true, balls: 40 },
      { matchId: 'b', matchDate: '', runs: 0, notOut: false, balls: null },
      { matchId: 'c', matchDate: '', runs: 0, notOut: true, balls: null },
      { matchId: 'd', matchDate: '', runs: 34, notOut: false, balls: null },
      { matchId: 'e', matchDate: '', runs: null, notOut: false, balls: null },
    ])
    expect(items.map((i) => [i.label, i.tone])).toEqual([['56*', 'positive'], ['0', 'muted'], ['0*', 'neutral'], ['34', 'neutral'], ['–', 'neutral']])
    expect(items[0].ariaLabel).toBe('56 not out off 40 balls')
    expect(items[4].ariaLabel).toBe('Runs not recorded')
  })

  it('bowling chips: wickets/runs, 2 or more wickets positive', () => {
    const items = bowlingFormItems([
      { matchId: 'a', matchDate: '', wickets: 2, runs: 21, balls: 24, ballsPerOver: 6 },
      { matchId: 'b', matchDate: '', wickets: 1, runs: 18, balls: 24, ballsPerOver: 6 },
    ])
    expect(items.map((i) => [i.label, i.tone])).toEqual([['2/21', 'positive'], ['1/18', 'neutral']])
  })

  it('splits Not captured yet items by their own tab', () => {
    const items = [
      { code: 'A', tab: 'BATTING' as const, label: 'A', reason: '' },
      { code: 'B', tab: 'BOWLING' as const, label: 'B', reason: '' },
    ]
    expect(notCapturedFor(items, 'batting').map((i) => i.code)).toEqual(['A'])
    expect(notCapturedFor(items, 'fielding')).toEqual([])
  })

  it('an unknown ?tab= value is Batting; awards is a real tab', () => {
    expect(resolvePlayerStatsTab('awards')).toBe('awards')
    expect(resolvePlayerStatsTab('bowling')).toBe('bowling')
    expect(resolvePlayerStatsTab('x')).toBe('batting')
    expect(resolvePlayerStatsTab(null)).toBe('batting')
  })
})
