import type { Match } from '../api/matchApi'
import type { Team } from '../api/teamApi'
import type { LeagueShareModel, LeagueShareSide } from './share/shareLeagueData'

// docs/specs/051-league-schedule-sharing.md, this codebase's first Canvas2D/PNG image generator
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

// Duplicates the retired LeagueFixtures list's own resolveSide, deliberately, matching
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
// (which wants a drawable image element), fetch → blob → object URL → HTMLImageElement, resolving
// null on any failure so a missing/broken team logo never throws or blocks poster generation.
async function loadImageElement(url: string): Promise<HTMLImageElement | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    const blob = await response.blob()
    // A data URL, not a blob URL: Safari can draw a blank logo when the blob URL is revoked right after the image loads.
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
    if (!dataUrl) return null
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => resolve(null)
      element.src = dataUrl
    })
  } catch {
    return null
  }
}

// e.g. "Sat, 14 Mar 2026", duplicates the retired LeagueFixtures list's own dateHeading.
function dateHeading(iso: string): string {
  const date = new Date(iso)
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
  const month = date.toLocaleDateString(undefined, { month: 'short' })
  return `${weekday}, ${date.getDate()} ${month} ${date.getFullYear()}`
}

// Small avatar square, a loaded logo image if one is available, else a translucent-white square
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

// The dark gradient sweep and dot-grid texture every poster starts from, derived from the club's own primary colour.
function paintPosterBackground(ctx: CanvasRenderingContext2D, primaryColorHex: string): void {
  const rgb = hexToRgb(primaryColorHex)
  const gradient = ctx.createLinearGradient(0, 0, POSTER_SIZE, POSTER_SIZE)
  gradient.addColorStop(0, darkenedRgb(rgb, 0.55))
  gradient.addColorStop(1, darkenedRgb(rgb, 0.24))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, POSTER_SIZE, POSTER_SIZE)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
  const dotSpacing = 36
  for (let gx = dotSpacing / 2; gx < POSTER_SIZE; gx += dotSpacing) {
    for (let gy = dotSpacing / 2; gy < POSTER_SIZE; gy += dotSpacing) {
      ctx.fillRect(gx, gy, 2, 2)
    }
  }
}

function posterBlobUrl(canvas: HTMLCanvasElement): Promise<string> {
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

export interface LeagueSchedulePosterTeamFilter {
  teamId: string
  teamName: string
}

// Builds a square (1:1) PNG poster of the league+season's upcoming fixtures and returns an object
// URL for it, the caller wraps it in a forced download (this codebase's first, since a raw image
// blob URL has nothing meaningful to open in a new tab). Same `teamFilter` shape/pre-filtering as
// generateLeagueSchedulePdf, so both generators are driven by the same dialog state. The gradient
// background is derived from `primaryColorHex` (the caller's own `useTheme().palette.primary.main`,
// re-tinted per club via `withClubBranding()` like every other themed surface) rather than a fixed
// palette baked into this file, the same posture RecordCard already has.
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

  paintPosterBackground(ctx, primaryColorHex)

  // Header, league name, then a season/team-scope subtitle.
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

  return posterBlobUrl(canvas)
}

export interface LeagueSharePosterOptions {
  // The Team logos switch: a side with no logo always gets the initial tile.
  teamLogos: boolean
  // The "Generated by Cricket Legend" mark at the bottom (default on; the Player Hub poster leaves it off).
  footer?: boolean
  // For the test: the day "upcoming" is counted from.
  now?: Date
  // The logos the other picture templates have: shown in the header (club, league, league affiliation) and as the sponsor strip.
  logos?: { clubUrl?: string | null; leagueUrl?: string | null; leagueAffiliationUrl?: string | null; sponsorUrls?: string[] }
  // The Text Size step as a factor (1 = Auto): the rows and their text grow with it, so fewer rows fit and the poster says "Next N".
  textScale?: number
  // The heading line: the season name (default on, as before), the league's start to finish dates (default off) and the club's name (default off).
  season?: boolean
  dates?: boolean
  clubName?: boolean
  // The "Our team" tag on the club's own teams in the Teams list (default on).
  ourTeamTag?: boolean
}

// "19 Nov 2026 to 21 Nov 2026" from the league's start and end key dates; one alone reads "Starts ..." or "Ends ...".
function durationText(model: LeagueShareModel): string | null {
  const short = (iso: string | undefined) => {
    const bare = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null
    return bare ? new Date(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3])).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null
  }
  const start = short(model.keyDates.find((date) => date.kind === 'LEAGUE_START')?.dateIso)
  const end = short(model.keyDates.find((date) => date.kind === 'LEAGUE_END')?.dateIso)
  if (start && end) return `${start} to ${end}`
  if (start) return `Starts ${start}`
  return end ? `Ends ${end}` : null
}

const CONTENT_LEFT = 64
const CONTENT_WIDTH = POSTER_SIZE - 128
const CONTENT_TOP = 232
const CONTENT_BOTTOM = POSTER_SIZE - 96

// docs/specs/122-league-sharing.md (Poster): the square poster for the Teams, Schedule and Key dates contents of a
// LeagueShareModel (the contents the Poster format supports; others ticked are ignored here, the dialog never offers the
// Poster for them). The same background, fonts and avatar tiles as the schedule poster above. Names come from the model
// only. As many rows as fit are drawn; a schedule that does not all fit is headed "Next N Matches" (spec 151), the other lists count the rest ("and 4 more"). Drawn with fillRect/fillText/drawImage only.
export async function generateLeagueSharePoster(
  model: LeagueShareModel,
  primaryColorHex: string,
  options: LeagueSharePosterOptions,
): Promise<string> {
  const nowMs = (options.now ?? new Date()).getTime()
  const upcoming = model.schedule.filter((fixture) => new Date(fixture.startsAt).getTime() >= nowMs)
  const fixtures = upcoming.length > 0 ? upcoming : model.schedule
  const wantTeams = model.contents.includes('TEAMS')
  const wantSchedule = model.contents.includes('SCHEDULE')
  const wantKeyDates = model.contents.includes('KEY_DATES')

  const logoUrls = new Set<string>()
  if (options.teamLogos) {
    if (wantTeams) model.teams.forEach((team) => team.logoUrl && logoUrls.add(team.logoUrl))
    if (wantSchedule) {
      fixtures.forEach((fixture) => {
        if (fixture.home.logoUrl) logoUrls.add(fixture.home.logoUrl)
        if (fixture.away.logoUrl) logoUrls.add(fixture.away.logoUrl)
      })
    }
  }
  const extra = options.logos ?? {}
  const sponsorUrls = (extra.sponsorUrls ?? []).slice(0, 4)
  ;[extra.clubUrl, extra.leagueUrl, extra.leagueAffiliationUrl, ...sponsorUrls].forEach((url) => url && logoUrls.add(url))
  const imageEntries = await Promise.all(Array.from(logoUrls).map(async (url) => [url, await loadImageElement(url)] as const))
  const imagesByUrl = new Map(imageEntries)

  const canvas = document.createElement('canvas')
  canvas.width = POSTER_SIZE
  canvas.height = POSTER_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error("Couldn't generate the poster image.")
  }
  paintPosterBackground(ctx, primaryColorHex)

  // Header logos at the right, from the edge in: league, league affiliation, club (each only when set and loaded); the title keeps the rest.
  const headerLogos = [extra.leagueUrl, extra.leagueAffiliationUrl, extra.clubUrl]
    .map((url) => (url ? (imagesByUrl.get(url) ?? null) : null))
    .filter((image): image is HTMLImageElement => image !== null)
  const logoBox = 104
  headerLogos.forEach((image, index) => {
    const x = CONTENT_LEFT + CONTENT_WIDTH - logoBox - index * (logoBox + 14)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x, 40, logoBox, logoBox)
    const scale = Math.min((logoBox - 14) / (image.naturalWidth || image.width), (logoBox - 14) / (image.naturalHeight || image.height))
    const w = (image.naturalWidth || image.width) * scale
    const h = (image.naturalHeight || image.height) * scale
    ctx.drawImage(image, x + (logoBox - w) / 2, 40 + (logoBox - h) / 2, w, h)
  })
  const titleWidth = CONTENT_WIDTH - (headerLogos.length > 0 ? headerLogos.length * (logoBox + 14) + 10 : 0)
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold 56px ${FONT_STACK}`
  ctx.fillText(model.league.name, CONTENT_LEFT, 130, titleWidth)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)'
  ctx.font = `28px ${FONT_STACK}`
  ctx.fillText([model.teamName, options.season === false ? null : model.season?.label, options.dates ? durationText(model) : null, options.clubName ? model.clubName : null].filter(Boolean).join(' — '), CONTENT_LEFT, 172, titleWidth)

  // The sponsor strip sits between the lists and the footer line; the lists give it the room.
  const sponsorImages = sponsorUrls.map((url) => imagesByUrl.get(url) ?? null).filter((image): image is HTMLImageElement => image !== null)
  const stripHeight = sponsorImages.length > 0 ? 112 : 0
  const contentBottom = CONTENT_BOTTOM - stripHeight
  // The Text Size step grows the rows and their text; fewer then fit.
  const ts = Math.min(Math.max(1, options.textScale ?? 1), 1.4)

  // The room is shared between the ticked contents: each heading, then rows while they fit its share.
  const sections = [wantTeams, wantSchedule, wantKeyDates].filter(Boolean).length || 1
  const share = (contentBottom - CONTENT_TOP) / sections
  let top = CONTENT_TOP
  const heading = (label: string) => {
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold 30px ${FONT_STACK}`
    ctx.textAlign = 'left'
    ctx.fillText(label, CONTENT_LEFT, top + 28, CONTENT_WIDTH)
  }
  const more = (count: number, at: number) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.font = `22px ${FONT_STACK}`
    ctx.textAlign = 'left'
    ctx.fillText(`and ${count} more`, CONTENT_LEFT, at + 22, CONTENT_WIDTH)
  }
  const avatar = (side: LeagueShareSide, x: number, y: number, size: number) =>
    drawAvatar(ctx, options.teamLogos ? side : { ...side, logoUrl: null }, x, y, size, imagesByUrl)
  const rowsThatFit = (rowH: number, total: number) => Math.max(0, Math.min(total, Math.floor((share - 44 - 28) / rowH)))

  if (wantTeams) {
    heading('Teams')
    const rowH = 56 * ts
    const fit = rowsThatFit(rowH, model.teams.length)
    model.teams.slice(0, fit).forEach((team, index) => {
      const y = top + 44 + index * rowH
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.fillRect(CONTENT_LEFT, y, CONTENT_WIDTH, rowH - 8)
      avatar({ name: team.name, logoUrl: team.logoUrl, own: team.own }, CONTENT_LEFT + 8, y + 4, rowH - 16)
      ctx.fillStyle = '#ffffff'
      ctx.font = `${team.own ? 'bold ' : ''}${26 * ts}px ${FONT_STACK}`
      ctx.textAlign = 'left'
      ctx.fillText(team.name, CONTENT_LEFT + rowH + 8, y + 33 * ts, CONTENT_WIDTH - rowH - (team.own && options.ourTeamTag !== false ? 160 : 16))
      if (team.own && options.ourTeamTag !== false) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
        ctx.font = `${20 * ts}px ${FONT_STACK}`
        ctx.textAlign = 'right'
        ctx.fillText('Our team', CONTENT_LEFT + CONTENT_WIDTH - 16, y + 32 * ts)
        ctx.textAlign = 'left'
      }
    })
    if (fit < model.teams.length) more(model.teams.length - fit, top + 44 + fit * rowH)
    top += share
  }

  if (wantSchedule) {
    const rowH = 84 * ts
    const fit = rowsThatFit(rowH, fixtures.length)
    // docs/specs/151: a poster is a snapshot, so when the fixtures do not all fit it says what it shows ("Next 8 Matches"), never
    // "and 12 more". The PDF and the texts carry the whole schedule.
    heading(fit < fixtures.length ? `Next ${fit} ${fit === 1 ? 'Match' : 'Matches'}` : 'Schedule')
    fixtures.slice(0, fit).forEach((fixture, index) => {
      const y = top + 44 + index * rowH
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.fillRect(CONTENT_LEFT, y, CONTENT_WIDTH, rowH - 8)
      avatar(fixture.home, CONTENT_LEFT + 12, y + 10 * ts, 52 * ts)
      avatar(fixture.away, CONTENT_LEFT + CONTENT_WIDTH - 12 - 52 * ts, y + 10 * ts, 52 * ts)
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${26 * ts}px ${FONT_STACK}`
      ctx.textAlign = 'center'
      ctx.fillText(`${fixture.home.name}  vs  ${fixture.away.name}`, CONTENT_LEFT + CONTENT_WIDTH / 2, y + 34 * ts, CONTENT_WIDTH - 200 * ts)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
      ctx.font = `${20 * ts}px ${FONT_STACK}`
      const where = fixture.venue ? ` · ${fixture.venue}` : ''
      ctx.fillText(`${fixture.dateLabel}${fixture.timeLabel ? ` · ${fixture.timeLabel}` : ''}${where}`, CONTENT_LEFT + CONTENT_WIDTH / 2, y + 62 * ts, CONTENT_WIDTH - 200 * ts)
      ctx.textAlign = 'left'
    })
    top += share
  }

  if (wantKeyDates) {
    heading('Key dates')
    const rowH = 52 * ts
    const fit = rowsThatFit(rowH, model.keyDates.length)
    model.keyDates.slice(0, fit).forEach((date, index) => {
      const y = top + 44 + index * rowH
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.fillRect(CONTENT_LEFT, y, CONTENT_WIDTH, rowH - 8)
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${24 * ts}px ${FONT_STACK}`
      ctx.textAlign = 'left'
      ctx.fillText(date.label, CONTENT_LEFT + 16, y + 30 * ts, 300)
      ctx.font = `${24 * ts}px ${FONT_STACK}`
      ctx.textAlign = 'right'
      ctx.fillText(date.dateLabel, CONTENT_LEFT + CONTENT_WIDTH - 16, y + 30 * ts, CONTENT_WIDTH - 340)
      ctx.textAlign = 'left'
    })
    if (fit < model.keyDates.length) more(model.keyDates.length - fit, top + 44 + fit * rowH)
  }

  if (sponsorImages.length > 0) {
    // Sponsor logos are mostly wide, so each tile is wider than it is tall.
    const tile = 70
    const tileWidth = 130
    const gap = 16
    const rowWidth = sponsorImages.length * tileWidth + (sponsorImages.length - 1) * gap
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.font = `20px ${FONT_STACK}`
    ctx.textAlign = 'center'
    ctx.fillText('Proudly sponsored by', POSTER_SIZE / 2, contentBottom + 26)
    sponsorImages.forEach((image, index) => {
      const x = (POSTER_SIZE - rowWidth) / 2 + index * (tileWidth + gap)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x, contentBottom + 38, tileWidth, tile)
      const scale = Math.min((tileWidth - 10) / (image.naturalWidth || image.width), (tile - 10) / (image.naturalHeight || image.height))
      const w = (image.naturalWidth || image.width) * scale
      const h = (image.naturalHeight || image.height) * scale
      ctx.drawImage(image, x + (tileWidth - w) / 2, contentBottom + 38 + (tile - h) / 2, w, h)
    })
    ctx.textAlign = 'left'
  }

  if (options.footer !== false) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.font = `22px ${FONT_STACK}`
    ctx.textAlign = 'left'
    ctx.fillText('Generated by Cricket Legend', CONTENT_LEFT, POSTER_SIZE - 48)
  }

  return posterBlobUrl(canvas)
}
