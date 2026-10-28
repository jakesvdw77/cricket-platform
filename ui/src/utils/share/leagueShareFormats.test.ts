import { describe, expect, it } from 'vitest'
import { offeredFormats } from './enabledFormats'
import {
  availability,
  LEAGUE_CONTENTS,
  LEAGUE_SHARE_FORMATS,
  leftOutNote,
  orderedContents,
  supportedContents,
  supports,
  unsupportedReason,
} from './leagueShareFormats'
import type { LeagueContent, LeagueShareFormat } from './leagueShareFormats'

// docs/specs/122-league-sharing.md (Step 2): the content-by-format table, written out independently of the source so a
// change to either side fails here.
const TABLE: Record<LeagueContent, LeagueShareFormat[]> = {
  DETAILS: ['PDF', 'WHATSAPP', 'FACEBOOK'],
  CONDITIONS: ['PDF', 'WHATSAPP', 'FACEBOOK'],
  TEAMS: ['PDF', 'POSTER', 'WHATSAPP', 'FACEBOOK'],
  SCHEDULE: ['PDF', 'POSTER', 'CALENDAR', 'WHATSAPP', 'FACEBOOK'],
  RESULTS: ['PDF', 'WHATSAPP', 'FACEBOOK'],
  KEY_DATES: ['PDF', 'POSTER', 'CALENDAR', 'WHATSAPP', 'FACEBOOK'],
}

describe('supports', () => {
  for (const content of LEAGUE_CONTENTS) {
    for (const format of LEAGUE_SHARE_FORMATS) {
      it(`${content} x ${format}`, () => {
        expect(supports(content, format)).toBe(TABLE[content].includes(format))
      })
    }
  }
})

describe('orderedContents, supportedContents', () => {
  it('puts ticked contents in the standard order and drops repeats and unknown codes', () => {
    expect(orderedContents(['RESULTS', 'DETAILS', 'DETAILS', 'NOPE'])).toEqual(['DETAILS', 'RESULTS'])
    expect(supportedContents('CALENDAR', ['TEAMS', 'KEY_DATES', 'DETAILS', 'SCHEDULE'])).toEqual(['SCHEDULE', 'KEY_DATES'])
  })
})

describe('availability', () => {
  it('offers a format when at least one ticked content supports it, even if another does not', () => {
    const result = availability(['DETAILS', 'SCHEDULE'], undefined)
    expect(result.offered).toEqual(['PDF', 'POSTER', 'CALENDAR', 'WHATSAPP', 'FACEBOOK'])
    expect(result.greyed).toEqual([])
    expect(result.hidden).toEqual([])
  })

  it('greys a format only when no ticked content supports it, with the reason naming what to tick', () => {
    const result = availability(['DETAILS', 'RESULTS'], undefined)
    expect(result.offered).toEqual(['PDF', 'WHATSAPP', 'FACEBOOK'])
    expect(result.greyed.map((g) => g.format)).toEqual(['POSTER', 'CALENDAR'])
    expect(result.greyed.find((g) => g.format === 'POSTER')?.reason).toBe('Needs Teams, Schedule or Key dates ticked')
    expect(result.greyed.find((g) => g.format === 'CALENDAR')?.reason).toBe('Needs Schedule or Key dates ticked')
  })

  it('greys every format when nothing is ticked', () => {
    const result = availability([], undefined)
    expect(result.offered).toEqual([])
    expect(result.greyed).toHaveLength(5)
  })

  it('hides a format the club switched off, whether or not it is supported', () => {
    const result = availability(['SCHEDULE'], { LEAGUE: ['CALENDAR', 'PDF'] })
    expect(result.hidden).toEqual(['PDF', 'CALENDAR'])
    expect(result.offered).toEqual(['POSTER', 'WHATSAPP', 'FACEBOOK'])
    const hiddenUnsupported = availability(['DETAILS'], { LEAGUE: ['CALENDAR'] })
    expect(hiddenUnsupported.greyed.map((g) => g.format)).toEqual(['POSTER'])
    expect(hiddenUnsupported.hidden).toEqual(['CALENDAR'])
  })

  it('ignores the result content type settings', () => {
    expect(availability(['SCHEDULE'], { RESULT: ['PDF'] }).hidden).toEqual([])
  })

  it('has nothing left when the club switched every league format off', () => {
    const result = availability(['SCHEDULE'], { LEAGUE: [...LEAGUE_SHARE_FORMATS] })
    expect(result.offered).toEqual([])
    expect(result.greyed).toEqual([])
    expect(result.hidden).toHaveLength(5)
  })

  it('every non-empty tick set offers exactly the union of the formats its contents support', () => {
    for (const a of LEAGUE_CONTENTS) {
      for (const b of LEAGUE_CONTENTS) {
        const union = LEAGUE_SHARE_FORMATS.filter((f) => TABLE[a].includes(f) || TABLE[b].includes(f))
        expect(availability([a, b], undefined).offered, `${a}+${b}`).toEqual(union)
      }
    }
  })
})

describe('notes and reasons', () => {
  it('writes the left-out note per format and none when everything is carried', () => {
    expect(leftOutNote('CALENDAR', ['DETAILS', 'SCHEDULE'])).toBe('League details is not included in a calendar.')
    expect(leftOutNote('POSTER', ['DETAILS', 'RESULTS', 'TEAMS'])).toBe('League details and Results are not included in a poster.')
    expect(leftOutNote('PDF', LEAGUE_CONTENTS)).toBeNull()
  })

  it('has no reason for a supported format', () => {
    expect(unsupportedReason('PDF', ['RESULTS'])).toBeNull()
  })
})

describe('enabledFormats', () => {
  it('returns every code for a content type in the standard order when nothing is disabled', () => {
    expect(offeredFormats('LEAGUE', undefined)).toEqual(['PDF', 'POSTER', 'CALENDAR', 'WHATSAPP', 'FACEBOOK'])
    expect(offeredFormats('RESULT', {})).toEqual(['PDF', 'IMAGE', 'TV', 'WHATSAPP', 'FACEBOOK'])
  })

  it('removes only the disabled codes of the asked content type', () => {
    const disabled = { LEAGUE: ['POSTER'], RESULT: ['TV', 'IMAGE'] }
    expect(offeredFormats('LEAGUE', disabled)).toEqual(['PDF', 'CALENDAR', 'WHATSAPP', 'FACEBOOK'])
    expect(offeredFormats('RESULT', disabled)).toEqual(['PDF', 'WHATSAPP', 'FACEBOOK'])
  })
})
