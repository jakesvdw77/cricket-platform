import { describe, expect, it } from 'vitest'
import { playerStatsFigures } from './statsFigures'
import type { PlayerStats } from '../../../api/playerStatsApi'

// docs/specs/141: ONE figure row above the tabs, following the tab; the basis sentence is the first card's info
const stats = {
  basis: { matchesCounted: 4, resultsWithBattingCard: 3, resultsWithBowlingCard: 0 },
  batting: { runs: 120, average: 40, strikeRate: 95.5, highestScore: { runs: 61, notOut: true } },
  bowling: { wickets: 0, average: null, economy: null, best: null },
  fielding: { catches: 2, stumpings: 1, runOuts: 0, dismissalsPerMatch: 0.75 },
  awards: { playerOfTheMatch: 1, teamPlayerOfTheMatch: 2 },
  record: { won: 3, lost: 1 },
} as unknown as PlayerStats

const labels = (tab: Parameters<typeof playerStatsFigures>[1]) => playerStatsFigures(stats, tab, 'basis').map((item) => item.label)

describe('playerStatsFigures', () => {
  it('shows the headline four on Overview and Matches', () => {
    expect(labels('dashboard')).toEqual(['Matches', 'Runs', 'Wickets', 'Catches'])
    expect(labels('matches')).toEqual(['Matches', 'Runs', 'Wickets', 'Catches'])
  })

  it('follows the tab, four cards each', () => {
    expect(labels('batting')).toEqual(['Runs', 'Batting Average', 'Strike Rate', 'Highest Score'])
    expect(labels('fielding')).toEqual(['Catches', 'Stumpings', 'Run-Outs', 'Dismissals Per Match'])
    expect(labels('awards')).toEqual(['Player Of The Match', 'Team Player Of The Match', 'Won', 'Lost'])
  })

  it('shows Matches alone when no bowling card was captured', () => {
    expect(labels('bowling')).toEqual(['Matches'])
  })

  it('puts the basis sentence on the first card only', () => {
    const items = playerStatsFigures(stats, 'batting', 'basis')
    expect(items[0].info).toBe('basis')
    expect(items.slice(1).every((item) => !item.info)).toBe(true)
  })
})
