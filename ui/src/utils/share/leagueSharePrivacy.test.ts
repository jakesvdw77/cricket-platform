import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// docs/specs/122-league-sharing.md (Test Plan, junior privacy): with First names as initials on, or a junior league, NO full
// given name appears in the WhatsApp text, the Facebook text, the PDF text and metadata, any canvas fillText of the Poster,
// the file names or the share title. Adult league with the setting off shows the full names, so no check passes vacuously.
// Extends sharePrivacyFixture (the league contacts carry the same distinctive given names). jsPDF and Canvas2D are mocked
// as in sharePrivacy.test.ts.
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

import { generateLeagueFacebookText } from './leagueTextFacebook'
import { generateLeagueIcsFile, generateLeagueIcsText } from './leagueIcs'
import { generateLeaguePdf } from './leaguePdf'
import { generateLeagueWhatsAppText } from './leagueTextWhatsApp'
import { generateLeagueSharePoster } from '../leagueSchedulePoster'
import { leagueShareFileName } from './shareLeagueData'
import { fold, GIVEN_NAMES, leakedGivenNames, leaguePrivacyModel } from './sharePrivacyFixture'

const colour = { main: '#2f6e4f', dark: '#234f39', contrastText: '#ffffff' }
const SHORT_FORM = /\p{L}\. \p{L}/u

// Each way a share can be junior or initials-on: the setting, and the league's age cap (the setting asked for is "full names").
const PROTECTED = [
  { label: 'initials on', model: () => leaguePrivacyModel(true) },
  { label: 'junior league, full names asked', model: () => leaguePrivacyModel(false, { maxAge: 13 }) },
  { label: 'initials on, contact opt-in', model: () => leaguePrivacyModel(true, { includeContact: true }) },
]
const OPEN = () => leaguePrivacyModel(false, { maxAge: 40 })

const expectNone = (text: string, label: string) => expect(leakedGivenNames(text), `${label} leaked`).toEqual([])
const expectSome = (text: string, label: string) => expect(leakedGivenNames(text).length, `${label} shows full names when allowed`).toBeGreaterThan(0)

describe('the league privacy fixture', () => {
  it('has contact given names found in no other league text', () => {
    const model = leaguePrivacyModel(true)
    const rest = fold([model.title, model.clubName, ...model.teams.map((t) => t.name), 'Convenor Secretary'].join(' '))
    for (const name of GIVEN_NAMES) expect(rest.includes(fold(name)), name).toBe(false)
    expect(model.league.contacts.map((c) => c.name)).toEqual(['T. Mokoena', 'N. Dlamini'])
  })
})

describe('texts', () => {
  for (const { label, model } of PROTECTED) {
    for (const template of ['SHORT', 'FULL'] as const) {
      it(`WhatsApp ${template}, ${label}`, () => {
        const text = generateLeagueWhatsAppText(model(), { template, emoji: true, resultLine: true })
        expectNone(text, 'WhatsApp')
        if (template === 'FULL') expect(text).toMatch(SHORT_FORM)
      })
    }
    for (const template of ['FULL_POST', 'BRIEF'] as const) {
      it(`Facebook ${template}, ${label}`, () => {
        const text = generateLeagueFacebookText(model(), { template, hashtags: true, resultLine: true })
        expectNone(text, 'Facebook')
        expect((text.match(/#\S+/g) ?? []).join(' ')).toBe('#PremierLeague #RiversideCC')
      })
    }
    it(`calendar and every file name, ${label}`, () => {
      expectNone(generateLeagueIcsText(model()), 'ics')
      expect(generateLeagueIcsFile(model()).name).toBe('Premier League 202627.ics')
      for (const extension of ['pdf', 'png', 'ics']) expectNone(leagueShareFileName(model(), extension), 'file name')
      expectNone(model().title, 'share title')
    })
  }

  it('shows the full names with the setting off in an adult league', () => {
    expectSome(generateLeagueWhatsAppText(OPEN(), { template: 'FULL', emoji: true, resultLine: true }), 'WhatsApp')
    expectSome(generateLeagueFacebookText(OPEN(), { template: 'FULL_POST', hashtags: true, resultLine: true }), 'Facebook')
  })
})

describe('PDF text and metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:pdf'), revokeObjectURL: vi.fn() }))
  })
  afterEach(() => vi.unstubAllGlobals())
  const options = { colour, logos: { clubUrl: null, leagueUrl: null, teams: true, sponsorUrls: [] }, clubWebsite: 'https://riverside-cc.example/', footerLine: true, resultLine: true }
  const drawn = () => textSpy.mock.calls.map((call) => String(call[0])).join('\n')

  for (const { label, model } of PROTECTED) {
    it(label, async () => {
      await generateLeaguePdf(model(), options)
      expectNone(drawn(), 'PDF text')
      expectNone(JSON.stringify(propertiesSpy.mock.calls), 'PDF metadata')
      expect(drawn()).toMatch(SHORT_FORM)
    })
  }

  it('shows the full names when allowed, and metadata carries league, season and club only', async () => {
    await generateLeaguePdf(OPEN(), options)
    expectSome(drawn(), 'PDF')
    expectNone(JSON.stringify(propertiesSpy.mock.calls), 'PDF metadata (open)')
    expect(JSON.stringify(propertiesSpy.mock.calls)).toContain('Premier League')
  })
})

describe('Poster fillText', () => {
  const texts: string[] = []
  beforeEach(() => {
    texts.length = 0
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
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback) {
      callback!(new Blob(['png']))
    })
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:poster'), revokeObjectURL: vi.fn() }))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  for (const { label, model } of PROTECTED) {
    it(`draws no full given name, ${label}`, async () => {
      await generateLeagueSharePoster(model(), colour.main, { teamLogos: false })
      expect(texts.length).toBeGreaterThan(0)
      expectNone(texts.join('\n'), 'poster')
    })
  }
})
