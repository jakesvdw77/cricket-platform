// docs/specs/114-share-result.md (Logos and footer): fixed-slot arithmetic for the logos of the PDF, Image and TV
// outputs. Pure; no React, no DOM. Works in any unit (canvas pixels, PDF millimetres): everything is a share of the
// shorter side. Slots are square boxes at fixed places, so nothing overlaps or shifts; a logo that is absent or off gets
// no rectangle (its slot collapses and the text beside it takes the room); the logo itself is fitted inside its box with
// its aspect ratio kept (fitLogo), never stretched.

export const MAX_SHARE_SPONSORS = 4

export type LogoLayoutFormat = 'PDF' | 'IMAGE' | 'TV'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface LogoLayoutInput {
  format: LogoLayoutFormat
  // The canvas, or the PDF page area, in the unit the caller draws in.
  width: number
  height: number
  // Whether the club and league logo are shown (switch on AND a logo exists).
  club: boolean
  league: boolean
  // The Team logos switch: both slots exist (a side with no logo gets the initial tile in its slot).
  teamLogos: boolean
  // How many sponsor logos are shown (capped at MAX_SHARE_SPONSORS).
  sponsors: number
  // The Footer line switch: reserves the line for the web address and the platform credit.
  footerLine: boolean
}

export interface LogoLayout {
  margin: number
  club: Rect | null
  league: Rect | null
  // The room left in the header band for the title, between the club and league slots.
  headerText: Rect
  home: Rect | null
  away: Rect | null
  // The room for each team's name beside its logo slot (the full half width when there is no logo slot).
  homeName: Rect
  awayName: Rect
  sponsorLabel: Rect | null
  sponsors: Rect[]
  footerText: Rect | null
  // What is left between the team row and the sponsor strip or footer, for the real content.
  content: Rect
}

// Box sizes as a share of the shorter side, per format.
const BOX = {
  PDF: { header: 0.09, team: 0.1, sponsor: 0.07 },
  IMAGE: { header: 0.1, team: 0.17, sponsor: 0.11 },
  TV: { header: 0.11, team: 0.18, sponsor: 0.12 },
} as const

const MARGIN = 0.04
const GAP = 0.02
const LABEL_HEIGHT = 0.04
const FOOTER_HEIGHT = 0.045
// A canvas this much taller than wide (the Story size) wraps its sponsor strip to two rows.
const TWO_ROW_ASPECT = 1.7

export function layoutLogos(input: LogoLayoutInput): LogoLayout {
  const { width, height } = input
  const unit = Math.min(width, height)
  const sizes = BOX[input.format]
  const margin = unit * MARGIN
  const gap = unit * GAP
  const headerBox = unit * sizes.header
  const teamBox = unit * sizes.team
  const innerWidth = width - margin * 2

  // Header band: club on the left, league on the right, the title between them.
  const club = input.club ? { x: margin, y: margin, width: headerBox, height: headerBox } : null
  const league = input.league ? { x: width - margin - headerBox, y: margin, width: headerBox, height: headerBox } : null
  const headerLeft = club ? club.x + club.width + gap : margin
  const headerRight = league ? league.x - gap : width - margin
  const headerText = { x: headerLeft, y: margin, width: Math.max(0, headerRight - headerLeft), height: headerBox }
  const headerBottom = margin + (club || league ? headerBox : 0)

  // Team row: home logo on the left, away logo on the right, names beside them up to the centre.
  const teamTop = headerBottom + (club || league ? gap : 0)
  const home = input.teamLogos ? { x: margin, y: teamTop, width: teamBox, height: teamBox } : null
  const away = input.teamLogos ? { x: width - margin - teamBox, y: teamTop, width: teamBox, height: teamBox } : null
  const rowHeight = input.teamLogos ? teamBox : unit * 0.08
  const centre = width / 2
  const homeNameLeft = home ? home.x + home.width + gap : margin
  const awayNameRight = away ? away.x - gap : width - margin
  const homeName = { x: homeNameLeft, y: teamTop, width: Math.max(0, centre - gap / 2 - homeNameLeft), height: rowHeight }
  const awayName = { x: centre + gap / 2, y: teamTop, width: Math.max(0, awayNameRight - centre - gap / 2), height: rowHeight }
  const teamBottom = teamTop + rowHeight

  // Bottom stack, from the bottom up: footer line, then the sponsor strip with its label.
  let bottom = height - margin
  const footerText = input.footerLine
    ? { x: margin, y: bottom - unit * FOOTER_HEIGHT, width: innerWidth, height: unit * FOOTER_HEIGHT }
    : null
  if (footerText) bottom = footerText.y - gap

  const count = Math.min(Math.max(0, Math.floor(input.sponsors)), MAX_SHARE_SPONSORS)
  const sponsors: Rect[] = []
  let sponsorLabel: Rect | null = null
  if (count > 0) {
    const rows = height / width >= TWO_ROW_ASPECT && count > 1 ? 2 : 1
    const perRow = Math.ceil(count / rows)
    const box = Math.min(unit * sizes.sponsor, (innerWidth - gap * (perRow - 1)) / perRow)
    const stripHeight = rows * box + (rows - 1) * gap
    const top = bottom - stripHeight
    for (let index = 0; index < count; index += 1) {
      const row = Math.floor(index / perRow)
      const inRow = row === rows - 1 ? count - perRow * (rows - 1) : perRow
      const rowWidth = inRow * box + (inRow - 1) * gap
      sponsors.push({
        x: (width - rowWidth) / 2 + (index - row * perRow) * (box + gap),
        y: top + row * (box + gap),
        width: box,
        height: box,
      })
    }
    sponsorLabel = { x: margin, y: top - unit * LABEL_HEIGHT, width: innerWidth, height: unit * LABEL_HEIGHT }
    bottom = sponsorLabel.y - gap
  }

  const contentTop = teamBottom + gap
  const content = { x: margin, y: contentTop, width: innerWidth, height: Math.max(0, bottom - contentTop) }
  return { margin, club, league, headerText, home, away, homeName, awayName, sponsorLabel, sponsors, footerText, content }
}

// A logo of the given natural size fitted inside its square slot, centred, aspect ratio kept (never stretched, never
// larger than the slot). A missing or zero size fills the slot.
export function fitLogo(slot: Rect, naturalWidth: number, naturalHeight: number): Rect {
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) return { ...slot }
  const scale = Math.min(slot.width / naturalWidth, slot.height / naturalHeight)
  const width = naturalWidth * scale
  const height = naturalHeight * scale
  return { x: slot.x + (slot.width - width) / 2, y: slot.y + (slot.height - height) / 2, width, height }
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}
