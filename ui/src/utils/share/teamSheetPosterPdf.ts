import type { jsPDF } from 'jspdf'
import { hourStyle, leaderNames, preMarkOf, preMarks, surnameDisplay } from '../teamSheet'
import type { SheetRow } from '../teamSheet'
import { imageFormatOf } from './loadImageDataUrl'
import type { TeamSheetPdfOptions, TeamSheetSpec } from './printableTeamSheetPdf'

// docs/specs/153-printable-team-sheet.md, addendum "Match Poster": the coloured second style of the printable team sheet. One A4
// portrait page per team and match, the whole squad listed alphabetically with a Playing tick box. Mirrors docs/mockups/team-sheet-poster-mockup.html.

type Rgb = [number, number, number]
const GREEN: Rgb = [20, 69, 47]
const GREEN_2: Rgb = [31, 106, 73]
const GOLD: Rgb = [232, 181, 63]
const INK: Rgb = [22, 26, 23]
const MUTED: Rgb = [90, 98, 92]
const LINE: Rgb = [109, 120, 111]
const ZEBRA: Rgb = [238, 242, 238]
const WHITE: Rgb = [255, 255, 255]

const PAGE_W = 210
const PAGE_H = 297
const BANNER_W = 11
const LEFT = 16
const RIGHT = PAGE_W - 12
const WIDTH = RIGHT - LEFT
const ROW = 7
const FOOTER_TOP = 252

export type ImageOf = (url: string | null | undefined) => string | null

// Every image URL a poster page may draw, so the caller loads each once.
export function posterImageUrls(sheet: TeamSheetSpec): string[] {
  const poster = sheet.poster
  return [sheet.teamLogoUrl, sheet.leagueLogoUrl, sheet.match.oppositionLogoUrl, poster?.affiliationLogoUrl, poster?.leagueAffiliationLogoUrl, poster?.hostLogoUrl, ...(poster?.sponsorLogoUrls ?? [])].filter(
    (url): url is string => Boolean(url),
  )
}

// A logo scaled to fit its box and centred in it; with no image (or an unreadable one) a dashed frame, or nothing when `frame` is off.
function fit(doc: jsPDF, data: string | null, x: number, y: number, w: number, h: number, frame: boolean): boolean {
  if (data) {
    try {
      const props = doc.getImageProperties(data)
      const scale = Math.min(w / props.width, h / props.height)
      const iw = props.width * scale
      const ih = props.height * scale
      doc.addImage(data, imageFormatOf(data), x + (w - iw) / 2, y + (h - ih) / 2, iw, ih)
      return true
    } catch {
      // Falls through to the frame.
    }
  }
  if (frame) {
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.3)
    doc.setLineDashPattern([1.2, 1.2], 0)
    doc.roundedRect(x, y, w, h, 2, 2)
    doc.setLineDashPattern([], 0)
  }
  return false
}

function text(doc: jsPDF, value: string, x: number, y: number, size: number, style: 'normal' | 'bold' | 'italic' | 'bolditalic', color: Rgb, align: 'left' | 'center' | 'right' = 'left'): void {
  doc.setFont('helvetica', style)
  doc.setFontSize(size)
  doc.setTextColor(...color)
  doc.text(value, x, y, { align })
}

// Wraps text to a width at the size and weight it will be drawn in (jsPDF measures with the font set at the time).
function wrap(doc: jsPDF, value: string, width: number, size: number, style: 'normal' | 'bold' | 'italic' | 'bolditalic'): string[] {
  doc.setFont('helvetica', style)
  doc.setFontSize(size)
  return doc.splitTextToSize(value, width) as string[]
}

function writeLine(doc: jsPDF, x1: number, x2: number, y: number): void {
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.3)
  doc.line(x1, y, x2, y)
}

function drawBanner(doc: jsPDF, label: string): void {
  const top = 62
  const height = 192
  doc.setFillColor(...GREEN)
  doc.rect(0, top, BANNER_W, height, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, top + height - 2, BANNER_W, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(...WHITE)
  doc.text(label, BANNER_W / 2 + 3.5, top + height / 2 + label.length * 2.4, { angle: 90, charSpace: 2 })
}

function drawHeader(doc: jsPDF, sheet: TeamSheetSpec, imageOf: ImageOf): number {
  const poster = sheet.poster
  const top = 8
  const box = 24
  // Affiliation top left (its logo, else its name), league top right.
  if (!fit(doc, imageOf(poster?.affiliationLogoUrl), LEFT, top, 34, box, false) && poster?.affiliationName) {
    const lines = wrap(doc, poster.affiliationName, 36, 9, 'bold').slice(0, 3)
    text(doc, lines.join('\n'), LEFT, top + box / 2 - (lines.length - 1) * 2, 9, 'bold', GREEN)
  }
  // The league's affiliation (VCASA) top right: its logo, else its name. The league's own logo sits above the league name in the centre.
  if (!fit(doc, imageOf(poster?.leagueAffiliationLogoUrl), RIGHT - 34, top, 34, box, false) && poster?.leagueAffiliationName) {
    const lines = wrap(doc, poster.leagueAffiliationName, 34, 9, 'bold').slice(0, 3)
    text(doc, lines.join('\n'), RIGHT, top + box / 2 - (lines.length - 1) * 2, 9, 'bold', GREEN, 'right')
  }
  const centre = PAGE_W / 2
  const leagueLogo = fit(doc, imageOf(sheet.leagueLogoUrl), centre - 26, top, 52, 16, false)
  const title = poster?.leagueTitle ?? sheet.match.league
  const titleY = top + (leagueLogo ? 23 : 11)
  if (title) text(doc, wrap(doc, title.toUpperCase(), 100, 17, 'bold')[0], centre, titleY, 17, 'bold', GREEN, 'center')
  if (poster?.dateRange) text(doc, poster.dateRange, centre, titleY + 6.5, 11, 'bold', INK, 'center')
  return Math.max(top + box + 4, titleY + (poster?.dateRange ? 6.5 : 0) + 3)
}

// Our logo, "vs", the opposition's crest, the names beneath on one level (the opposition's is a write-on line on a blank sheet), then the date.
function drawCrests(doc: jsPDF, sheet: TeamSheetSpec, imageOf: ImageOf, y: number): number {
  const box = 22
  const crestW = 38
  const centre = (LEFT + RIGHT) / 2
  const leftX = LEFT + 16
  const rightX = RIGHT - 16 - crestW
  fit(doc, imageOf(sheet.teamLogoUrl), leftX, y, crestW, box, false)
  text(doc, 'vs', centre, y + box / 2 + 3, 20, 'bolditalic', GREEN_2, 'center')
  const blank = !sheet.match.opposition
  fit(doc, imageOf(sheet.match.oppositionLogoUrl), rightX, y, crestW, box, false)
  const nameY = y + box + 8
  text(doc, sheet.teamName.toUpperCase(), leftX + crestW / 2, nameY, 11, 'bold', INK, 'center')
  if (blank) writeLine(doc, rightX - 6, rightX + crestW + 6, nameY + 1)
  else text(doc, sheet.match.opposition?.toUpperCase() ?? '', rightX + crestW / 2, nameY, 11, 'bold', INK, 'center')

  let after = nameY + 8
  if (sheet.match.date) {
    const when = `DATE: ${sheet.match.date}${sheet.match.time ? ` - ${hourStyle(sheet.match.time)}` : ''}`
    text(doc, when, centre, after + 2, 14, 'bolditalic', INK, 'center')
    // docs/specs/155: a staged match (Playoff, Semi-final, Final) prints its stage under the date.
    let line = after + 2
    if (sheet.match.stage) {
      line += 6.5
      text(doc, sheet.match.stage.toUpperCase(), centre, line, 11, 'bold', GREEN, 'center')
    }
    if (sheet.match.venue) {
      line += 5.5
      text(doc, `VENUE: ${sheet.match.venue}`, centre, line, 9, 'normal', MUTED, 'center')
    }
    after = line + 5
  } else {
    // Blank match: DATE, TIME and VENUE as write-on lines across the page.
    const base = after + 4
    text(doc, 'DATE:', LEFT, base, 10, 'bolditalic', INK)
    writeLine(doc, LEFT + 14, LEFT + 70, base + 0.5)
    text(doc, 'TIME:', LEFT + 76, base, 10, 'bolditalic', INK)
    writeLine(doc, LEFT + 90, LEFT + 112, base + 0.5)
    text(doc, 'VENUE:', LEFT + 118, base, 10, 'bolditalic', INK)
    writeLine(doc, LEFT + 134, RIGHT, base + 0.5)
    after += 10
  }
  return after + 2
}

interface Columns {
  playing: number
  shirt: number
  wk: number
  bat: number
  bowl: number
  comment: number
  player: number
}

function columns(options: TeamSheetPdfOptions, side: boolean): Columns {
  const playing = side || options.playingBox === false ? 0 : 17
  const shirt = 15
  const wk = side ? 22 : 14
  const bat = options.batBowl ? 16 : 0
  const bowl = options.batBowl ? 16 : 0
  const comment = options.comment ? 38 : 0
  return { playing, shirt, wk, bat, bowl, comment, player: WIDTH - playing - shirt - wk - bat - bowl - comment }
}

function box(doc: jsPDF, cx: number, cy: number): void {
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.35)
  doc.rect(cx - 2.1, cy - 2.1, 4.2, 4.2)
}

function drawTable(doc: jsPDF, rows: SheetRow[], options: TeamSheetPdfOptions, side: boolean, y: number): number {
  const cols = columns(options, side)
  const headH = options.batBowl ? 9 : 6.5
  const cell = (x: number, w: number, label: string, h: number, top: number, align: 'left' | 'center' = 'center') => {
    doc.setFillColor(...GREEN)
    doc.rect(x, top, w, h, 'F')
    doc.setDrawColor(...WHITE)
    doc.setLineWidth(0.25)
    doc.rect(x, top, w, h)
    text(doc, label, align === 'center' ? x + w / 2 : x + 2, top + h / 2 + 1.1, 7.5, 'bold', WHITE, align)
  }
  let x = LEFT
  if (cols.playing > 0) cell(x, cols.playing, 'PLAYING', headH, y)
  x += cols.playing
  cell(x, cols.player, 'PLAYER', headH, y, 'left')
  x += cols.player
  cell(x, cols.shirt, 'SHIRT', headH, y)
  x += cols.shirt
  cell(x, cols.wk, side ? 'C / W/K' : 'W/K', headH, y)
  x += cols.wk
  if (options.batBowl) {
    cell(x, cols.bat + cols.bowl, 'PLAYERS', 4.5, y)
    cell(x, cols.bat, 'BAT POS', 4.5, y + 4.5)
    cell(x + cols.bat, cols.bowl, 'BOWL', 4.5, y + 4.5)
    x += cols.bat + cols.bowl
  }
  if (options.comment) cell(x, cols.comment, 'COMMENT', headH, y)
  y += headH

  rows.forEach((row, index) => {
    if (index % 2 === 1) {
      doc.setFillColor(...ZEBRA)
      doc.rect(LEFT, y, WIDTH, ROW, 'F')
    }
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.2)
    let cx = LEFT
    const edges = [cols.playing, cols.player, cols.shirt, cols.wk, cols.bat, cols.bowl, cols.comment].filter((width) => width > 0)
    edges.forEach((width) => {
      doc.rect(cx, y, width, ROW)
      cx += width
    })
    const mid = y + ROW / 2
    if (cols.playing > 0) box(doc, LEFT + cols.playing / 2, mid)
    if (row.kind === 'player') {
      const nameX = LEFT + cols.playing + 2
      const first = row.player.firstName
      text(doc, first, nameX, mid + 1.4, 10, 'normal', INK)
      const firstWidth = doc.getTextWidth(first + ' ')
      text(doc, wrap(doc, surnameDisplay(row.player.lastName), cols.player - firstWidth - 3, 10, 'bold')[0] ?? '', nameX + firstWidth, mid + 1.4, 10, 'bold', INK)
      if (row.player.shirt !== null) text(doc, String(row.player.shirt), LEFT + cols.playing + cols.player + cols.shirt / 2, mid + 1.4, 10, 'bold', INK, 'center')
      // A plain Poster marks the keeper only with Pre-Mark; a selected side is real, so C, W/K and 12th always show.
      const tag = side
        ? row.player.twelfth
          ? '12th'
          : [row.player.isCaptain ? 'C' : '', row.player.isKeeper ? 'W/K' : ''].filter(Boolean).join(' ')
        : preMarks(row, options.preMark).keeper
          ? 'W/K'
          : ''
      if (tag) text(doc, tag, LEFT + cols.playing + cols.player + cols.shirt + cols.wk / 2, mid + 1.2, 8, 'bold', GREEN, 'center')
    }
    y += ROW
  })
  return y
}

function drawSignatures(doc: jsPDF, sheet: TeamSheetSpec, options: TeamSheetPdfOptions, y: number): void {
  const captain = preMarkOf(options.preMark).captain || sheet.selectedSide ? leaderNames(sheet.players).captain : null
  text(doc, 'CAPTAIN:', LEFT, y, 11, 'bolditalic', INK)
  writeLine(doc, LEFT + 24, LEFT + 92, y + 0.5)
  if (captain) text(doc, captain, LEFT + 26, y - 0.8, 10, 'bold', INK)
  text(doc, 'SIGN:', LEFT + 100, y, 11, 'bolditalic', INK)
  writeLine(doc, LEFT + 116, RIGHT, y + 0.5)
}

// The fading band at the foot of the page: sponsor logos on white tiles along it and the tournament host at the right.
function drawFooter(doc: jsPDF, sheet: TeamSheetSpec, imageOf: ImageOf): void {
  const height = PAGE_H - FOOTER_TOP
  const strips = 24
  for (let i = 0; i < strips; i += 1) {
    const t = i / (strips - 1)
    const colour = GREEN.map((channel) => Math.round(255 + (channel - 255) * Math.min(1, t * 1.3))) as Rgb
    doc.setFillColor(...colour)
    doc.rect(0, FOOTER_TOP + (height / strips) * i, PAGE_W, height / strips + 0.3, 'F')
  }
  doc.setFillColor(...GOLD)
  doc.rect(0, PAGE_H - 2, PAGE_W, 2, 'F')

  const poster = sheet.poster
  const sponsors = (poster?.sponsorLogoUrls ?? []).slice(0, 4)
  const slotW = 30
  const slotH = 16
  const y = PAGE_H - slotH - 8
  sponsors.forEach((url, index) => {
    const x = LEFT + index * (slotW + 5)
    doc.setFillColor(...WHITE)
    doc.roundedRect(x, y, slotW, slotH, 1.5, 1.5, 'F')
    fit(doc, imageOf(url), x + 1.5, y + 1.5, slotW - 3, slotH - 3, false)
  })
  if (poster?.hostName || poster?.hostLogoUrl) {
    const textRight = poster.hostLogoUrl ? RIGHT - 28 : RIGHT
    if (poster.hostName) {
      text(doc, 'HOST:', textRight, PAGE_H - 17, 8, 'bold', WHITE, 'right')
      text(doc, wrap(doc, poster.hostName.toUpperCase(), 60, 10, 'bold')[0], textRight, PAGE_H - 11.5, 10, 'bold', WHITE, 'right')
    }
    if (poster.hostLogoUrl) {
      doc.setFillColor(...WHITE)
      doc.roundedRect(RIGHT - 24, y - 2, 24, slotH + 2, 1.5, 1.5, 'F')
      fit(doc, imageOf(poster.hostLogoUrl), RIGHT - 23, y - 1, 22, slotH, false)
    }
  }
}

// One poster page: `rows` is this page's slice of the squad (the header, crests and footer repeat on every page of a long squad).
export function drawPosterPage(doc: jsPDF, sheet: TeamSheetSpec, rows: SheetRow[], options: TeamSheetPdfOptions, imageOf: ImageOf): void {
  const hasTwelfth = sheet.players.some((player) => player.twelfth)
  drawBanner(doc, sheet.selectedSide ? (hasTwelfth ? 'PLAYING XII' : 'PLAYING XI') : 'TEAM SHEET')
  const afterHeader = drawHeader(doc, sheet, imageOf)
  const afterCrests = drawCrests(doc, sheet, imageOf, afterHeader)
  const end = drawTable(doc, rows, options, Boolean(sheet.selectedSide), afterCrests)
  drawSignatures(doc, sheet, options, Math.min(end + 20, FOOTER_TOP - 6))
  drawFooter(doc, sheet, imageOf)
}
