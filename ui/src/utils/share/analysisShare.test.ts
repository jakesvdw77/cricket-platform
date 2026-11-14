import { describe, expect, it } from 'vitest'
import { analyseSquad } from '../squadAnalysis'
import type { AnalysisPlayer } from '../squadAnalysis'
import { analysisFileName, generateAnalysisFacebookText, generateAnalysisPdf, generateAnalysisWhatsAppText } from './analysisShare'
import { shareName } from './shareName'

// docs/specs/151, slice B (sharing): the texts, the file name and the PDF of a squad analysis.
const players: AnalysisPlayer[] = [
  { id: '1', firstName: 'Sipho', lastName: 'Ndlovu', dateOfBirth: '2012-05-01', battingStance: 'RIGHT_HANDED', bowlingArm: 'RIGHT_ARM', bowlingType: 'FAST', isWicketKeeper: false, battingPosition: 'OPENER', isPartTimeBowler: false },
  { id: '2', firstName: 'Mpho', lastName: 'Naidoo', dateOfBirth: '2012-06-01', battingStance: 'LEFT_HANDED', bowlingArm: null, bowlingType: null, isWicketKeeper: true, battingPosition: 'TOP_ORDER', isPartTimeBowler: false },
]
const meta = { teamName: 'Irene Villagers 1', seasonLabel: '2026/2027', clubName: 'Irene Villagers' }
const analysisOf = (initialsOnly: boolean) => analyseSquad(players, new Date('2026-11-14'), (player) => shareName(player, initialsOnly))

describe('analysis texts', () => {
  it('writes a WhatsApp message with a bold title and bold headings', () => {
    const text = generateAnalysisWhatsAppText(analysisOf(false), meta, { emoji: false })

    expect(text).toContain('*Irene Villagers 1 squad analysis, 2026/2027 (2 players)*')
    expect(text).toContain('*Balance*')
    expect(text).toContain('*Batting order*')
    expect(text).toContain('*Bowling*')
    expect(text.trim().endsWith('Irene Villagers')).toBe(true)
  })

  it('uses the Opener, Top Order, Middle Order and Lower Order labels with the names', () => {
    const text = generateAnalysisWhatsAppText(analysisOf(false), meta, { emoji: false })

    expect(text).toContain('Opener: Sipho Ndlovu')
    expect(text).toContain('Top Order: Mpho Naidoo')
    expect(text).toContain('Middle Order: None')
    expect(text).toContain('Pace: Sipho Ndlovu')
    expect(text).toContain('*Things to check*')
    expect(text).toContain('- Only 1 wicketkeeper.')
  })

  it('shows junior names as initials when the analysis was built that way', () => {
    const text = generateAnalysisWhatsAppText(analysisOf(true), meta, { emoji: false })

    expect(text).toContain('Opener: S. Ndlovu')
    expect(text).not.toContain('Sipho')
    expect(text).not.toContain('Mpho')
  })

  it('adds the cricket emoji only when asked', () => {
    expect(generateAnalysisWhatsAppText(analysisOf(false), meta, { emoji: true }).startsWith('\u{1F3CF} *')).toBe(true)
    expect(generateAnalysisWhatsAppText(analysisOf(false), meta, { emoji: false }).startsWith('*')).toBe(true)
    expect(generateAnalysisFacebookText(analysisOf(false), meta, { emoji: true }).startsWith('\u{1F3CF} ')).toBe(true)
  })

  it('writes the Facebook post without asterisks, with upper-case headings and the club name last', () => {
    const text = generateAnalysisFacebookText(analysisOf(false), meta, { emoji: false })

    expect(text).not.toContain('*')
    expect(text).toContain('BATTING ORDER')
    expect(text).toContain('THINGS TO CHECK')
    expect(text.trim().endsWith('Irene Villagers')).toBe(true)
  })

  it('leaves out the Things to check block when there is nothing to check', () => {
    const empty = analyseSquad([], new Date('2026-11-14'))
    expect(generateAnalysisWhatsAppText(empty, meta, { emoji: false })).not.toContain('Things to check')
  })
})

describe('analysisFileName', () => {
  it('keeps the season readable (a slash becomes a dash) and strips characters a file cannot hold', () => {
    expect(analysisFileName(meta, 'pdf')).toBe('Irene Villagers 1 2026-2027 squad analysis.pdf')
    expect(analysisFileName({ teamName: 'A/B: "C"', seasonLabel: null, clubName: null }, 'pdf')).toBe('AB C squad analysis.pdf')
  })
})

describe('generateAnalysisPdf', () => {
  it('makes a PDF file named after the team and season', () => {
    const file = generateAnalysisPdf(analysisOf(false), meta)

    expect(file.type).toBe('application/pdf')
    expect(file.name).toBe('Irene Villagers 1 2026-2027 squad analysis.pdf')
    expect(file.size).toBeGreaterThan(500)
  })

  it('still makes a file for an empty squad', () => {
    const file = generateAnalysisPdf(analyseSquad([], new Date('2026-11-14')), meta)
    expect(file.size).toBeGreaterThan(500)
  })
})
