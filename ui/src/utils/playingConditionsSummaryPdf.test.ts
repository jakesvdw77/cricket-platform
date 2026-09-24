import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlayingConditionsPayload } from '../api/leaguePlayingConditionsApi'

// jsPDF produces binary PDF output, so — per docs/standards/testing.md's guidance for a
// third-party drawing library with no existing mocking precedent in this repo — this test asserts
// on the *inputs* to jsPDF's own drawing calls (text/rect) rather than trying to parse the
// generated PDF bytes. Mirrors teamSheetPdf.test.ts's MockJsPDF shape exactly.
const textSpy = vi.fn()
const rectSpy = vi.fn()
const addPageSpy = vi.fn()

vi.mock('jspdf', () => {
  class MockJsPDF {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } }
    setFillColor = vi.fn()
    setDrawColor = vi.fn()
    setLineWidth = vi.fn()
    setTextColor = vi.fn()
    setFont = vi.fn()
    setFontSize = vi.fn()
    rect = rectSpy
    text = textSpy
    addPage = addPageSpy
    output = vi.fn(() => new Blob(['fake-pdf']))
  }
  return { jsPDF: MockJsPDF }
})

import { generatePlayingConditionsSummaryPdf } from './playingConditionsSummaryPdf'

const baseConditions: PlayingConditionsPayload = {
  maxOversPerInnings: 20,
  powerplayOvers: 6,
  maxOversPerBowler: null,
  fieldingRestrictionsNotes: 'Two fielders outside the circle.',
  pointsForWin: 2,
  pointsForLoss: 0,
  pointsForDraw: 1,
  pointsForNoResult: 1,
  pointsForForfeitWin: 2,
  bonusPointsEnabled: false,
  bonusBattingOversThreshold: null,
  bonusBowlingRestrictionPercentage: null,
  additionalNotes: 'DLS applies for rain-affected matches.',
}

describe('generatePlayingConditionsSummaryPdf', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    textSpy.mockClear()
    rectSpy.mockClear()
    addPageSpy.mockClear()
    createObjectURLSpy = vi.fn(() => 'blob:mock-url')
    vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectURLSpy })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('resolves to the stubbed URL.createObjectURL result', async () => {
    const url = await generatePlayingConditionsSummaryPdf('Riverside T20 League', '2026', baseConditions)

    expect(url).toBe('blob:mock-url')
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
  })

  it('renders the header band with the league name and season summary subtitle', async () => {
    await generatePlayingConditionsSummaryPdf('Riverside T20 League', '2026', baseConditions)

    const texts = textSpy.mock.calls.map((call) => call[0])
    expect(texts).toContain('Riverside T20 League')
    expect(texts).toContain('2026 — Playing Conditions Summary')
  })

  it('renders the Match Format and Points sections but omits the Bonus Points block when bonusPointsEnabled is false', async () => {
    await generatePlayingConditionsSummaryPdf('Riverside T20 League', '2026', baseConditions)

    const texts = textSpy.mock.calls.map((call) => call[0])
    expect(texts).toContain('Match Format')
    expect(texts).toContain('Points')
    expect(texts).not.toContain('Bonus Points')
  })

  it('renders the Bonus Points block with the right threshold values when bonusPointsEnabled is true', async () => {
    const conditions: PlayingConditionsPayload = {
      ...baseConditions,
      bonusPointsEnabled: true,
      bonusBattingOversThreshold: 17,
      bonusBowlingRestrictionPercentage: 80,
    }

    await generatePlayingConditionsSummaryPdf('Riverside T20 League', '2026', conditions)

    const texts = textSpy.mock.calls.map((call) => call[0])
    expect(texts).toContain('Bonus Points')
    expect(texts).toContain('Chase the target before over 17')
    expect(texts).toContain('Restrict them to 80% of the target (or bowl them out) before over 17')
  })

  it('never calls addPage — the summary is guaranteed to fit on a single page', async () => {
    const conditions: PlayingConditionsPayload = {
      ...baseConditions,
      bonusPointsEnabled: true,
      bonusBattingOversThreshold: 17,
      bonusBowlingRestrictionPercentage: 80,
    }

    await generatePlayingConditionsSummaryPdf('Riverside T20 League', '2026', conditions)

    expect(addPageSpy).not.toHaveBeenCalled()
  })

  it('states the explicit maxOversPerBowler value when set, not the auto-computed one', async () => {
    await generatePlayingConditionsSummaryPdf('Riverside T20 League', '2026', { ...baseConditions, maxOversPerBowler: 3 })

    const texts = textSpy.mock.calls.map((call) => call[0])
    expect(texts).toContain('3')
    expect(texts).not.toContain('4')
  })

  it('states the auto-computed ceil(overs / 5) value when maxOversPerBowler is null', async () => {
    await generatePlayingConditionsSummaryPdf('Riverside T20 League', '2026', baseConditions)

    const texts = textSpy.mock.calls.map((call) => call[0])
    expect(texts).toContain('4')
  })
})
