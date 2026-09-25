import { jsPDF } from 'jspdf'
import type { PlayingConditionsPayload } from '../api/leaguePlayingConditionsApi'
import { resolveEffectiveMaxOversPerBowler } from './playingConditions'

// docs/specs/052-league-playing-conditions.md UI Requirements item 8 — mirrors
// leagueSchedulePdf.ts's/teamSheetPdf.ts's own colour constants and dark header-band shape,
// re-declared locally rather than imported (this codebase's established per-file precedent for
// these small PDF generator modules — see leagueSchedulePdf.ts's own doc comment). Only
// DARK/MID/WHITE/LGRAY are needed here.
const DARK: [number, number, number] = [20, 35, 28] // theme.palette.text.primary (#14231c)
const MID: [number, number, number] = [47, 110, 79] // theme.palette.primary.main (#2f6e4f)
const WHITE: [number, number, number] = [255, 255, 255]
const LGRAY: [number, number, number] = [150, 165, 158]

interface SummaryRow {
  label: string
  value: string
}

interface SummarySection {
  heading: string
  rows: SummaryRow[]
}

// Restates only the structured fields — same three blocks (Match Format / Points / Bonus Points)
// as generatePlayingConditionsWhatsAppText, so the two derived outputs can never state the numbers
// differently. Bonus Points is omitted entirely when disabled.
function buildSections(conditions: PlayingConditionsPayload): SummarySection[] {
  const effectiveMaxOversPerBowler = resolveEffectiveMaxOversPerBowler(
    conditions.maxOversPerInnings,
    conditions.maxOversPerBowler,
  )

  const sections: SummarySection[] = [
    {
      heading: 'Match Format',
      rows: [
        { label: 'Overs per innings', value: String(conditions.maxOversPerInnings) },
        { label: 'Powerplay overs', value: String(conditions.powerplayOvers) },
        {
          label: 'Max overs per bowler',
          value: effectiveMaxOversPerBowler != null ? String(effectiveMaxOversPerBowler) : 'N/A',
        },
      ],
    },
    {
      heading: 'Points',
      rows: [
        { label: 'Win', value: String(conditions.pointsForWin) },
        { label: 'Loss', value: String(conditions.pointsForLoss) },
        { label: 'Draw', value: String(conditions.pointsForDraw) },
        { label: 'No result', value: String(conditions.pointsForNoResult) },
        { label: 'Forfeit win', value: String(conditions.pointsForForfeitWin) },
      ],
    },
  ]

  if (
    conditions.bonusPointsEnabled &&
    conditions.bonusBattingOversThreshold != null &&
    conditions.bonusBowlingRestrictionPercentage != null
  ) {
    const threshold = conditions.bonusBattingOversThreshold
    sections.push({
      heading: 'Bonus Points',
      rows: [
        { label: 'Batting bonus', value: `Chase the target before over ${threshold}` },
        {
          label: 'Bowling bonus',
          value: `Restrict them to ${conditions.bonusBowlingRestrictionPercentage}% of the target (or bowl them out) before over ${threshold}`,
        },
      ],
    })
  }

  return sections
}

// Builds a single-page A4 portrait captain-summary PDF and returns an object URL for it — the
// caller owns opening it (window.open(url, '_blank')), same delivery contract as
// leagueSchedulePdf.ts. No checkPage/pagination logic — the field count guarantees one page.
export async function generatePlayingConditionsSummaryPdf(
  leagueName: string,
  seasonLabel: string,
  conditions: PlayingConditionsPayload,
): Promise<string> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 16

  // Header band — league name + season/summary subtitle, mirroring leagueSchedulePdf.ts's own
  // header band shape exactly.
  doc.setFillColor(...DARK)
  doc.rect(0, 0, pageW, 30, 'F')
  doc.setFillColor(...MID)
  doc.rect(0, 30, pageW, 1.5, 'F')

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(leagueName, margin, 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 225, 210)
  doc.text(`${seasonLabel} — Playing Conditions Summary`, margin, 22)

  let y = 44
  const valueX = margin + 75

  buildSections(conditions).forEach((section) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    doc.text(section.heading, margin, y)
    y += 8

    section.rows.forEach((row) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...LGRAY)
      doc.text(row.label, margin + 2, y)

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...DARK)
      doc.text(row.value, valueX, y, { maxWidth: pageW - valueX - margin })
      y += 7
    })

    y += 6
  })

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(...LGRAY)
  doc.text('Full Playing Conditions available from your club.', margin, y + 2)

  return URL.createObjectURL(doc.output('blob'))
}
