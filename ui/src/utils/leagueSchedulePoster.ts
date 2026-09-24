import type { Match } from '../api/matchApi'
import type { Team } from '../api/teamApi'

// docs/specs/051-league-schedule-sharing.md — this codebase's first Canvas2D/PNG image generator
// (jspdf is the only prior export library in ui/package.json). No existing component to extend,
// so this is genuinely new drawing code, not a port of an existing pattern the way
// leagueSchedulePdf.ts mirrors teamSheetPdf.ts.
const POSTER_SIZE = 1080
const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized
  const value = parseInt(expanded, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function darkenedRgb(rgb: [number, number, number], factor: number): string {
  const [r, g, b] = rgb
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`
}

interface ResolvedSide {
  name: string
  logoUrl: string | null
}

// Duplicates LeagueFixtures.tsx's own (unexported) resolveSide — deliberately, matching
// leagueSchedulePdf.ts's/teamSheetPdf.ts's own established precedent of small pure resolution
// helpers being independently duplicated per consumer rather than centralized, so each file stays
// a self-contained, independently readable unit.
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

// A distinct small loader from leagueSchedulePdf.ts's/teamSheetPdf.ts's own loadImageBase64:
// those feed jsPDF's addImage (which wants a base64 data URL), this feeds Canvas2D's drawImage
// (which wants a drawable image element) — fetch → blob → object URL → HTMLImageElement, resolving
// null on any failure so a missing/broken team logo never throws or blocks poster generation.
async function loadImageElement(url: string): Promise<HTMLImageElement | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const image = await new Promise<HTMLImageElement | null>((resolve) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => resolve(null)
      element.src = objectUrl
    })
    URL.revokeObjectURL(objectUrl)
    return image
  } catch {
    return null
  }
}

// e.g. "Sat, 14 Mar 2026" — duplicates LeagueFixtures.tsx's own (unexported) dateHeading.
function dateHeading(iso: string): string {
  const date = new Date(iso)
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
  const month = date.toLocaleDateString(undefined, { month: 'short' })
  return `${weekday}, ${date.getDate()} ${month} ${date.getFullYear()}`
}

// Small avatar square — a loaded logo image if one is available, else a translucent-white square
// with the side's own initial, the poster's own equivalent of leagueSchedulePdf.ts's
// drawAvatarOrInitials. Deliberately drawn with fillRect/fillText/drawImage only (no arc/path
// calls) so it stays inside the exact Canvas2D primitives this spec's own Test Plan calls out as
// the new mocking precedent.
function drawAvatar(
  ctx: CanvasRenderingContext2D,
  side: ResolvedSide,
  x: number,
  y: number,
  size: number,
  imagesByUrl: Map<string, HTMLImageElement | null>,
): void {
  const image = side.logoUrl ? (imagesByUrl.get(side.logoUrl) ?? null) : null
  if (image) {
    ctx.drawImage(image, x, y, size, size)
    return
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)'
  ctx.fillRect(x, y, size, size)
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${Math.round(size * 0.5)}px ${FONT_STACK}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(side.name.charAt(0).toUpperCase() || '?', x + size / 2, y + size / 2 + 1)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

export interface LeagueSchedulePosterTeamFilter {
  teamId: string
  teamName: string
}

// Builds a square (1:1) PNG poster of the league+season's upcoming fixtures and returns an object
// URL for it — the caller wraps it in a forced download (this codebase's first, since a raw image
// blob URL has nothing meaningful to open in a new tab). Same `teamFilter` shape/pre-filtering as
// generateLeagueSchedulePdf, so both generators are driven by the same dialog state. The gradient
// background is derived from `primaryColorHex` (the caller's own `useTheme().palette.primary.main`,
// re-tinted per club via `withClubBranding()` like every other themed surface) rather than a fixed
// palette baked into this file — the same posture LeagueFixtures/RecordCard already have.
export async function generateLeagueSchedulePoster(
  matches: Match[],
  teamsById: Map<string, Team>,
  leagueName: string,
  seasonLabel: string,
  teamFilter: LeagueSchedulePosterTeamFilter | null,
  primaryColorHex: string,
): Promise<string> {
  const scopedMatches = teamFilter
    ? matches.filter((m) => m.homeTeamId === teamFilter.teamId || m.awayTeamId === teamFilter.teamId)
    : matches

  const upcoming = [...scopedMatches]
    .filter((match) => new Date(match.matchDate).getTime() >= Date.now())
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate))
    .slice(0, 6)

  const logoUrls = new Set<string>()
  upcoming.forEach((match) => {
    const home = resolveSide(match.homeTeamId, match.homeTeamName, match.homeTeamLogoUrl, teamsById)
    const away = resolveSide(match.awayTeamId, match.awayTeamName, match.awayTeamLogoUrl, teamsById)
    if (home.logoUrl) {
      logoUrls.add(home.logoUrl)
    }
    if (away.logoUrl) {
      logoUrls.add(away.logoUrl)
    }
  })
  const imageEntries = await Promise.all(
    Array.from(logoUrls).map(async (url) => [url, await loadImageElement(url)] as const),
  )
  const imagesByUrl = new Map(imageEntries)

  const canvas = document.createElement('canvas')
  canvas.width = POSTER_SIZE
  canvas.height = POSTER_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error("Couldn't generate the poster image.")
  }

  const rgb = hexToRgb(primaryColorHex)

  // Dark-green gradient sweep, top-left (darkest) to bottom-right (lighter but still dark) —
  // both stops derived from the club's own real primary colour, never a hardcoded palette.
  const gradient = ctx.createLinearGradient(0, 0, POSTER_SIZE, POSTER_SIZE)
  gradient.addColorStop(0, darkenedRgb(rgb, 0.55))
  gradient.addColorStop(1, darkenedRgb(rgb, 0.24))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, POSTER_SIZE, POSTER_SIZE)

  // Subtle dot-grid texture — tiny translucent-white squares on a fixed spacing, drawn with
  // fillRect (not arc) so every draw call in this file stays within the fillRect/fillText/
  // drawImage set this spec's Test Plan calls out as the new Canvas2D mocking precedent.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
  const dotSpacing = 36
  for (let gx = dotSpacing / 2; gx < POSTER_SIZE; gx += dotSpacing) {
    for (let gy = dotSpacing / 2; gy < POSTER_SIZE; gy += dotSpacing) {
      ctx.fillRect(gx, gy, 2, 2)
    }
  }

  // Header — league name, then a season/team-scope subtitle.
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold 56px ${FONT_STACK}`
  ctx.fillText(leagueName, 64, 130, POSTER_SIZE - 128)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)'
  ctx.font = `28px ${FONT_STACK}`
  const subtitle = teamFilter ? `${teamFilter.teamName} — ${seasonLabel}` : `${seasonLabel} — Full Schedule`
  ctx.fillText(subtitle, 64, 172, POSTER_SIZE - 128)

  // Upcoming match rows.
  const rowX = 64
  const rowW = POSTER_SIZE - 128
  const avatarSize = 56
  const rowH = 112
  let rowY = 240

  if (upcoming.length === 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.font = `26px ${FONT_STACK}`
    ctx.fillText('No upcoming fixtures scheduled.', rowX, rowY + 24)
  } else {
    upcoming.forEach((match) => {
      const home = resolveSide(match.homeTeamId, match.homeTeamName, match.homeTeamLogoUrl, teamsById)
      const away = resolveSide(match.awayTeamId, match.awayTeamName, match.awayTeamLogoUrl, teamsById)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.fillRect(rowX, rowY, rowW, rowH - 16)

      drawAvatar(ctx, home, rowX + 20, rowY + 16, avatarSize, imagesByUrl)
      drawAvatar(ctx, away, rowX + rowW - avatarSize - 20, rowY + 16, avatarSize, imagesByUrl)

      ctx.fillStyle = '#ffffff'
      ctx.font = `bold 30px ${FONT_STACK}`
      ctx.textAlign = 'center'
      ctx.fillText(`${home.name}  vs  ${away.name}`, rowX + rowW / 2, rowY + 42, rowW - avatarSize * 2 - 80)

      const time = new Date(match.matchDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const venueSuffix = match.venue ? ` · ${match.venue}` : ''
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
      ctx.font = `22px ${FONT_STACK}`
      ctx.fillText(
        `${dateHeading(match.matchDate)} · ${time}${venueSuffix}`,
        rowX + rowW / 2,
        rowY + 76,
        rowW - avatarSize * 2 - 80,
      )
      ctx.textAlign = 'left'

      rowY += rowH
    })
  }

  // Footer mark.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.font = `22px ${FONT_STACK}`
  ctx.fillText('Generated by Cricket Legend', rowX, POSTER_SIZE - 48)

  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Couldn't generate the poster image."))
        return
      }
      resolve(URL.createObjectURL(blob))
    }, 'image/png')
  })
}
