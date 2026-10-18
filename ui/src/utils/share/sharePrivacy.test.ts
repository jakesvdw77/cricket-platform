import { beforeEach, describe, expect, it, vi } from 'vitest'

// docs/specs/114-share-result.md (Test Plan, "Privacy test (required)"): with First names as initials on, NO full given name
// appears anywhere a share can carry one: the WhatsApp text, the Facebook text, the PDF text and metadata, every fillText of
// the Image and TV summary, the file names and the share title. The same fixture with the setting off shows the full names,
// so none of these checks can pass vacuously. Names are matched case-insensitively and accent-folded.
//
// jsPDF and Canvas2D are mocked in the manner of resultPdf.test.ts and resultImage.test.ts.
const textSpy = vi.fn()
const propertiesSpy = vi.fn()

vi.mock('jspdf', () => {
  class MockJsPDF {
    setFillColor = vi.fn()
    setDrawColor = vi.fn()
    setLineWidth = vi.fn()
    setTextColor = vi.fn()
    setFont = vi.fn()
    setFontSize = vi.fn()
    setProperties = propertiesSpy
    rect = vi.fn()
    roundedRect = vi.fn()
    line = vi.fn()
    text = textSpy
    addImage = vi.fn()
    addPage = vi.fn()
    getTextWidth = (value: string) => value.length * 1.6
    output = vi.fn(() => new Blob(['fake-pdf']))
  }
  return { jsPDF: MockJsPDF }
})

import { generateResultFacebookText } from './resultTextFacebook'
import type { FacebookResultTemplate } from './resultTextFacebook'
import { drawResultImage } from './resultImage'
import type { ResultImageOptions } from './resultImage'
import { generateResultPdf } from './resultPdf'
import type { ResultPdfOptions } from './resultPdf'
import { generateResultWhatsAppText } from './resultTextWhatsApp'
import type { WhatsAppResultTemplate } from './resultTextWhatsApp'
import { shareFileName } from './shareFileName'
import { fold, GIVEN_NAMES, leakedGivenNames, PRIVACY_SCENARIOS, privacyModel } from './sharePrivacyFixture'
import type { TeamsChoice } from './shareResultData'

const SCOPES: TeamsChoice[] = ['both', 'ours']
const WA_TEMPLATES: WhatsAppResultTemplate[] = ['SHORT', 'PERFORMERS', 'SCORECARD']
const FB_TEMPLATES: FacebookResultTemplate[] = ['REPORT', 'CELEBRATION', 'BRIEF']
const PDF_TEMPLATES = ['CLUB', 'CLASSIC', 'COMPACT'] as const
const IMAGE_TEMPLATES = ['CLUB_GREEN', 'NIGHT', 'DAYLIGHT'] as const
const IMAGE_SIZES = ['SQUARE', 'PORTRAIT', 'STORY'] as const
const TV_TEMPLATES = ['BROADCAST', 'CLUB', 'LIGHT'] as const
const colour = { main: '#2f6e4f', dark: '#234f39', contrastText: '#ffffff' }

// The shortened form an initials-on text shows ("M. Naidoo": one letter, a full stop, a surname).
const SHORT_FORM = /\p{L}\. \p{L}/u

function expectNoGivenNames(text: string, label: string): void {
  expect(leakedGivenNames(text), `${label} leaked a full given name`).toEqual([])
}
// With the setting off the same fixture must show full names, so the check above cannot pass vacuously.
function expectFullNames(text: string, label: string): void {
  expect(leakedGivenNames(text).length, `${label} shows no full name with the setting off`).toBeGreaterThan(0)
}

describe('the privacy fixture itself', () => {
  it('has distinctive given names that are in no other text, so a match means a leak', () => {
    const model = privacyModel(false)
    const rest = fold(
      [model.home.name, model.away.name, model.clubName, model.leagueName, model.venue, model.toss, model.dateLabel, 'Acme Foods', 'Thank you to everyone who came out to support the team']
        .filter(Boolean)
        .join(' '),
    )
    for (const name of GIVEN_NAMES) expect(rest.includes(fold(name)), name).toBe(false)
  })

  it('folds accents and case, and does not flag the shortened forms', () => {
    expect(leakedGivenNames('EMILE and ZOE and mpho')).toEqual(['Mpho', 'Émile', 'Zoë'])
    expect(leakedGivenNames('É. Öztürk, Z. Müller, M. Naidoo')).toEqual([])
  })
})

describe('WhatsApp text', () => {
  for (const scenario of PRIVACY_SCENARIOS) {
    for (const teams of SCOPES) {
      for (const template of WA_TEMPLATES) {
        for (const emoji of [true, false]) {
          it(`${template}, emoji ${emoji}, ${teams}, ${scenario.name}`, () => {
            const on = generateResultWhatsAppText(privacyModel(true, { teamsChoice: teams, scenario }), { template, emoji })
            const off = generateResultWhatsAppText(privacyModel(false, { teamsChoice: teams, scenario }), { template, emoji })
            expectNoGivenNames(on, `WhatsApp ${template}`)
            if (template === 'SHORT') {
              // The short text names nobody at all, with the setting on or off.
              expectNoGivenNames(off, 'WhatsApp SHORT')
              return
            }
            expectFullNames(off, `WhatsApp ${template}`)
            expect(on).toMatch(SHORT_FORM)
          })
        }
      }
    }
  }

  it('shows the dismissal text in the shortened form on the Scorecard text', () => {
    const on = generateResultWhatsAppText(privacyModel(true), { template: 'SCORECARD', emoji: false })
    expect(fold(on)).toContain('c p. botha b t. mokoena')
    expect(fold(on)).toContain('st j. van zyl b t. mokoena')
    expect(fold(on)).toContain('run out (m. naidoo)')
    expect(fold(on)).toContain('s. van der westhuizen')
    const off = generateResultWhatsAppText(privacyModel(false), { template: 'SCORECARD', emoji: false })
    expect(fold(off)).toContain('c pieter botha b thabo mokoena')
    expect(fold(off)).toContain('mpho naidoo')
  })
})

describe('Facebook text', () => {
  for (const scenario of PRIVACY_SCENARIOS) {
    for (const teams of SCOPES) {
      for (const template of FB_TEMPLATES) {
        it(`${template}, ${teams}, ${scenario.name}, with hashtags and a sponsor`, () => {
          const options = { template, hashtags: true, sponsorNames: ['Acme Foods'] }
          const model = privacyModel(true, { teamsChoice: teams, scenario })
          const on = generateResultFacebookText(model, options)
          const off = generateResultFacebookText(privacyModel(false, { teamsChoice: teams, scenario }), options)
          expectNoGivenNames(on, `Facebook ${template}`)
          // The Brief names only the player of the match, who is dropped under Our team only when he is the opposition's.
          if (template !== 'BRIEF' || model.playerOfTheMatch) {
            expectFullNames(off, `Facebook ${template}`)
            expect(on).toMatch(SHORT_FORM)
          } else {
            expectNoGivenNames(off, 'Facebook BRIEF without a player of the match')
          }
          // Hashtags carry the club and league only, never a person, with the setting either way.
          for (const text of [on, off]) {
            const tags = (text.match(/#\S+/g) ?? []).join(' ')
            expect(tags).toBe('#RiversideCC #PremierLeague #CricketLegend')
          }
        })
      }
    }
  }

  it('keeps the Celebration prose (strike rate, bowling figures, player of the match) in the shortened form', () => {
    const on = generateResultFacebookText(privacyModel(true), { template: 'CELEBRATION', hashtags: false, sponsorNames: [] })
    expect(on).toContain('Congratulations to Riverside 1!')
    expect(fold(on)).toContain('m. naidoo top scored with 60')
    expect(fold(on)).toContain('player of the match: m. naidoo.')
    expectNoGivenNames(on, 'Facebook Celebration')
  })
})

describe('PDF text and metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:pdf'), revokeObjectURL: vi.fn() }))
  })

  const options = (template: (typeof PDF_TEMPLATES)[number]): ResultPdfOptions => ({
    template,
    colour,
    include: { batting: true, bowling: true, extras: true, toss: true, playerOfTheMatch: true },
    logos: { clubUrl: null, leagueUrl: null, teams: true, sponsorUrls: [] },
    clubWebsite: 'https://riverside-cc.example/',
    footerLine: true,
  })
  const drawn = (): string => textSpy.mock.calls.map((call) => String(call[0])).join('\n')
  const metadata = (): string => JSON.stringify(propertiesSpy.mock.calls)

  for (const scenario of PRIVACY_SCENARIOS) {
    for (const teams of SCOPES) {
      for (const template of PDF_TEMPLATES) {
        it(`${template}, ${teams}, ${scenario.name}`, async () => {
          await generateResultPdf(privacyModel(true, { teamsChoice: teams, scenario }), options(template))
          const on = drawn()
          const onMetadata = metadata()
          expectNoGivenNames(on, `PDF ${template} text`)
          expectNoGivenNames(onMetadata, `PDF ${template} metadata`)
          expect(on).toMatch(SHORT_FORM)

          vi.clearAllMocks()
          await generateResultPdf(privacyModel(false, { teamsChoice: teams, scenario }), options(template))
          expectFullNames(drawn(), `PDF ${template} text`)
          // The metadata never carries a player in either mode: team names only.
          expectNoGivenNames(metadata(), `PDF ${template} metadata (off)`)
          expect(metadata()).toContain('Riverside 1 v Pretoria CC')
        })
      }
    }
  }
})

// A Canvas2D that records every fillText, with a narrow measureText so a name is never shortened by the fit-to-width loop.
function recordingContext(): { ctx: CanvasRenderingContext2D; texts: string[] } {
  const texts: string[] = []
  const ctx = {
    fillRect: vi.fn(),
    fillText: (text: string) => texts.push(String(text)),
    drawImage: vi.fn(),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    measureText: (text: string) => ({ width: text.length * 6 }),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  } as unknown as CanvasRenderingContext2D
  return { ctx, texts }
}

const imageOptions = (patch: Partial<ResultImageOptions>): ResultImageOptions => ({
  format: 'IMAGE',
  template: 'CLUB_GREEN',
  colour,
  topPerformers: true,
  playerOfTheMatch: true,
  venueAndDate: true,
  batters: true,
  bowlers: true,
  performers: 3,
  logos: { clubUrl: null, leagueUrl: null, teams: true, sponsorUrls: [] },
  images: new Map(),
  clubWebsite: 'https://riverside-cc.example',
  footerLine: true,
  ...patch,
})

describe('Image and TV summary fillText', () => {
  const variants: { label: string; options: ResultImageOptions }[] = [
    ...IMAGE_TEMPLATES.flatMap((template) =>
      IMAGE_SIZES.map((size) => ({ label: `Image ${template} ${size}`, options: imageOptions({ format: 'IMAGE', template, size }) })),
    ),
    ...TV_TEMPLATES.flatMap((template) => [2, 3].map((performers) => ({ label: `TV ${template} top ${performers}`, options: imageOptions({ format: 'TV', template, performers: performers as 2 | 3 }) }))),
  ]

  for (const scenario of PRIVACY_SCENARIOS) {
    it(`no full given name is drawn, and the full names are drawn with the setting off (${scenario.name})`, () => {
      for (const { label, options } of variants) {
        // The cards always show both teams (cardModel): they never offer Our team only.
        const on = recordingContext()
        drawResultImage(on.ctx, privacyModel(true, { scenario }), options)
        expectNoGivenNames(on.texts.join('\n'), label)
        expect(on.texts.join('\n'), label).toMatch(SHORT_FORM)

        const off = recordingContext()
        drawResultImage(off.ctx, privacyModel(false, { scenario }), options)
        expectFullNames(off.texts.join('\n'), label)
      }
    })
  }

  it('shows the player of the match in the shortened form and draws no name when the performers are switched off', () => {
    const on = recordingContext()
    drawResultImage(on.ctx, privacyModel(true), imageOptions({ format: 'IMAGE', size: 'SQUARE', topPerformers: false }))
    expect(fold(on.texts.join('\n'))).toContain('m. naidoo')
    expectNoGivenNames(on.texts.join('\n'), 'Image POTM only')

    const none = recordingContext()
    drawResultImage(none.ctx, privacyModel(false), imageOptions({ format: 'IMAGE', size: 'SQUARE', topPerformers: false, playerOfTheMatch: false }))
    expectNoGivenNames(none.texts.join('\n'), 'Image without names')
  })
})

describe('file names and share titles', () => {
  it('name the teams and the date only, never a player, with the setting on or off', () => {
    for (const scenario of PRIVACY_SCENARIOS) {
      for (const initialsOnly of [true, false]) {
        const model = privacyModel(initialsOnly, { scenario })
        for (const extension of ['pdf', 'png']) {
          const name = shareFileName(model, extension)
          expect(name).toBe(`Riverside 1 v Pretoria CC 2026-10-17.${extension}`)
          expectNoGivenNames(name, 'file name')
          for (const surname of ['naidoo', 'mokoena', 'botha']) expect(fold(name)).not.toContain(surname)
        }
        // The share sheet title is "<home> v <away>" (ShareResultDialog); a model never carries a player in it.
        const title = `${model.home.name} v ${model.away.name}`
        expectNoGivenNames(title, 'share title')
      }
    }
  })
})
