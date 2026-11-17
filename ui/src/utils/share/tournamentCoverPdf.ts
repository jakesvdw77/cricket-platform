import type { jsPDF } from 'jspdf'
import { leaderNames } from '../teamSheet'
import type { TeamSheetSpec } from './printableTeamSheetPdf'
import { FOOTER_TOP, GOLD, GREEN, GREEN_2, INK, PAGE_W, SAFE, drawFooter, fit, text, wrap, writeLine } from './teamSheetPosterPdf'
import type { ImageOf } from './teamSheetPosterPdf'

// docs/specs/159-tournament-cover-page.md: the cover put on top of a team's printed match sheets. One A4 portrait page per team and
// tournament; every coloured element stays inside the printers' safe margin (SAFE). Mirrors docs/mockups/tournament-cover-page-mockup.html.

export interface CoverOptions {
  // The write-on lines, each a switch on the print screen.
  captain: boolean
  manager: boolean
  contact: boolean
  notes: boolean
  // Pre-Mark Captain: the Captain line is filled with the team's captain.
  fillCaptain: boolean
}

const MARGIN = SAFE + 8
const RIGHT = PAGE_W - MARGIN
const ROW = 11

export function drawCoverPage(doc: jsPDF, sheet: TeamSheetSpec, options: CoverOptions, imageOf: ImageOf): void {
  const poster = sheet.poster
  const centre = PAGE_W / 2
  const cornerTop = SAFE + 2

  // Corners: the league's affiliation (its logo, else its name) and our club's logo.
  if (!fit(doc, imageOf(poster?.leagueAffiliationLogoUrl), MARGIN, cornerTop, 40, 24, false) && poster?.leagueAffiliationName) {
    const lines = wrap(doc, poster.leagueAffiliationName, 40, 9, 'bold').slice(0, 3)
    text(doc, lines.join('\n'), MARGIN, cornerTop + 12 - (lines.length - 1) * 2, 9, 'bold', GREEN)
  }
  fit(doc, imageOf(poster?.clubLogoUrl), RIGHT - 40, cornerTop, 40, 24, false)

  // Hero: the tournament badge, then its name (up to two lines), dates and a gold rule.
  const title = poster?.leagueTitle ?? sheet.match.league
  const titleLines = title ? wrap(doc, title.toUpperCase(), RIGHT - MARGIN, 30, 'bold').slice(0, 2) : []
  const heroH = 52 - (titleLines.length > 1 ? 12 : 0)
  let y = cornerTop + 26
  const badge = fit(doc, imageOf(sheet.leagueLogoUrl), centre - 60, y, 120, heroH, false)
  y += badge ? heroH + 13 : 8
  titleLines.forEach((line, index) => {
    text(doc, line, centre, y + index * 12, 30, 'bold', GREEN, 'center')
  })
  y += Math.max(0, titleLines.length - 1) * 12
  if (poster?.dateRange) {
    y += 9
    text(doc, poster.dateRange, centre, y, 16, 'bold', INK, 'center')
  }
  y += 7
  doc.setFillColor(...GOLD)
  doc.rect(centre - 30, y, 60, 2, 'F')
  y += 9

  // The team: crest, name and the section and season.
  const crest = 40
  fit(doc, imageOf(sheet.teamLogoUrl), centre - crest / 2, y, crest, crest, false)
  y += crest + 9
  const nameLines = wrap(doc, sheet.teamName.toUpperCase(), RIGHT - MARGIN, 24, 'bold').slice(0, 2)
  nameLines.forEach((line, index) => text(doc, line, centre, y + index * 10, 24, 'bold', INK, 'center'))
  y += (nameLines.length - 1) * 10
  if (sheet.subtitle) {
    y += 7
    text(doc, sheet.subtitle, centre, y, 13, 'bold', GREEN_2, 'center')
  }
  y += 12

  // Write-on lines: label, then a line the whole width of the page body.
  const captain = options.fillCaptain ? leaderNames(sheet.players).captain : null
  const lines: Array<{ label: string; value?: string | null; double?: boolean }> = []
  if (options.captain) lines.push({ label: 'Captain', value: captain })
  if (options.manager) lines.push({ label: 'Manager' })
  if (options.contact) lines.push({ label: 'Contact' })
  if (options.notes) lines.push({ label: 'Notes', double: true })
  const left = MARGIN + 6
  const right = RIGHT - 6
  for (const line of lines) {
    if (y + ROW > FOOTER_TOP - 4) break
    text(doc, `${line.label.toUpperCase()}:`, left, y, 10, 'bolditalic', GREEN)
    writeLine(doc, left + 30, right, y + 0.5)
    if (line.value) text(doc, line.value, left + 32, y - 0.8, 11, 'bold', INK)
    if (line.double) {
      y += ROW
      writeLine(doc, left + 30, right, y + 0.5)
    }
    y += ROW
  }

  drawFooter(doc, sheet, imageOf)
}
