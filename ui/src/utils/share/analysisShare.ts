import { jsPDF } from 'jspdf'
import { BATTING_POSITION_LABEL } from '../playerLabels'
import { BATTING_POSITIONS, FULL_SIDE } from '../squadAnalysis'
import type { SquadAnalysis } from '../squadAnalysis'

// docs/specs/151, slice B (sharing): the squad analysis as a WhatsApp message, a Facebook post and an A4 PDF. Pure apart from
// jsPDF. Every player name in the analysis passed in is already in the shared form (initials for juniors, docs/specs/114); nothing
// here names a person any other way.

export interface AnalysisShareMeta {
  teamName: string
  seasonLabel: string | null
  clubName: string | null
}

export interface AnalysisTextOptions {
  emoji: boolean
}

const list = (names: string[], empty = 'None') => (names.length > 0 ? names.join(', ') : empty)

function summaryLine(analysis: SquadAnalysis): string {
  return [
    `Batters ${analysis.batters.length}`,
    `Main bowlers ${analysis.mainBowlers.length}`,
    `Part-time bowlers ${analysis.partTimeBowlers.length}`,
    `All-rounders ${analysis.allRounders.length}`,
    `Wicketkeepers ${analysis.keepers.length}`,
  ].join(' | ')
}

interface Block {
  heading: string
  lines: string[]
}

function blocks(analysis: SquadAnalysis): Block[] {
  const warnings = analysis.gaps.filter((gap) => gap.tone === 'warning').map((gap) => gap.text)
  return [
    { heading: 'Balance', lines: [summaryLine(analysis)] },
    {
      heading: 'Batting order',
      lines: [
        ...BATTING_POSITIONS.map((position) => `${BATTING_POSITION_LABEL[position]}: ${list(analysis.battingOrder[position])}`),
        ...(analysis.battingNotSet.length > 0 ? [`Not set: ${analysis.battingNotSet.join(', ')}`] : []),
      ],
    },
    {
      heading: 'Bowling',
      lines: [
        `Pace: ${list(analysis.bowling.pace)}`,
        `Medium: ${list(analysis.bowling.medium)}`,
        `Spin: ${list(analysis.bowling.spin)}`,
        `Part-time: ${list(analysis.bowling.partTime)}`,
      ],
    },
    ...(warnings.length > 0 ? [{ heading: 'Things to check', lines: warnings.map((text) => `- ${text}`) }] : []),
  ]
}

const titleLine = (meta: AnalysisShareMeta, analysis: SquadAnalysis) =>
  `${meta.teamName} squad analysis${meta.seasonLabel ? `, ${meta.seasonLabel}` : ''} (${analysis.size} players)`

export function generateAnalysisWhatsAppText(analysis: SquadAnalysis, meta: AnalysisShareMeta, options: AnalysisTextOptions): string {
  const lines = [`${options.emoji ? '\u{1F3CF} ' : ''}*${titleLine(meta, analysis)}*`]
  for (const block of blocks(analysis)) {
    lines.push('', `*${block.heading}*`, ...block.lines)
  }
  if (meta.clubName) lines.push('', meta.clubName)
  return lines.join('\n')
}

export function generateAnalysisFacebookText(analysis: SquadAnalysis, meta: AnalysisShareMeta, options: AnalysisTextOptions): string {
  const lines = [`${options.emoji ? '\u{1F3CF} ' : ''}${titleLine(meta, analysis)}`]
  for (const block of blocks(analysis)) {
    lines.push('', `${block.heading.toUpperCase()}`, ...block.lines)
  }
  if (meta.clubName) lines.push('', meta.clubName)
  return lines.join('\n')
}

export const analysisFileName = (meta: AnalysisShareMeta, extension: string): string =>
  `${[meta.teamName, meta.seasonLabel?.replace(/\//g, '-'), 'squad analysis'].filter(Boolean).join(' ').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()}.${extension}`

const GREEN: [number, number, number] = [15, 81, 50]
const INK: [number, number, number] = [16, 35, 26]
const MUTED: [number, number, number] = [85, 102, 92]
const AMBER: [number, number, number] = [183, 121, 31]

/** An A4 portrait page (more when it overflows): the heading, the figures, then each block. Plain text, so it prints well. */
export function generateAnalysisPdf(analysis: SquadAnalysis, meta: AnalysisShareMeta): File {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const left = 15
  const width = 180
  let y = 20
  const room = (needed: number) => {
    if (y + needed > 282) {
      doc.addPage()
      y = 20
    }
  }
  const text = (value: string, size: number, color: [number, number, number], bold = false, x = left, maxWidth = width) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const wrapped = doc.splitTextToSize(value, maxWidth) as string[]
    room(wrapped.length * (size * 0.5) + 2)
    doc.text(wrapped, x, y)
    y += wrapped.length * (size * 0.45) + 1.5
  }

  text(meta.teamName, 22, GREEN, true)
  text([meta.seasonLabel, meta.clubName, `${analysis.size} players`].filter(Boolean).join('  |  '), 11, MUTED)
  y += 3

  // Figures
  const figures: [string, number][] = [
    ['Batters', analysis.batters.length],
    ['Main bowlers', analysis.mainBowlers.length],
    ['Part-time', analysis.partTimeBowlers.length],
    ['All-rounders', analysis.allRounders.length],
    ['Keepers', analysis.keepers.length],
  ]
  const cell = width / figures.length
  figures.forEach(([label, value], index) => {
    const x = left + index * cell
    doc.setDrawColor(216, 223, 210)
    doc.rect(x, y, cell - 3, 16)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...GREEN)
    doc.text(String(value), x + 3, y + 8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(label, x + 3, y + 13)
  })
  y += 24

  const warnings = analysis.gaps.filter((gap) => gap.tone === 'warning')
  if (warnings.length > 0) {
    text('Things to check', 13, AMBER, true)
    warnings.forEach((gap) => text(`- ${gap.text}`, 10.5, INK, false, left + 2, width - 4))
    y += 3
  }

  text('Batting order', 13, GREEN, true)
  const column = width / 4
  const top = y
  let tallest = y
  BATTING_POSITIONS.forEach((position, index) => {
    y = top
    const x = left + index * column
    text(`${BATTING_POSITION_LABEL[position]} (${analysis.battingOrder[position].length})`, 10, GREEN, true, x, column - 3)
    const names = analysis.battingOrder[position]
    if (names.length === 0) text('Nobody', 9.5, MUTED, false, x, column - 3)
    names.forEach((name) => text(name, 9.5, INK, false, x, column - 3))
    tallest = Math.max(tallest, y)
  })
  y = tallest + 2
  if (analysis.battingNotSet.length > 0) text(`Not set: ${analysis.battingNotSet.join(', ')}`, 9.5, MUTED)
  y += 3

  text('Bowling', 13, GREEN, true)
  ;[
    ['Pace', analysis.bowling.pace],
    ['Medium', analysis.bowling.medium],
    ['Spin', analysis.bowling.spin],
    ['Part-time', analysis.bowling.partTime],
  ].forEach(([label, names]) => text(`${label}: ${list(names as string[])}`, 10.5, INK))
  y += 3

  text('Hands', 13, GREEN, true)
  text(`Batters: ${analysis.hands.rightBat} right-hand, ${analysis.hands.leftBat} left-hand. Bowlers: ${analysis.hands.rightArm} right-arm, ${analysis.hands.leftArm} left-arm.`, 10.5, INK)
  y += 3

  text('Experience', 13, GREEN, true)
  const exp = analysis.experience
  text(
    exp.averageAge === null
      ? `Squad size ${analysis.size} of ${FULL_SIDE} needed.`
      : `Average age ${exp.averageAge}, youngest ${exp.youngest}, oldest ${exp.oldest}. Squad size ${analysis.size} of ${FULL_SIDE} needed.`,
    10.5,
    INK,
  )

  const blob = doc.output('blob')
  return new File([blob], analysisFileName(meta, 'pdf'), { type: 'application/pdf' })
}
