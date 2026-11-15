import { jsPDF } from 'jspdf'
import { BLANK_LINES, metaCells, sheetPages, preMarks } from '../teamSheet'
import type { SheetMatchInfo, SheetPlayer, SheetRow } from '../teamSheet'
import { imageFormatOf, loadImageDataUrl } from './loadImageDataUrl'

// docs/specs/153-printable-team-sheet.md: the printable team sheet as an A4 portrait PDF, one or more pages per team (a long squad
// flows onto a second page with the header repeated). Black and white safe: the green header band prints as a dark grey and the tick
// boxes are plain outlines. Names are printed in full (owner decision 2026-11-15); nothing here is stored anywhere.

export interface TeamSheetSpec {
  teamName: string
  // "Over 40 | 2026/2027": the section and season under the name.
  subtitle: string | null
  teamLogoUrl: string | null
  leagueLogoUrl: string | null
  // All null for a blank sheet: the boxes stay empty to write on.
  match: SheetMatchInfo
  players: SheetPlayer[]
}

export interface TeamSheetPdfOptions {
  preMark: boolean
  // The two empty lines for a late or guest player; on unless switched off.
  extraLines?: boolean
  // The Toss won by and Elected to boxes; off unless switched on (the sheet is handed in before the game).
  tossBoxes?: boolean
  fileName: string
}

type Rgb = [number, number, number]
const GREEN: Rgb = [20, 69, 47]
const INK: Rgb = [22, 26, 23]
const MUTED: Rgb = [90, 98, 92]
const LINE: Rgb = [154, 165, 157]
const ZEBRA: Rgb = [238, 242, 238]

const LEFT = 12
const WIDTH = 186
const ROW = 8
// Column widths: Playing, Shirt, First name, Surname, Capt, Keeper (sum = WIDTH).
const COLS = [22, 20, 52, 62, 15, 15]

function drawLogo(doc: jsPDF, data: string | null, x: number, y: number, box: number, fallback: string): void {
  doc.setDrawColor(...LINE)
  if (data) {
    try {
      const props = doc.getImageProperties(data)
      const scale = Math.min(box / props.width, box / props.height)
      const w = props.width * scale
      const h = props.height * scale
      doc.addImage(data, imageFormatOf(data), x + (box - w) / 2, y + (box - h) / 2, w, h)
      return
    } catch {
      // An unsupported image falls back to the outlined box below.
    }
  }
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, box, box, 2, 2)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(fallback, x + box / 2, y + box / 2 + 1, { align: 'center' })
}

function drawHeader(doc: jsPDF, spec: TeamSheetSpec, teamLogo: string | null, leagueLogo: string | null): number {
  const top = 12
  const box = 24
  const showLeague = Boolean(spec.leagueLogoUrl) || Boolean(spec.match.league)
  if (showLeague) drawLogo(doc, leagueLogo, LEFT, top, box, 'LEAGUE')
  drawLogo(doc, teamLogo, LEFT + WIDTH - box, top, box, 'TEAM')
  const centre = LEFT + WIDTH / 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text('T E A M   S H E E T', centre, top + 5, { align: 'center' })
  doc.setFontSize(22)
  doc.setTextColor(...GREEN)
  const name = doc.splitTextToSize(spec.teamName.toUpperCase(), WIDTH - 2 * (box + 6)) as string[]
  doc.text(name.slice(0, 2), centre, top + 14, { align: 'center' })
  if (spec.subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...INK)
    doc.text(spec.subtitle, centre, top + (name.length > 1 ? 28 : 21), { align: 'center' })
  }
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.9)
  doc.line(LEFT, top + box + 4, LEFT + WIDTH, top + box + 4)
  return top + box + 8
}

// Two rows of four write-on boxes: filled from the match when known, else left empty.
function drawMeta(doc: jsPDF, match: SheetMatchInfo, tossBoxes: boolean, y: number): number {
  const cell = WIDTH / 4
  let column = 0
  metaCells(match, tossBoxes).forEach(({ label, value, span }) => {
    const x = LEFT + column * cell
    const top = y + Math.floor(column / 4) * 13
    column += span
    const width = cell * span
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(label.toUpperCase(), x + 1, top + 2.5)
    if (value) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...INK)
      doc.text((doc.splitTextToSize(value, width - 5) as string[])[0], x + 1, top + 8)
    }
    doc.setDrawColor(...INK)
    doc.setLineWidth(0.25)
    doc.line(x + 1, top + 10, x + width - 3, top + 10)
  })
  return y + 2 * 13 + 3
}

function box(doc: jsPDF, centreX: number, centreY: number, filled: boolean): void {
  const size = 4.4
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.35)
  if (filled) {
    doc.setFillColor(...INK)
    doc.rect(centreX - size / 2, centreY - size / 2, size, size, 'FD')
  } else {
    doc.rect(centreX - size / 2, centreY - size / 2, size, size)
  }
}

function drawTable(doc: jsPDF, rows: SheetRow[], preMark: boolean, y: number): number {
  // Header band
  doc.setFillColor(...GREEN)
  doc.rect(LEFT, y, WIDTH, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  const heads = ['PLAYING', 'SHIRT', 'FIRST NAME', 'SURNAME', 'CAPT', 'KEEPER']
  let x = LEFT
  heads.forEach((head, index) => {
    const centred = index === 0 || index >= 4
    doc.text(head, centred ? x + COLS[index] / 2 : x + 2, y + 4.8, { align: centred ? 'center' : 'left' })
    x += COLS[index]
  })
  y += 7
  rows.forEach((row, index) => {
    if (index % 2 === 1) {
      doc.setFillColor(...ZEBRA)
      doc.rect(LEFT, y, WIDTH, ROW, 'F')
    }
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.2)
    doc.line(LEFT, y + ROW, LEFT + WIDTH, y + ROW)
    const marks = preMarks(row, preMark)
    const mid = y + ROW / 2
    box(doc, LEFT + COLS[0] / 2, mid, false)
    box(doc, LEFT + COLS[0] + COLS[1] + COLS[2] + COLS[3] + COLS[4] / 2, mid, marks.captain)
    box(doc, LEFT + COLS[0] + COLS[1] + COLS[2] + COLS[3] + COLS[4] + COLS[5] / 2, mid, marks.keeper)
    if (row.kind === 'player') {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...INK)
      if (row.player.shirt !== null) doc.text(String(row.player.shirt), LEFT + COLS[0] + 2, mid + 1.4)
      doc.setFont('helvetica', 'normal')
      doc.text(doc.splitTextToSize(row.player.firstName, COLS[2] - 3)[0] ?? '', LEFT + COLS[0] + COLS[1] + 2, mid + 1.4)
      doc.text(doc.splitTextToSize(row.player.lastName, COLS[3] - 3)[0] ?? '', LEFT + COLS[0] + COLS[1] + COLS[2] + 2, mid + 1.4)
    }
    y += ROW
  })
  return y
}

function drawFooter(doc: jsPDF, tableEnd: number): void {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Tick 11 under Playing (12 where a twelfth man is allowed). The two empty lines are for a late or guest player.', LEFT, tableEnd + 5)
  const line = 277
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.3)
  doc.line(LEFT, line, LEFT + 80, line)
  doc.line(LEFT + WIDTH - 80, line, LEFT + WIDTH, line)
  doc.text("Captain's signature", LEFT, line + 4)
  doc.text("Umpire's signature", LEFT + WIDTH - 80, line + 4)
}

export async function generateTeamSheetPdf(sheets: TeamSheetSpec[], options: TeamSheetPdfOptions): Promise<File> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const wanted = [...new Set(sheets.flatMap((sheet) => [sheet.teamLogoUrl, sheet.leagueLogoUrl]).filter((url): url is string => Boolean(url)))]
  const logos = new Map<string, string | null>(await Promise.all(wanted.map(async (url) => [url, await loadImageDataUrl(url)] as const)))
  const imageOf = (url: string | null): string | null => (url ? (logos.get(url) ?? null) : null)

  let first = true
  for (const sheet of sheets) {
    for (const rows of sheetPages(sheet.players, options.extraLines === false ? 0 : BLANK_LINES)) {
      if (!first) doc.addPage()
      first = false
      const afterHeader = drawHeader(doc, sheet, imageOf(sheet.teamLogoUrl), imageOf(sheet.leagueLogoUrl))
      const afterMeta = drawMeta(doc, sheet.match, options.tossBoxes === true, afterHeader)
      const end = drawTable(doc, rows, options.preMark, afterMeta)
      drawFooter(doc, end)
    }
  }
  const blob = doc.output('blob')
  return new File([blob], options.fileName, { type: 'application/pdf' })
}
