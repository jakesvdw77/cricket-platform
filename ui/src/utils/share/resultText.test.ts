import { describe, expect, it } from 'vitest'
import { generateResultFacebookText } from './resultTextFacebook'
import { generateResultWhatsAppText } from './resultTextWhatsApp'
import type { ShareBattingRow, ShareBowlingRow, ShareInnings, ShareResultModel } from './shareResultData'

const bat: ShareBattingRow = { name: 'M. N.', runs: 60, balls: 40, fours: 6, sixes: 1, strikeRate: 150, howOut: 'c P. B. b T. M.', didNotBat: false, notOut: false }
const ball: ShareBowlingRow = { name: 'S. W.', overs: '4.0', balls: 24, maidens: 1, runs: 20, wickets: 3, economy: 5 }
const innings = (side: 'HOME' | 'AWAY', own: string, opp: string, score: string): ShareInnings => ({
  battingSide: side,
  battingTeam: own,
  bowlingTeam: opp,
  battingOurs: side === 'HOME',
  scoreText: score,
  batting: [bat],
  extras: { total: 8, text: 'Extras 8 (w 8)' },
  bowling: [ball],
  topBatters: [bat],
  topBowlers: [ball],
})

const model: ShareResultModel = {
  clubName: 'Riverside CC',
  leagueName: 'Gauteng Premier League',
  home: { side: 'HOME', name: 'Riverside 1', logoUrl: null, ours: true, scoreText: '150/6 (40.0)' },
  away: { side: 'AWAY', name: 'Pretoria CC', logoUrl: null, ours: false, scoreText: '126/10 (38.2)' },
  resultLine: 'Riverside 1 won by 24 runs',
  perspective: 'won',
  winningSide: 'HOME',
  marginType: 'RUNS',
  marginValue: 24,
  oversRemaining: null,
  battingFirst: 'HOME',
  toss: 'Riverside 1 won the toss and chose to bat',
  venue: 'Main Oval',
  dateIso: '2026-10-17',
  dateLabel: 'Saturday, 17 October 2026',
  innings: [innings('HOME', 'Riverside 1', 'Pretoria CC', '150/6 (40.0)'), innings('AWAY', 'Pretoria CC', 'Riverside 1', '126/10 (38.2)')],
  playerOfTheMatch: { name: 'M. N.', ours: true },
  hasScorecard: true,
  teams: 'both',
  teamsChoiceDisabledReason: null,
  initialsOnly: true,
  initialsCollisions: [],
}

const EMOJI = /\p{Extended_Pictographic}/u

describe('generateResultWhatsAppText', () => {
  it('writes the three templates with bold and no emoji when the switch is off', () => {
    const short = generateResultWhatsAppText(model, { template: 'SHORT', emoji: true })
    expect(short).toContain('🏏 *Riverside 1 v Pretoria CC*')
    expect(short).toContain('Pretoria CC: 126/10 (38.2)')
    expect(short).not.toContain('Bat M. N.')
    expect(generateResultWhatsAppText(model, { template: 'PERFORMERS', emoji: true })).toContain('Bat M. N. 60 (40) | Ball S. W. 3/20 (4.0)')
    expect(generateResultWhatsAppText(model, { template: 'SCORECARD', emoji: true })).toContain('S. W. 4.0-1-20-3')
    for (const template of ['SHORT', 'PERFORMERS', 'SCORECARD'] as const) {
      const plain = generateResultWhatsAppText(model, { template, emoji: false })
      expect(EMOJI.test(plain)).toBe(false)
      expect(plain.startsWith('*Riverside 1 v Pretoria CC*')).toBe(true)
    }
  })
})

describe('generateResultFacebookText', () => {
  const options = { hashtags: true, sponsorNames: [] as string[] }

  it('writes hashtags without a name and the sponsor mention only when chosen', () => {
    const text = generateResultFacebookText(model, { ...options, template: 'REPORT', sponsorNames: ['Acme', 'Bolt'] })
    expect(text).toContain('#RiversideCC #GautengPremierLeague #CricketLegend')
    expect(text).toContain('Thanks to our sponsors, Acme and Bolt.')
    expect(generateResultFacebookText(model, { ...options, template: 'REPORT', hashtags: false })).not.toContain('#')
    expect(generateResultFacebookText(model, { ...options, template: 'REPORT' })).not.toContain('sponsor')
  })

  it('celebrates a win with descriptive wording from the thresholds', () => {
    const text = generateResultFacebookText(model, { ...options, template: 'CELEBRATION' })
    expect(text).toContain('Congratulations to Riverside 1!')
    expect(text).toContain('an outstanding strike rate of 150')
    expect(text).toContain('Player of the match: M. N.\n')
    expect(text).toContain('a fine spell')
  })

  it('falls back to neutral wording for a loss, a tie and no result', () => {
    for (const patch of [
      { perspective: 'lost' as const, resultLine: 'Pretoria CC won by 3 runs' },
      { perspective: 'neutral' as const, resultLine: 'Match tied' },
      { perspective: 'neutral' as const, resultLine: 'No result' },
    ]) {
      const text = generateResultFacebookText({ ...model, ...patch }, { ...options, template: 'CELEBRATION' })
      expect(text).toContain(`Result: ${patch.resultLine}.`)
      expect(text).not.toMatch(/Congratulations|outstanding|fine spell/)
    }
  })

  it('writes the brief as one paragraph and a report without the scorecard missing', () => {
    expect(generateResultFacebookText(model, { ...options, hashtags: false, template: 'BRIEF' }).split('\n\n')).toHaveLength(1)
    const summaryOnly = { ...model, innings: [], playerOfTheMatch: null, hasScorecard: false }
    expect(generateResultFacebookText(summaryOnly, { ...options, template: 'REPORT' })).toContain('Riverside 1 posted 150/6 (40.0)')
  })
})
