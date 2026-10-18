import { describe, expect, it } from 'vitest'
import { CELEBRATION_WORDING, generateResultFacebookText } from './resultTextFacebook'
import type { FacebookResultOptions, FacebookResultTemplate } from './resultTextFacebook'
import { generateResultWhatsAppText } from './resultTextWhatsApp'
import type { WhatsAppResultTemplate } from './resultTextWhatsApp'
import { hashtagOf, joinNames, stripEmoji } from './resultTextShared'
import type { ShareBattingRow, ShareBowlingRow, ShareInnings, ShareResultModel } from './shareResultData'

// docs/specs/114-share-result.md (Test Plan): every template with every switch combination, the Celebration wording
// thresholds per outcome, and the win, loss, tie and no-result fallbacks. Pure builders, so the model is built by hand.

const EMOJI = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]/u
const batter = (patch: Partial<ShareBattingRow> = {}): ShareBattingRow => ({
  name: 'M. Naidoo',
  runs: 60,
  balls: 40,
  fours: 6,
  sixes: 1,
  strikeRate: 150,
  howOut: 'c P. Botha b T. Mokoena',
  didNotBat: false,
  notOut: false,
  ...patch,
})
const bowler = (patch: Partial<ShareBowlingRow> = {}): ShareBowlingRow => ({
  name: 'S. Khumalo',
  overs: '4.0',
  balls: 24,
  maidens: 1,
  runs: 20,
  wickets: 3,
  economy: 5,
  ...patch,
})
const innings = (side: 'HOME' | 'AWAY', batting: ShareBattingRow[], bowling: ShareBowlingRow[]): ShareInnings => ({
  battingSide: side,
  battingTeam: side === 'HOME' ? 'Riverside 1' : 'Pretoria CC',
  bowlingTeam: side === 'HOME' ? 'Pretoria CC' : 'Riverside 1',
  battingOurs: side === 'HOME',
  scoreText: side === 'HOME' ? '150/6 (40.0)' : '126/10 (38.2)',
  batting,
  extras: { total: 8, text: 'Extras 8 (w 8)' },
  bowling,
  topBatters: batting.filter((row) => !row.didNotBat),
  topBowlers: bowling,
})

function makeModel(patch: Partial<ShareResultModel> = {}): ShareResultModel {
  return {
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
    dateLabel: 'Saturday 17 October 2026',
    innings: [
      innings('HOME', [batter(), batter({ name: 'A. Dube', runs: 0, balls: null, didNotBat: true, howOut: '' })], [bowler({ name: 'T. Mokoena', wickets: 1 })]),
      innings('AWAY', [batter({ name: 'P. Botha', runs: 22, balls: 31, notOut: true })], [bowler()]),
    ],
    playerOfTheMatch: { name: 'M. Naidoo', ours: true },
    hasScorecard: true,
    teams: 'both',
    teamsChoiceDisabledReason: null,
    initialsOnly: true,
    initialsCollisions: [],
    ...patch,
  }
}

// The shapes a builder can be handed: both teams, Our team only (the opposition's rows are gone), summary only, no award.
const oursOnly = (): ShareResultModel => {
  const base = makeModel()
  return {
    ...base,
    teams: 'ours',
    innings: [{ ...base.innings[0], bowling: [], topBowlers: [] }, { ...base.innings[1], batting: [], topBatters: [], extras: null }],
    playerOfTheMatch: null,
  }
}
const SHAPES: [string, ShareResultModel][] = [
  ['both teams', makeModel()],
  ['our team only', oursOnly()],
  ['summary only', makeModel({ innings: [], playerOfTheMatch: null, hasScorecard: false })],
  ['no player of the match', makeModel({ playerOfTheMatch: null })],
]

const WA_TEMPLATES: WhatsAppResultTemplate[] = ['SHORT', 'PERFORMERS', 'SCORECARD']
const FB_TEMPLATES: FacebookResultTemplate[] = ['REPORT', 'CELEBRATION', 'BRIEF']
const SPONSORS = [[], ['Acme'], ['Acme', 'Bolt', 'Crest']]

const looksBroken = (text: string): boolean => /undefined|null|NaN|\[object/.test(text) || /\n{3,}/.test(text) || /^\s|\s$/.test(text)

describe('WhatsApp builder, every template and switch', () => {
  for (const [shape, model] of SHAPES) {
    for (const template of WA_TEMPLATES) {
      for (const emoji of [true, false]) {
        it(`${template}, emoji ${emoji ? 'on' : 'off'}, ${shape}: well formed, header and result line present`, () => {
          const text = generateResultWhatsAppText(model, { template, emoji })
          expect(looksBroken(text)).toBe(false)
          expect(text).toContain(`*${model.home.name} v ${model.away.name}*`)
          expect(text).toContain(`*${model.resultLine}*`)
          expect(text).toContain(`${model.home.name}: ${model.home.scoreText}`)
          expect(text).toContain(`${model.away.name}: ${model.away.scoreText}`)
          expect(EMOJI.test(text)).toBe(emoji)
        })
      }
    }
  }

  it('SHORT never lists performers, the scorecard or the player of the match', () => {
    const text = generateResultWhatsAppText(makeModel(), { template: 'SHORT', emoji: true })
    expect(text).not.toMatch(/Bat |Ball |Player of the match|Extras|Did not bat/)
  })

  it('PERFORMERS lists the best bat and ball of each side and the player of the match when there is one', () => {
    const text = generateResultWhatsAppText(makeModel(), { template: 'PERFORMERS', emoji: true })
    expect(text).toContain('*Riverside 1*\nBat M. Naidoo 60 (40) | Ball S. Khumalo 3/20 (4.0)')
    expect(text).toContain('*Pretoria CC*\nBat P. Botha 22* (31) | Ball T. Mokoena 1/20 (4.0)')
    expect(text).toContain('⭐ Player of the match: *M. Naidoo*')
    expect(generateResultWhatsAppText(makeModel({ playerOfTheMatch: null }), { template: 'PERFORMERS', emoji: true })).not.toContain('Player of the match')
  })

  it('PERFORMERS under Our team only lists only our performers and none of theirs', () => {
    const text = generateResultWhatsAppText(oursOnly(), { template: 'PERFORMERS', emoji: true })
    expect(text).toContain('*Riverside 1*')
    expect(text).toContain('Ball S. Khumalo 3/20 (4.0)')
    expect(text).not.toContain('P. Botha')
    expect(text).not.toContain('T. Mokoena')
    expect(text).not.toContain('Player of the match')
  })

  it('PERFORMERS on a summary-only result is the short text', () => {
    const summary = makeModel({ innings: [], playerOfTheMatch: null, hasScorecard: false })
    expect(generateResultWhatsAppText(summary, { template: 'PERFORMERS', emoji: true })).toBe(generateResultWhatsAppText(summary, { template: 'SHORT', emoji: true }))
  })

  it('SCORECARD writes the toss, each innings with figures, did-not-bat, extras, bowling and the player of the match', () => {
    const text = generateResultWhatsAppText(makeModel(), { template: 'SCORECARD', emoji: false })
    expect(text).toContain('_Riverside 1 won the toss and chose to bat_')
    expect(text).toContain('*Riverside 1 150/6 (40.0)*')
    expect(text).toContain('M. Naidoo 60 (40) c P. Botha b T. Mokoena')
    expect(text).toContain('P. Botha 22* (31)')
    expect(text).not.toContain('P. Botha 22* (31) c ')
    expect(text).toContain('_Did not bat: A. Dube_')
    expect(text).toContain('Extras 8 (w 8)')
    expect(text).toContain('_Bowling for Pretoria CC (O-M-R-W)_')
    expect(text).toContain('S. Khumalo 4.0-1-20-3')
    expect(text).toContain('Player of the match: *M. Naidoo*')
  })

  it('SCORECARD leaves out the toss when none is recorded', () => {
    expect(generateResultWhatsAppText(makeModel({ toss: null }), { template: 'SCORECARD', emoji: true })).not.toContain('won the toss')
  })

  it('leaves out the date and venue line when neither is known', () => {
    const text = generateResultWhatsAppText(makeModel({ venue: null, dateLabel: '' }), { template: 'SHORT', emoji: true })
    expect(text.split('\n')[1]).toMatch(/^🏆/)
    expect(generateResultWhatsAppText(makeModel(), { template: 'SHORT', emoji: true })).toContain('Saturday 17 October 2026 · Main Oval')
  })

  it('omits a score line for a side with no score entered', () => {
    const text = generateResultWhatsAppText(makeModel({ away: { ...makeModel().away, scoreText: '' } }), { template: 'SHORT', emoji: true })
    expect(text).not.toContain('Pretoria CC:')
  })

  it('removes every emoji code point, selector and joiner, and tidies the spaces they leave', () => {
    const text = generateResultWhatsAppText(makeModel(), { template: 'SCORECARD', emoji: false })
    expect(EMOJI.test(text)).toBe(false)
    expect(text).not.toMatch(/\u200d|\ufe0f|\u20e3/)
    expect(text).not.toMatch(/ {2,}/)
    expect(text).not.toMatch(/^ /m)
    expect(stripEmoji('🏏 *Hi*  there 👨‍👩‍👧 ⭐️ 🇿🇦')).toBe('*Hi* there')
  })

  it('keeps the same words with the emoji on and off, only the emoji differ', () => {
    for (const template of WA_TEMPLATES) {
      const on = generateResultWhatsAppText(makeModel(), { template, emoji: true })
      const off = generateResultWhatsAppText(makeModel(), { template, emoji: false })
      expect(on.replace(/[^\p{L}\p{N}]/gu, '').replace(/[🏏🏆⭐]/gu, '')).toBe(off.replace(/[^\p{L}\p{N}]/gu, ''))
    }
  })
})

describe('Facebook builder, every template and switch', () => {
  for (const [shape, model] of SHAPES) {
    for (const template of FB_TEMPLATES) {
      for (const hashtags of [true, false]) {
        for (const sponsorNames of SPONSORS) {
          it(`${template}, hashtags ${hashtags}, ${sponsorNames.length} sponsors, ${shape}: well formed with no emoji and no bold`, () => {
            const text = generateResultFacebookText(model, { template, hashtags, sponsorNames })
            expect(looksBroken(text)).toBe(false)
            expect(EMOJI.test(text)).toBe(false)
            // A not-out marker ("22*") is not bold; bold is a star opening a word.
            expect(text).not.toMatch(/(^|\s)\*\S/)
            expect(text).toContain(model.resultLine)
            expect(text.includes('#CricketLegend')).toBe(hashtags)
            expect(/sponsor/i.test(text)).toBe(sponsorNames.length > 0)
            expect(text).not.toContain('..')
          })
        }
      }
    }
  }

  const options = (patch: Partial<FacebookResultOptions> = {}): FacebookResultOptions => ({ template: 'REPORT', hashtags: true, sponsorNames: [], ...patch })

  it('writes the sponsor mention for one, two and three sponsors', () => {
    expect(generateResultFacebookText(makeModel(), options({ sponsorNames: ['Acme'] }))).toContain('Thanks to our sponsor, Acme.')
    expect(generateResultFacebookText(makeModel(), options({ sponsorNames: ['Acme', 'Bolt'] }))).toContain('Thanks to our sponsors, Acme and Bolt.')
    expect(generateResultFacebookText(makeModel(), options({ sponsorNames: ['Acme', 'Bolt', 'Crest'] }))).toContain('Thanks to our sponsors, Acme, Bolt and Crest.')
    expect(joinNames([])).toBe('')
  })

  it('writes hashtags from the club and league names only, never from a player', () => {
    const text = generateResultFacebookText(makeModel(), options())
    const tags = text.match(/#\S+/g) ?? []
    expect(tags).toEqual(['#RiversideCC', '#GautengPremierLeague', '#CricketLegend'])
    for (const name of ['Naidoo', 'Botha', 'Mokoena', 'Khumalo', 'Dube']) expect(tags.join(' ')).not.toContain(name)
  })

  it('drops a hashtag whose source is missing and strips punctuation and spaces from the rest', () => {
    expect(generateResultFacebookText(makeModel({ clubName: null, leagueName: null }), options()).match(/#\S+/g)).toEqual(['#CricketLegend'])
    expect(generateResultFacebookText(makeModel({ clubName: "St. Mary's CC", leagueName: '  ' }), options()).match(/#\S+/g)).toEqual(['#StMarysCC', '#CricketLegend'])
    expect(hashtagOf('Zoë Café Ünited')).toBe('#ZoëCaféÜnited')
    expect(hashtagOf('---')).toBeNull()
    expect(hashtagOf(undefined)).toBeNull()
  })

  it('writes the Match report in parts: line, scores with the toss and place, performers, player of the match', () => {
    const text = generateResultFacebookText(makeModel(), options({ hashtags: false }))
    const parts = text.split('\n\n')
    expect(parts[0]).toBe('Riverside 1 v Pretoria CC: Riverside 1 won by 24 runs.')
    expect(parts[1]).toBe('Riverside 1 posted 150/6 (40.0) and Pretoria CC replied with 126/10 (38.2). Riverside 1 won the toss and chose to bat. Played at Main Oval on Saturday 17 October 2026.')
    expect(parts[2]).toContain('For Riverside 1, M. Naidoo top scored with 60 (40) and')
    expect(parts[3]).toBe('Player of the match: M. Naidoo.')
  })

  it('writes the Brief as one paragraph with the scores in brackets and the player of the match', () => {
    const text = generateResultFacebookText(makeModel(), options({ template: 'BRIEF', hashtags: false }))
    expect(text).toBe('Riverside 1 v Pretoria CC: Riverside 1 won by 24 runs (Riverside 1 150/6 (40.0), Pretoria CC 126/10 (38.2)). Player of the match: M. Naidoo.')
  })

  it('does not double the full stop after a one-word shortened name ("S.")', () => {
    const text = generateResultFacebookText(makeModel({ playerOfTheMatch: { name: 'S.', ours: true } }), options({ template: 'BRIEF', hashtags: false }))
    expect(text).toContain('Player of the match: S.')
    expect(text).not.toContain('S..')
    for (const template of FB_TEMPLATES) {
      expect(generateResultFacebookText(makeModel({ playerOfTheMatch: { name: 'S.', ours: true } }), options({ template })).includes('..')).toBe(false)
    }
  })

  it('leaves out the toss, venue and date when unknown, and says nothing of performers with no scorecard', () => {
    const text = generateResultFacebookText(makeModel({ toss: null, venue: null, dateLabel: '', innings: [], playerOfTheMatch: null }), options({ hashtags: false }))
    expect(text).not.toMatch(/toss|Played|For Riverside/)
  })
})

describe('Celebration wording per outcome', () => {
  const celebrate = (model: ShareResultModel) => generateResultFacebookText(model, { template: 'CELEBRATION', hashtags: false, sponsorNames: [] })

  it('celebrates a win for our side, home or away, naming the winner', () => {
    expect(celebrate(makeModel())).toContain('Congratulations to Riverside 1!')
    const away = makeModel({
      perspective: 'won',
      winningSide: 'AWAY',
      away: { side: 'AWAY', name: 'Riverside 2', logoUrl: null, ours: true, scoreText: '160/4 (35.0)' },
      home: { side: 'HOME', name: 'Pretoria CC', logoUrl: null, ours: false, scoreText: '150/6 (40.0)' },
      resultLine: 'Riverside 2 won by 6 wickets',
      marginType: 'WICKETS',
      marginValue: 6,
    })
    expect(celebrate(away)).toContain('Congratulations to Riverside 2!')
  })

  it('never celebrates a loss, a tie, a no result, a draw-like neutral outcome or a win with no winner', () => {
    const outcomes: Partial<ShareResultModel>[] = [
      { perspective: 'lost', resultLine: 'Pretoria CC won by 3 runs', winningSide: 'AWAY' },
      { perspective: 'neutral', resultLine: 'Match tied', winningSide: null },
      { perspective: 'neutral', resultLine: 'No result', winningSide: null },
      { perspective: 'neutral', resultLine: 'Match abandoned', winningSide: null },
      { perspective: 'won', winningSide: null },
    ]
    for (const patch of outcomes) {
      const text = celebrate(makeModel(patch))
      expect(text).not.toMatch(/Congratulations|outstanding|magnificent|fine half-century|superb|fine spell|comfortable|commanding|close win|What a/)
      expect(text).toContain(`Result: ${makeModel(patch).resultLine}.`)
      expect(text).toContain('Thank you to everyone who came out to support the teams.')
    }
  })

  it('keeps the neutral text honest: scores and performers only from the data, nothing invented', () => {
    const text = celebrate(makeModel({ perspective: 'lost', resultLine: 'Pretoria CC won by 3 runs' }))
    expect(text).toContain('Riverside 1 posted 150/6 (40.0)')
    expect(text).toContain('For Riverside 1, M. Naidoo top scored with 60 (40)')
  })

  describe('thresholds', () => {
    const withBat = (patch: Partial<ShareBattingRow>) => {
      const base = makeModel()
      return makeModel({ innings: [{ ...base.innings[0], topBatters: [batter(patch)] }, base.innings[1]] })
    }
    const withBall = (patch: Partial<ShareBowlingRow>) => {
      const base = makeModel()
      return makeModel({ innings: [base.innings[0], { ...base.innings[1], topBowlers: [bowler(patch)] }] })
    }

    it('describes a strike rate from the table, and only after the minimum balls', () => {
      const [outstanding, veryGood, good] = CELEBRATION_WORDING.strikeRate
      expect(celebrate(withBat({ runs: 40, balls: 20, strikeRate: outstanding.min }))).toContain(`${outstanding.words} of ${outstanding.min}`)
      expect(celebrate(withBat({ runs: 24, balls: 20, strikeRate: veryGood.min }))).toContain(`${veryGood.words} of ${veryGood.min}`)
      expect(celebrate(withBat({ runs: 18, balls: 20, strikeRate: good.min }))).toContain(`${good.words} of ${good.min}`)
      expect(celebrate(withBat({ runs: 17, balls: 20, strikeRate: good.min - 1 }))).not.toContain('strike rate')
      // Just under each boundary falls to the next row.
      expect(celebrate(withBat({ runs: 20, balls: 20, strikeRate: outstanding.min - 1 }))).toContain(veryGood.words)
      expect(celebrate(withBat({ runs: 20, balls: 20, strikeRate: veryGood.min - 1 }))).toContain(good.words)
      // 200 off 9 balls is not described: too few balls to say anything.
      expect(celebrate(withBat({ runs: 18, balls: CELEBRATION_WORDING.minBallsForStrikeRate - 1, strikeRate: 200 }))).not.toContain('strike rate')
      expect(celebrate(withBat({ runs: 20, balls: CELEBRATION_WORDING.minBallsForStrikeRate, strikeRate: 200 }))).toContain('strike rate')
      expect(celebrate(withBat({ strikeRate: null }))).not.toContain('strike rate')
    })

    it('describes a batting score: century, half-century, or nothing below fifty', () => {
      expect(celebrate(withBat({ runs: 100, balls: 80, strikeRate: 125 }))).toContain('a magnificent century')
      expect(celebrate(withBat({ runs: 99, balls: 80, strikeRate: 124 }))).toContain('a fine half-century')
      expect(celebrate(withBat({ runs: 50, balls: 60, strikeRate: 83 }))).toContain('a fine half-century')
      const small = celebrate(withBat({ runs: 49, balls: 60, strikeRate: 81 }))
      expect(small).not.toMatch(/half-century|century/)
      expect(small).toContain('M. Naidoo top scored with 49 (60).')
    })

    it('describes bowling figures: five-for, a fine spell from three, nothing below', () => {
      expect(celebrate(withBall({ wickets: 5 }))).toContain('a superb five-wicket haul')
      expect(celebrate(withBall({ wickets: 6 }))).toContain('a superb five-wicket haul')
      expect(celebrate(withBall({ wickets: 4 }))).toContain('a fine spell')
      expect(celebrate(withBall({ wickets: 3 }))).toContain('a fine spell')
      const two = celebrate(withBall({ wickets: 2 }))
      expect(two).not.toMatch(/fine spell|haul/)
      expect(two).toContain('S. Khumalo took 2/20 (4.0).')
      expect(celebrate(withBall({ wickets: 0 }))).not.toContain('S. Khumalo took')
    })

    it('describes a win by runs by its margin', () => {
      const win = (marginValue: number) => celebrate(makeModel({ marginType: 'RUNS', marginValue, resultLine: `Riverside 1 won by ${marginValue} runs` }))
      expect(win(100)).toContain('a commanding win')
      expect(win(150)).toContain('a commanding win')
      expect(win(99)).toContain('a comfortable win')
      expect(win(50)).toContain('a comfortable win')
      expect(win(49)).toMatch(/won by 49 runs\.\n?/)
      expect(win(49)).not.toMatch(/commanding|comfortable|close/)
      expect(win(CELEBRATION_WORDING.closeWinByRuns + 1)).not.toContain('close win')
      expect(win(CELEBRATION_WORDING.closeWinByRuns)).toContain('a close win')
      expect(win(1)).toContain('a close win')
    })

    it('describes a win by wickets by the wickets in hand and says how many overs were to spare', () => {
      const win = (marginValue: number, oversRemaining: string | null = null) =>
        celebrate(makeModel({ marginType: 'WICKETS', marginValue, resultLine: `Riverside 1 won by ${marginValue} wickets`, oversRemaining }))
      expect(win(7)).toContain('a comfortable win')
      expect(win(10)).toContain('a comfortable win')
      expect(win(6)).not.toMatch(/comfortable|close/)
      expect(win(CELEBRATION_WORDING.closeWinByWickets)).toContain('a close win')
      expect(win(1)).toContain('a close win')
      expect(win(3)).not.toContain('close win')
      expect(win(5, '4.2')).toContain('Riverside 1 won by 5 wickets with 4.2 overs to spare')
      expect(win(5)).not.toContain('to spare')
    })

    it('adds no margin wording when the margin type is unknown', () => {
      const text = celebrate(makeModel({ marginType: null, marginValue: null, resultLine: 'Riverside 1 won' }))
      expect(text).toContain('Congratulations to Riverside 1! Riverside 1 won.')
    })

    it('thanks the supporters and names the player of the match last but for the tags', () => {
      const text = generateResultFacebookText(makeModel(), { template: 'CELEBRATION', hashtags: true, sponsorNames: ['Acme'] })
      const parts = text.split('\n\n')
      expect(parts[parts.length - 1].startsWith('#RiversideCC')).toBe(true)
      expect(parts[parts.length - 2]).toBe('Thanks to our sponsor, Acme.')
      expect(parts[parts.length - 3]).toBe('Thank you to everyone who came out to support the team.')
      expect(parts[parts.length - 4]).toBe('Player of the match: M. Naidoo.')
    })
  })
})
