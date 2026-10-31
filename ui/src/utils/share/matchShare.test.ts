import { describe, expect, it } from 'vitest'
import { buildFunFacts, verdictOf } from './matchFunFacts'
import type { FactResultRow } from './matchFunFacts'
import { contentGap, countdownWording, effectiveLayout, matchFormatAvailability, sideGap } from './matchShareFormats'
import { generateMatchFacebookText, generateMatchWhatsAppText } from './matchText'
import { DEFAULT_SHARE_CHOICES, mergeShareChoices, sanitiseShareChoices } from './shareChoices'
import { buildMatchShareModel, matchShareFileName, sideRoles } from './shareMatchData'
import { FULL_FIRST_NAMES, fixtureModel, fixtureMatch, fixtureSide } from './matchShareFixture'
import { drawMatchImage, DEFAULT_PICTURE_SETTINGS, matchPalette, pictureCrop } from './matchImage'
import { contrastRatio } from './resultImage'
import type { MatchContent } from './matchShareFormats'

const ALL_CONTENTS: MatchContent[] = ['TEAM_SELECTION', 'COUNTDOWN', 'FUN_FACTS', 'FIXTURE', 'TEAM_SHEET']
const row = (dateIso: string, teamSide: 'HOME' | 'AWAY', winningSide: 'HOME' | 'AWAY' | null, outcomeType = 'WON'): FactResultRow => ({ dateIso, teamSide, outcomeType, winningSide })

describe('matchShareFormats', () => {
  const ready = { hasOurXi: true, hasOppositionXi: true, past: false }
  it('gates contents that need an XI and countdown for a past match', () => {
    const none = { hasOurXi: false, hasOppositionXi: false, past: false }
    expect(contentGap('TEAM_SELECTION', none)).toBe('Select the team first')
    expect(contentGap('TEAM_SHEET', none)).toBe('Select the team first')
    expect(contentGap('FIXTURE', none)).toBeNull()
    expect(contentGap('COUNTDOWN', none)).toBeNull()
    expect(contentGap('FUN_FACTS', none)).toBeNull()
    expect(contentGap('COUNTDOWN', { ...ready, past: true })).toMatch(/played/)
    expect(sideGap('OURS', none)).toBeNull()
    expect(sideGap('BOTH', none)).toMatch(/opposition/)
    expect(sideGap('BOTH', ready)).toBeNull()
  })

  it('offers, greys and hides formats', () => {
    expect(matchFormatAvailability('FIXTURE', undefined).offered).toEqual(['PDF', 'IMAGE', 'TV', 'WHATSAPP', 'FACEBOOK'])
    const sheet = matchFormatAvailability('TEAM_SHEET', undefined)
    expect(sheet.offered).toEqual(['PDF', 'WHATSAPP', 'FACEBOOK'])
    expect(sheet.greyed.map((item) => item.format)).toEqual(['IMAGE', 'TV'])
    expect(sheet.greyed[0].reason).toBe('Team Sheet offers PDF, WhatsApp and Facebook only')
    expect(matchFormatAvailability('FUN_FACTS', undefined).greyed.map((item) => item.format)).toEqual(['TV'])
    const club = matchFormatAvailability('TEAM_SELECTION', { MATCH: ['TV'], RESULT: ['PDF'] })
    expect(club.hidden).toEqual(['TV'])
    expect(club.offered).not.toContain('TV')
    expect(club.offered).toContain('PDF')
  })

  it('words the countdown', () => {
    expect(countdownWording(3, false)).toBe('3 days to go')
    expect(countdownWording(1, false)).toBe('Tomorrow')
    expect(countdownWording(0, false)).toBe('Today')
    expect(countdownWording(0, true)).toBe('Match day')
    expect(countdownWording(-1, true)).toBeNull()
  })

  it('falls back to Separate where side by side does not fit', () => {
    expect(effectiveLayout('SIDE_BY_SIDE', 'PORTRAIT', false)).toEqual({ layout: 'SIDE_BY_SIDE', fellBack: false })
    expect(effectiveLayout('SIDE_BY_SIDE', 'SQUARE', false)).toEqual({ layout: 'SEPARATE', fellBack: true })
    expect(effectiveLayout('SIDE_BY_SIDE', 'STORY', false).fellBack).toBe(true)
    expect(effectiveLayout('SIDE_BY_SIDE', 'STORY', true).fellBack).toBe(false)
    expect(effectiveLayout('SEPARATE', 'SQUARE', false).fellBack).toBe(false)
  })
})

describe('shareMatchData', () => {
  it('builds our side, the opposition or both', () => {
    expect(fixtureModel({ side: 'OURS' }).lineups.map((l) => l.teamName)).toEqual(['Irene Villagers U15'])
    expect(fixtureModel({ side: 'OPPOSITION' }).lineups.map((l) => l.teamName)).toEqual(['Pretoria A'])
    expect(fixtureModel({ side: 'BOTH' }).lineups.map((l) => l.teamName)).toEqual(['Irene Villagers U15', 'Pretoria A'])
    const ours = fixtureModel({ side: 'OURS' }).lineups[0]
    expect(ours.own).toBe(true)
    expect(ours.players[0]).toMatchObject({ order: 1, captain: true })
    expect(ours.players[4].keeper).toBe(true)
  })

  it('has no lineup content before a team is selected and none for contents without a lineup', () => {
    const none = fixtureModel({ sides: [fixtureSide('t-home', 'Irene Villagers U15', 0, false), fixtureSide('t-away', 'Pretoria A', 5, false)], side: 'OURS' })
    expect(none.lineups[0].players).toEqual([])
    expect(fixtureModel({ content: 'FIXTURE' }).lineups).toEqual([])
    expect(fixtureModel({ content: 'COUNTDOWN' }).lineups).toEqual([])
  })

  it('treats the home side as ours in a derby', () => {
    expect(sideRoles(['home', 'away'])).toEqual({ ours: 'home', opposition: 'away' })
    expect(sideRoles(['away'])).toEqual({ ours: 'away', opposition: 'home' })
    expect(sideRoles([])).toEqual({ ours: null, opposition: null })
    const derby = fixtureModel({ ownKeys: ['home', 'away'], side: 'OPPOSITION' })
    expect(derby.lineups.map((l) => l.teamName)).toEqual(['Pretoria A'])
  })

  it('words the date, countdown and past matches', () => {
    const model = fixtureModel()
    expect(model.dateIso).toBe('2026-11-06')
    expect(model.timeLabel).toBe('09:15')
    expect(model.whenLabel).toMatch(/Fri 6 Nov 09:15/)
    expect(model.countdown).toBe('3 days to go')
    const past = buildMatchShareModel({ ...{ content: 'FIXTURE' as const, match: fixtureMatch(), sides: [fixtureSide('a', 'A'), fixtureSide('b', 'B')] as never, logos: { home: null, away: null }, ownKeys: ['home' as const], side: 'OURS' as const, layout: 'SEPARATE' as const, initialsOnly: false, leagueName: null, seasonLabel: null, clubName: null, weather: null, facts: [] }, now: new Date(2026, 10, 10) })
    expect(past.countdown).toBeNull()
  })

  it('names files with team names only', () => {
    expect(matchShareFileName(fixtureModel(), 'png')).toBe('Irene Villagers U15 v Pretoria A 2026-11-06.png')
    expect(matchShareFileName(fixtureModel(), 'png', 'Pretoria A')).toBe('Irene Villagers U15 v Pretoria A 2026-11-06 Pretoria A.png')
  })
})

describe('privacy: initials on shows no full given name anywhere', () => {
  const collect = (): string[] => {
    const out: string[] = []
    for (const content of ALL_CONTENTS) {
      const model = fixtureModel({ content, side: 'BOTH', initialsOnly: true })
      out.push(JSON.stringify(model))
      out.push(matchShareFileName(model, 'pdf'), model.title)
      for (const template of ['SHORT', 'WITH_FACTS'] as const) {
        for (const emoji of [true, false]) out.push(generateMatchWhatsAppText(model, template, { emoji, weather: true }))
      }
      for (const template of ['ANNOUNCEMENT', 'COUNTDOWN', 'BRIEF'] as const) out.push(generateMatchFacebookText(model, template, { emoji: false, weather: true, hashtags: true, mentionSponsor: null }))
      const drawn: string[] = []
      drawMatchImage(recordingContext(drawn), model, imageOptions())
      out.push(...drawn)
    }
    return out
  }

  it('is not vacuous: the full form does show full names, and initials form is shortened', () => {
    const full = fixtureModel({ initialsOnly: false })
    expect(JSON.stringify(full)).toContain(FULL_FIRST_NAMES[0])
    const short = fixtureModel({ initialsOnly: true })
    expect(short.lineups[0].players[0].name).toBe('A. Botha')
    expect(short.lineups[0].players[9].name).toBe('N. van Wyk')
  })

  it('never carries a full given name in text, model, file names or canvas text', () => {
    const joined = collect().join('\n')
    for (const first of FULL_FIRST_NAMES) expect(joined).not.toContain(first)
    expect(joined).toContain('A. Botha')
  })

  it('hashtags carry no player name', () => {
    const text = generateMatchFacebookText(fixtureModel({ initialsOnly: true }), 'ANNOUNCEMENT', { emoji: true, weather: false, hashtags: true })
    const tags = text.split('\n').filter((line) => line.startsWith('#'))
    expect(tags.join(' ')).toContain('#IreneVillagersU15')
    expect(tags.join(' ')).not.toMatch(/Botha|Naidoo/)
  })
})

describe('text builders', () => {
  it('writes the countdown and fixture, with the forecast only when on', () => {
    const countdown = fixtureModel({ content: 'COUNTDOWN' })
    const on = generateMatchWhatsAppText(countdown, 'SHORT', { emoji: true, weather: true })
    expect(on).toContain('3 days to go')
    expect(on).toContain('Forecast: Sunny, 14 to 27 degrees, 20% rain')
    expect(on).toContain('Hofmeyer Park')
    const off = generateMatchWhatsAppText(countdown, 'SHORT', { emoji: true, weather: false })
    expect(off).not.toContain('Forecast')
    expect(generateMatchFacebookText(countdown, 'BRIEF', { emoji: true, weather: false })).not.toContain('Forecast')
    expect(generateMatchFacebookText(countdown, 'BRIEF', { emoji: true, weather: true })).toContain('Forecast')
  })

  it('lists the XI with C and WK and drops emoji when off', () => {
    const model = fixtureModel({ content: 'TEAM_SHEET', side: 'OURS' })
    const withEmoji = generateMatchWhatsAppText(model, 'SHORT', { emoji: true, weather: false })
    expect(withEmoji).toContain('🏏')
    expect(withEmoji).toContain('1. A. Botha (C)')
    expect(withEmoji).toContain('5. L. Pretorius (WK)')
    const plain = generateMatchWhatsAppText(model, 'SHORT', { emoji: false, weather: false })
    expect(plain).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(plain).toContain('1. A. Botha (C)')
  })

  it('adds facts, hashtags and the sponsor line by template and switch', () => {
    const model = fixtureModel({ content: 'FIXTURE' })
    expect(generateMatchWhatsAppText(model, 'SHORT', { emoji: false, weather: false })).not.toContain('won 4')
    expect(generateMatchWhatsAppText(model, 'WITH_FACTS', { emoji: false, weather: false })).toContain('won 4 of their last 5')
    const post = generateMatchFacebookText(model, 'ANNOUNCEMENT', { emoji: false, weather: false, hashtags: true, mentionSponsor: 'Acme Ltd' })
    expect(post).toContain('Proudly sponsored by Acme Ltd')
    expect(post).toContain('#cricket')
    expect(generateMatchFacebookText(model, 'ANNOUNCEMENT', { emoji: false, weather: false, hashtags: false })).not.toContain('#')
    expect(generateMatchFacebookText(fixtureModel({ content: 'COUNTDOWN' }), 'COUNTDOWN', { emoji: false, weather: false })).toMatch(/^3 days to go!/)
  })
})

describe('matchFunFacts', () => {
  const base = { ourName: 'Villagers', oppositionName: 'Pretoria A', ours: [] as FactResultRow[], opposition: [] as FactResultRow[], headToHead: [] as FactResultRow[] }
  it('states form with its basis and hides it with too little data', () => {
    const ours = [row('2026-10-30', 'HOME', 'HOME'), row('2026-10-23', 'AWAY', 'AWAY'), row('2026-10-16', 'HOME', 'AWAY'), row('2026-10-09', 'HOME', 'HOME'), row('2026-10-02', 'HOME', 'HOME'), row('2026-09-25', 'HOME', 'AWAY')]
    const facts = buildFunFacts({ ...base, ours })
    expect(facts).toHaveLength(1)
    expect(facts[0]).toMatchObject({ id: 'OUR_FORM', text: 'Villagers have won 4 of their last 5', basis: 'Form, last 5 published results' })
    expect(buildFunFacts({ ...base, ours: ours.slice(0, 2) })).toEqual([])
    expect(buildFunFacts({ ...base, ours: [] })).toEqual([])
  })

  it('skips matches without a result', () => {
    expect(verdictOf(row('d', 'HOME', null, 'ABANDONED'))).toBeNull()
    expect(verdictOf(row('d', 'HOME', null, 'TIE'))).toBe('T')
    const ours = [row('a', 'HOME', null, 'ABANDONED'), row('b', 'HOME', 'HOME'), row('c', 'HOME', 'HOME'), row('d', 'HOME', 'AWAY')]
    expect(buildFunFacts({ ...base, ours })[0].text).toBe('Villagers have won 2 of their last 3')
  })

  it('words head to head and the last meeting, needing three meetings', () => {
    const even = [row('2026-10-30', 'HOME', 'HOME'), row('2026-08-01', 'HOME', 'AWAY'), row('2026-06-01', 'HOME', 'HOME'), row('2026-04-01', 'HOME', 'AWAY')]
    const facts = buildFunFacts({ ...base, headToHead: even })
    expect(facts.find((f) => f.id === 'HEAD_TO_HEAD')?.text).toBe('Head to head: 2 wins each from 4')
    expect(facts.find((f) => f.id === 'LAST_MEETING')?.text).toBe('Villagers won the last meeting, 30 October 2026')
    const lead = buildFunFacts({ ...base, headToHead: [row('a', 'HOME', 'HOME'), row('b', 'HOME', 'HOME'), row('c', 'HOME', 'AWAY')] })
    expect(lead.find((f) => f.id === 'HEAD_TO_HEAD')?.text).toBe('Villagers lead the head to head 2 to 1 from 3')
    expect(buildFunFacts({ ...base, headToHead: even.slice(0, 2) })).toEqual([])
  })

  it('includes the opposition form only with its own data', () => {
    const opposition = [row('a', 'AWAY', 'AWAY'), row('b', 'HOME', 'AWAY'), row('c', 'HOME', 'HOME')]
    expect(buildFunFacts({ ...base, ours: [], opposition })[0]).toMatchObject({ id: 'OPPOSITION_FORM', text: 'Pretoria A have won 2 of their last 3' })
  })
})

describe('picture and palettes', () => {
  it('crops without stretching and clamps the position and zoom', () => {
    const wide = pictureCrop(2000, 1000, 400, 400, { x: 0.5, y: 0.5, zoom: 1 })
    expect(wide).toEqual({ x: 500, y: 0, width: 1000, height: 1000 })
    const zoomed = pictureCrop(2000, 1000, 400, 400, { x: 0, y: 0, zoom: 2 })
    expect(zoomed).toEqual({ x: 0, y: 0, width: 500, height: 500 })
    const tooFar = pictureCrop(2000, 1000, 400, 400, { x: 9, y: -3, zoom: 99 })
    expect(tooFar.width).toBeCloseTo(1000 / 3)
    expect(tooFar.x + tooFar.width).toBeCloseTo(2000)
    expect(tooFar.y).toBe(0)
    expect(wide.width / wide.height).toBeCloseTo(400 / 400)
    expect(pictureCrop(0, 0, 100, 100, DEFAULT_PICTURE_SETTINGS)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })

  it('keeps body text at 4.5:1 on its panel for every template, including a light club colour', () => {
    const colours = [
      { main: 'rgb(20, 99, 63)', dark: 'rgb(15, 81, 50)', contrastText: 'rgb(255, 255, 255)' },
      { main: 'rgb(255, 235, 59)', dark: 'rgb(200, 180, 0)', contrastText: 'rgb(0, 0, 0)' },
    ]
    for (const colour of colours) {
      for (const template of ['CLUB_GREEN', 'NIGHT', 'DAYLIGHT', 'BROADCAST', 'CLUB', 'LIGHT'] as const) {
        const palette = matchPalette(template, colour)
        expect(contrastRatio(palette.panelText, palette.panel)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(palette.chipText, palette.chip)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(palette.cardText, palette.card)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

describe('shareChoices match branch', () => {
  it('defaults and sanitises', () => {
    expect(DEFAULT_SHARE_CHOICES.match.side).toBe('OURS')
    const clean = sanitiseShareChoices({ match: { content: 'NOPE', side: 'BOTH', layout: 'SEPARATE', imageSize: 'STORY', templates: { facebook: 'BRIEF', pdf: 'X' }, include: { weather: false, emoji: 'x' } } })
    expect(clean.match).toMatchObject({ content: null, side: 'BOTH', layout: 'SEPARATE', imageSize: 'STORY' })
    expect(clean.match.templates).toMatchObject({ facebook: 'BRIEF', pdf: 'CLUB' })
    expect(clean.match.include).toMatchObject({ weather: false, emoji: true })
    expect(sanitiseShareChoices(null).match).toEqual(DEFAULT_SHARE_CHOICES.match)
  })

  it('merges a patch key by key and never stores a picture', () => {
    const merged = mergeShareChoices(DEFAULT_SHARE_CHOICES, { match: { content: 'FIXTURE', include: { weather: false } } })
    expect(merged.match.content).toBe('FIXTURE')
    expect(merged.match.include).toMatchObject({ weather: false, marks: true })
    expect(JSON.stringify(merged)).not.toMatch(/picture"?:\s*\{|blob:|data:image/)
  })
})

// A recording stand-in for a canvas 2D context: collects every string drawn with fillText.
function recordingContext(drawn: string[]): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined }
  const target: Record<string, unknown> = {
    createLinearGradient: () => gradient,
    measureText: (value: string) => ({ width: value.length * 8 }),
    fillText: (value: string) => void drawn.push(value),
  }
  return new Proxy(target, {
    get: (object, key: string) => (key in object ? object[key] : () => undefined),
    set: (object, key: string, value) => {
      object[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

function imageOptions() {
  return {
    format: 'IMAGE' as const,
    size: 'PORTRAIT' as const,
    template: 'CLUB_GREEN' as const,
    colour: { main: 'rgb(20, 99, 63)', dark: 'rgb(15, 81, 50)', contrastText: 'rgb(255, 255, 255)' },
    include: { marks: true, venueAndDate: true, weather: true, picture: true },
    logos: { clubUrl: null, leagueUrl: null, teams: true, sponsorUrls: [] },
    images: new Map(),
    footerLine: true,
    picture: null,
    pictureSettings: DEFAULT_PICTURE_SETTINGS,
  }
}
