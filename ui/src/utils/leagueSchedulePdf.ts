import { jsPDF } from 'jspdf'
import type { Match } from '../api/matchApi'
import type { Team } from '../api/teamApi'

// docs/specs/051-league-schedule-sharing.md — mirrors teamSheetPdf.ts's own jsPDF structure and
// colour constants (theme.palette tokens converted to RGB tuples) exactly, but renders a
// date-grouped fixture list rather than a squad roster. Deliberately not consolidated with
// teamSheetPdf.ts into a shared "PDF poster" abstraction — see this spec's own Non-goals (a
// squad roster and a fixture list are two genuinely different data shapes, not the ~70% overlap
// docs/standards/frontend.md's extraction threshold requires). Only DARK/MID/WHITE/LGRAY are
// needed here — GRAY/TWELFTH_FILL/TWELFTH_BORDER are team-sheet-specific and stay there.
const DARK: [number, number, number] = [20, 35, 28] // theme.palette.text.primary (#14231c)
const MID: [number, number, number] = [47, 110, 79] // theme.palette.primary.main (#2f6e4f)
const WHITE: [number, number, number] = [255, 255, 255]
const LGRAY: [number, number, number] = [150, 165, 158]

// fetch → blob → FileReader.readAsDataURL — the exact same pattern teamSheetPdf.ts's own
// (unexported) loadImageBase64 uses, duplicated here rather than imported so this file stays a
// self-contained, independently readable unit (docs/plans/030-team-sheet-communication.md's Flag
// #2 — the same reasoning teamSheetWhatsAppText.ts's own doc comment states for playerName/
// resolveRosterLines applies here). Resolves null on any failure so a missing/broken team logo
// never throws or blocks PDF generation.
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

interface ResolvedSide {
  name: string
  logoUrl: string | null
}

// Duplicates LeagueFixtures.tsx's own (unexported) resolveSide — deliberately, matching
// teamSheetPdf.ts's own established precedent of small pure resolution helpers being
// independently duplicated per consumer rather than centralized, so each file stays a
// self-contained, independently readable unit.
function resolveSide(
  teamId: string | null,
  teamName: string | null,
  logoUrl: string | null,
  teamsById: Map<string, Team>,
): ResolvedSide {
  if (teamId) {
    const team = teamsById.get(teamId)
    return { name: team?.name ?? 'Unknown team', logoUrl: team?.logoUrl ?? null }
  }
  return { name: teamName ?? 'TBC', logoUrl }
}

// e.g. "Sat, 14 Mar 2026" — duplicates LeagueFixtures.tsx's own (unexported) dateHeading.
function dateHeading(iso: string): string {
  const date = new Date(iso)
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
  const month = date.toLocaleDateString(undefined, { month: 'short' })
  return `${weekday}, ${date.getDate()} ${month} ${date.getFullYear()}`
}

// Duplicates LeagueFixtures.tsx's own (unexported) dayKey.
function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

function groupByDay(matches: Match[]): [string, Match[]][] {
  const sorted = [...matches].sort((a, b) => a.matchDate.localeCompare(b.matchDate))
  const map = new Map<string, Match[]>()
  sorted.forEach((match) => {
    const key = dayKey(match.matchDate)
    const bucket = map.get(key)
    if (bucket) {
      bucket.push(match)
    } else {
      map.set(key, [match])
    }
  })
  return Array.from(map.entries())
}

// A logo image if one loaded successfully, else a DARK rounded square with the side's own
// initial — the exact fallback shape teamSheetPdf.ts's own team-section header already uses.
function drawAvatarOrInitials(
  doc: jsPDF,
  side: ResolvedSide,
  x: number,
  y: number,
  size: number,
  logosByUrl: Map<string, string | null>,
): void {
  const logoB64 = side.logoUrl ? (logosByUrl.get(side.logoUrl) ?? null) : null
  if (logoB64) {
    try {
      doc.addImage(logoB64, 'PNG', x, y, size, size)
      return
    } catch {
      // A broken/unsupported image never blocks the rest of the PDF — fall through to initials.
    }
  }
  doc.setFillColor(...DARK)
  doc.roundedRect(x, y, size, size, 1.5, 1.5, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text(side.name.charAt(0).toUpperCase() || '?', x + size / 2, y + size / 2 + 2, { align: 'center' })
}

export interface LeagueScheduleTeamFilter {
  teamId: string
  teamName: string
}

// Builds an A4 portrait schedule PDF for the given league+season's matches and returns an object
// URL for it — the caller owns opening it (window.open(url, '_blank')). When `teamFilter` is
// set, the match list is pre-filtered to that team's own fixtures (home or away) before any
// layout math and the header subtitle is scoped to that team — the one code path that serves
// both the "Full Schedule" and "Per Team" scopes, per this spec's own stated goal of not
// repeating the legacy app's three-generator mistake.
export async function generateLeagueSchedulePdf(
  matches: Match[],
  teamsById: Map<string, Team>,
  leagueName: string,
  seasonLabel: string,
  teamFilter: LeagueScheduleTeamFilter | null,
): Promise<string> {
  const scopedMatches = teamFilter
    ? matches.filter((m) => m.homeTeamId === teamFilter.teamId || m.awayTeamId === teamFilter.teamId)
    : matches

  const groups = groupByDay(scopedMatches)

  const logoUrls = new Set<string>()
  scopedMatches.forEach((match) => {
    const home = resolveSide(match.homeTeamId, match.homeTeamName, match.homeTeamLogoUrl, teamsById)
    const away = resolveSide(match.awayTeamId, match.awayTeamName, match.awayTeamLogoUrl, teamsById)
    if (home.logoUrl) {
      logoUrls.add(home.logoUrl)
    }
    if (away.logoUrl) {
      logoUrls.add(away.logoUrl)
    }
  })
  const logoEntries = await Promise.all(
    Array.from(logoUrls).map(async (url) => [url, await loadImageBase64(url)] as const),
  )
  const logosByUrl = new Map(logoEntries)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 16
  const contentW = pageW - margin * 2
  const footerH = 14
  const safeBottom = pageH - footerH - 4

  let pageNumber = 1

  const drawFooter = () => {
    doc.setFillColor(...DARK)
    doc.rect(0, pageH - footerH, pageW, footerH, 'F')
    doc.setFillColor(...MID)
    doc.rect(0, pageH - footerH, pageW, 1.5, 'F')
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(leagueName, margin, pageH - footerH / 2 + 2)
    doc.text(`Page ${pageNumber}`, pageW - margin, pageH - footerH / 2 + 2, { align: 'right' })
  }

  let y = 40

  // Page-break-aware helper, matching teamSheetPdf.ts's own checkPage(): redraws the footer band
  // and starts a fresh page whenever the next piece of content would overflow the safe content
  // area, tracking a self-maintained page counter for the footer's "Page N" label.
  const checkPage = (needed: number) => {
    if (y + needed > safeBottom) {
      drawFooter()
      doc.addPage()
      pageNumber += 1
      y = 16
    }
  }

  // Header band — league name, season (and, when scoped, the team-scope subtitle), drawn once on
  // page 1 only, mirroring teamSheetPdf.ts's own header band shape exactly.
  doc.setFillColor(...DARK)
  doc.rect(0, 0, pageW, 30, 'F')
  doc.setFillColor(...MID)
  doc.rect(0, 30, pageW, 1.5, 'F')

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(leagueName, margin, 13)

  const subtitle = teamFilter ? `${teamFilter.teamName} — ${seasonLabel}` : seasonLabel
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 225, 210)
  doc.text(subtitle, margin, 22)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...LGRAY)
  doc.text('SCHEDULE', pageW - margin, 13, { align: 'right' })

  if (groups.length === 0) {
    doc.setTextColor(...LGRAY)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.text('No fixtures scheduled.', margin, y)
    drawFooter()
    return URL.createObjectURL(doc.output('blob'))
  }

  const avatarSize = 9
  const rowH = 16

  groups.forEach(([, dayMatches]) => {
    checkPage(8 + rowH)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...DARK)
    doc.text(dateHeading(dayMatches[0].matchDate), margin, y + 4)
    y += 8

    dayMatches.forEach((match, index) => {
      checkPage(rowH)

      const home = resolveSide(match.homeTeamId, match.homeTeamName, match.homeTeamLogoUrl, teamsById)
      const away = resolveSide(match.awayTeamId, match.awayTeamName, match.awayTeamLogoUrl, teamsById)
      const time = new Date(match.matchDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      if (index % 2 === 0) {
        doc.setFillColor(244, 250, 245)
        doc.rect(margin, y, contentW, rowH, 'F')
      }

      const rowMidY = y + rowH / 2

      // Home side — logo/initials avatar + name, left-aligned.
      drawAvatarOrInitials(doc, home, margin + 2, rowMidY - avatarSize / 2, avatarSize, logosByUrl)
      doc.setTextColor(...DARK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.text(home.name, margin + 2 + avatarSize + 3, rowMidY + 1)

      // Centre — "VS" + time + venue.
      const centerX = pageW / 2
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(...LGRAY)
      doc.text('VS', centerX, rowMidY - 3, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...DARK)
      doc.text(time, centerX, rowMidY + 2, { align: 'center' })
      if (match.venue) {
        doc.setFontSize(6.5)
        doc.setTextColor(...LGRAY)
        doc.text(match.venue, centerX, rowMidY + 6, { align: 'center' })
      }

      // Away side — name + logo/initials avatar, right-aligned.
      doc.setTextColor(...DARK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.text(away.name, pageW - margin - 2 - avatarSize - 3, rowMidY + 1, { align: 'right' })
      drawAvatarOrInitials(
        doc,
        away,
        pageW - margin - 2 - avatarSize,
        rowMidY - avatarSize / 2,
        avatarSize,
        logosByUrl,
      )

      y += rowH
    })

    y += 4
  })

  drawFooter()
  return URL.createObjectURL(doc.output('blob'))
}
