import { jsPDF } from 'jspdf'
import type { Match } from '../api/matchApi'
import type { MatchSide } from '../api/matchSideApi'
import type { Team } from '../api/teamApi'
import type { Player } from '../api/playerApi'
import type { SquadMember } from '../api/teamSquadApi'

// docs/specs/030-team-sheet-communication.md — the single home for all jsPDF usage in this
// feature (per the spec's Rollout Notes), ported from the legacy Cricket Legend app's
// `ui/src/utils/matchPdf.ts`'s `generateTeamsheetPdf`, adapted to this repo's real Match/
// MatchSide/Team/Player shapes rather than legacy's own types. Colours below are this theme's own
// tokens (ui/src/theme.ts) converted to RGB tuples, not legacy's hard-coded palette.
const DARK: [number, number, number] = [20, 35, 28] // theme.palette.text.primary (#14231c)
const MID: [number, number, number] = [47, 110, 79] // theme.palette.primary.main (#2f6e4f)
const WHITE: [number, number, number] = [255, 255, 255]
const GRAY: [number, number, number] = [82, 101, 92] // theme.palette.text.secondary (#52655c)
const LGRAY: [number, number, number] = [150, 165, 158]
const TWELFTH_FILL: [number, number, number] = [247, 240, 210]
const TWELFTH_BORDER: [number, number, number] = [183, 121, 31] // theme.palette.warning.main (#b7791f)

// A resolved side ready to print — assembled by the caller (MatchCard) from listMatchSides,
// listSquad, and the club's teamsById map. `team` is always present, even for a free-text
// opponent side with no real Team record — the caller passes a lightweight placeholder in that
// case (id/sectionId blank, logoUrl null) since only `logoUrl` is ever read from it here;
// `teamName` (not `team.name`) is this module's single source of truth for the display name.
export interface TeamSheetSide {
  team: Team
  teamName: string
  side: MatchSide | undefined
  squad: SquadMember[]
}

// fetch → blob → FileReader.readAsDataURL, exactly matching legacy's own loadImageBase64 — kept
// local and unexported since nothing else in this repo currently needs a base64 image loader.
// Resolves null on any failure (network error, non-OK response, or a FileReader error) so a
// missing/broken team logo never throws or blocks PDF generation.
async function loadImageBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    const blob = await response.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

interface RosterEntry {
  name: string
  battingOrder: number
  isCaptain: boolean
  isWicketKeeper: boolean
  // docs/specs/031-jersey-numbers.md: this side's per-team-squad number for this player, resolved
  // via the same squadById join isCaptain/isWicketKeeper already use — null when unset (a squad
  // member may never have been assigned one).
  squadJerseyNumber: number | null
}

// A printed team sheet is a club-admin-to-team-facing artifact, not an internal admin screen — a
// raw UUID here would be a visible defect, so an unresolved id (a data-integrity edge case; the
// squad fetch and the MatchSide's own player ids should always agree in practice) falls back to a
// readable label instead of the id itself.
function playerName(player: Player | undefined): string {
  return player ? `${player.firstName} ${player.lastName}` : 'Unknown player'
}

// Duplicates (deliberately — see docs/plans/030-team-sheet-communication.md's Flag #2) the small
// battingOrder-sort + captain/wicketkeeper/twelfth-man resolution PlayingXiBuilder.tsx already
// does inline. Kept local and unexported rather than extracted into a shared helper, so this
// spec's PDF work doesn't touch already-shipped, tested component code for a ~10-line block.
// Keyed by playerProfileId, not member.id (the TeamSquadMember row's own id, distinct per
// docs/specs/031-jersey-numbers.md) — entry.playerProfileId/captainPlayerId/wicketKeeperPlayerId/
// twelfthManPlayerId are all expressed in terms of a player's identity, not this squad row's id.
function resolveRoster(side: TeamSheetSide): RosterEntry[] {
  const squadById = new Map(side.squad.map((member) => [member.playerProfileId, member]))
  const players = side.side?.players ?? []

  return [...players]
    .sort((a, b) => a.battingOrder - b.battingOrder)
    .map((entry) => ({
      name: playerName(squadById.get(entry.playerProfileId)),
      battingOrder: entry.battingOrder,
      isCaptain: side.side?.captainPlayerId === entry.playerProfileId,
      isWicketKeeper: side.side?.wicketKeeperPlayerId === entry.playerProfileId,
      squadJerseyNumber: squadById.get(entry.playerProfileId)?.squadJerseyNumber ?? null,
    }))
}

function resolveTwelfthMan(side: TeamSheetSide): string | null {
  const twelfthManPlayerId = side.side?.twelfthManPlayerId
  if (!twelfthManPlayerId) {
    return null
  }
  const player = side.squad.find((candidate) => candidate.playerProfileId === twelfthManPlayerId)
  return playerName(player)
}

// Builds an A4 portrait team-sheet PDF for the given (already scope-filtered) sides and returns
// an object URL for it — the caller owns opening it (e.g. window.open(url, '_blank')). `sides`
// drives both the header title (joined team names, in the order given) and which team sections
// get rendered, so a single-side scope naturally produces a single-side header and section.
export async function generateTeamSheetPdf(match: Match, sides: TeamSheetSide[], subtitle: string): Promise<string> {
  void match // Retained in the signature per this util's fixed public API — subtitle/sides carry
  // every field this function currently renders; match itself isn't read directly today.

  const logos = await Promise.all(
    sides.map((side) => (side.team.logoUrl ? loadImageBase64(side.team.logoUrl) : Promise.resolve(null))),
  )

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 16
  const contentW = pageW - margin * 2
  const footerH = 16
  const safeBottom = pageH - footerH - 4

  const drawFooter = () => {
    doc.setFillColor(...DARK)
    doc.rect(0, pageH - footerH, pageW, footerH, 'F')
    doc.setFillColor(...MID)
    doc.rect(0, pageH - footerH, pageW, 1.5, 'F')
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(
      `Team sheet generated ${new Date().toLocaleDateString('en-ZA')}`,
      pageW / 2,
      pageH - footerH / 2 + 2,
      { align: 'center' },
    )
  }

  let y = 40

  // Page-break-aware helper, matching legacy's own `checkPage()`: redraws the footer band and
  // starts a fresh page whenever the next piece of content would overflow the safe content area.
  const checkPage = (needed: number) => {
    if (y + needed > safeBottom) {
      drawFooter()
      doc.addPage()
      y = 16
    }
  }

  // Header band
  doc.setFillColor(...DARK)
  doc.rect(0, 0, pageW, 30, 'F')
  doc.setFillColor(...MID)
  doc.rect(0, 30, pageW, 1.5, 'F')

  const title = sides.map((side) => side.teamName).join(' vs ') || 'Team Sheet'

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(title, margin, 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 225, 210)
  doc.text(subtitle, margin, 22)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...LGRAY)
  doc.text('TEAM SHEET', pageW - margin, 13, { align: 'right' })

  for (let sideIndex = 0; sideIndex < sides.length; sideIndex++) {
    const side = sides[sideIndex]
    const roster = resolveRoster(side)
    const twelfthMan = resolveTwelfthMan(side)
    const logoB64 = logos[sideIndex]

    checkPage(15 + Math.min(roster.length, 3) * 9)

    // Team section header bar
    const headerH = 12
    doc.setFillColor(...MID)
    doc.roundedRect(margin, y, contentW, headerH, 2, 2, 'F')

    if (logoB64) {
      try {
        doc.addImage(logoB64, 'PNG', margin + 2, y + 1, 10, 10)
      } catch {
        // A broken/unsupported image never blocks the rest of the PDF — fall through without the
        // logo rather than throwing.
      }
    } else {
      doc.setFillColor(...DARK)
      doc.roundedRect(margin + 2, y + 1, 10, 10, 1.5, 1.5, 'F')
      doc.setTextColor(...WHITE)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(side.teamName.charAt(0).toUpperCase() || '?', margin + 7, y + 8, { align: 'center' })
    }

    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(side.teamName.toUpperCase(), margin + 15, y + headerH / 2 + 2.5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(200, 225, 210)
    doc.text(`Playing XI (${roster.length})`, pageW - margin - 5, y + headerH / 2 + 2.5, { align: 'right' })

    y += headerH + 2

    if (roster.length === 0) {
      checkPage(10)
      doc.setTextColor(...LGRAY)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.text('Team not yet announced', margin + 4, y + 6)
      y += 12
    } else {
      const rowH = 9
      roster.forEach((entry, index) => {
        checkPage(rowH)

        if (index % 2 === 0) {
          doc.setFillColor(244, 250, 245)
          doc.rect(margin, y, contentW, rowH, 'F')
        }

        doc.setTextColor(...LGRAY)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.text(String(index + 1), margin + 5, y + rowH / 2 + 2.2, { align: 'right' })

        const suffix = [entry.isCaptain ? '(C)' : null, entry.isWicketKeeper ? '(WK)' : null]
          .filter(Boolean)
          .join(' ')

        // docs/specs/031-jersey-numbers.md: prefix the printed name with "#N" when this side's
        // squad has one, matching PlayingXiBuilder's own "#N" convention — left unnumbered when
        // unset (no stray "#").
        const numberedName =
          entry.squadJerseyNumber != null ? `#${entry.squadJerseyNumber} ${entry.name}` : entry.name

        doc.setTextColor(...DARK)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.text([numberedName, suffix].filter(Boolean).join(' '), margin + 9, y + rowH / 2 + 2.5)

        y += rowH
      })
    }

    if (twelfthMan) {
      checkPage(13)
      y += 2
      doc.setFillColor(...TWELFTH_FILL)
      doc.roundedRect(margin, y, contentW, 9, 1.5, 1.5, 'F')
      doc.setDrawColor(...TWELFTH_BORDER)
      doc.setLineWidth(0.3)
      doc.roundedRect(margin, y, contentW, 9, 1.5, 1.5, 'S')

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...GRAY)
      doc.text('12th Man:', margin + 4, y + 6)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(...DARK)
      doc.text(twelfthMan, margin + 24, y + 6)
      y += 12
    }

    y += 8
  }

  drawFooter()
  return URL.createObjectURL(doc.output('blob'))
}
