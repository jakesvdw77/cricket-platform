// The brand icon registry (docs/specs/078-brand-icon-set.md). The only module that touches
// `src/icons`: Vite resolves every SVG to a hashed asset URL (`?no-inline` stops Vite
// turning the small ones into data URIs in the JS bundle), so a new file
// dropped into a group folder is picked up automatically at runtime.
const modules = import.meta.glob('../../icons/**/*.svg', {
  eager: true,
  query: '?no-inline',
  import: 'default',
}) as Record<string, string>

const PREFIX = '../../icons/'

// 'nav/teams' -> '/assets/teams-abc123.svg'
export const brandIconUrls: Record<string, string> = Object.fromEntries(
  Object.entries(modules).map(([path, url]) => [path.slice(PREFIX.length).replace(/\.svg$/, ''), url]),
)

// Written out so call sites get a compile-time checked name; BrandIcon.test.tsx fails when this
// list and the files in `src/icons` drift apart.
export const BRAND_ICON_NAMES = [
  'actions/announce-team',
  'brand/favicon',
  'field/field-pitch',
  'field/field-topdown',
  'nav/availability-player',
  'nav/availability-polls',
  'nav/availability-team',
  'nav/club-profile',
  'nav/club-structure',
  'nav/communication',
  'nav/cricket-leagues',
  'nav/cricket-players',
  'nav/match-results',
  'nav/notifications',
  'nav/overview-home',
  'nav/photo-gallery',
  'nav/roles-permissions',
  'nav/scorecards',
  'nav/season-cricket',
  'nav/squads',
  'nav/teams',
  'nav/upcoming-matches',
  'people/avatar-female',
  'people/avatar-male',
  'roles/all-rounder',
  'roles/batter',
  'roles/bowler',
  'roles/captain',
  'roles/wicketkeeper',
  'stats/scorecard',
  'stats/stats-club',
  'stats/stats-player',
  'stats/stats-team',
  'umpire/umpire-bye',
  'umpire/umpire-dead-ball',
  'umpire/umpire-four',
  'umpire/umpire-free-hit',
  'umpire/umpire-leg-bye',
  'umpire/umpire-new-ball',
  'umpire/umpire-no-ball',
  'umpire/umpire-out',
  'umpire/umpire-six',
  'umpire/umpire-third-umpire',
  'umpire/umpire-wide',
] as const

export type BrandIconName = (typeof BRAND_ICON_NAMES)[number]

// Gender avatar for a player with no photo, or null when no gender is recorded (callers then keep
// their initials fallback).
export function genderAvatarIcon(gender: string | null | undefined): BrandIconName | null {
  if (gender === 'MALE') return 'people/avatar-male'
  if (gender === 'FEMALE') return 'people/avatar-female'
  return null
}

// Resolved asset URL of a brand icon, for places that need a plain `src` (e.g. an MUI Avatar).
export function brandIconSrc(name: BrandIconName): string {
  return brandIconUrls[name]
}

// Avatar image for a player: their photo, else the gender icon, else undefined (initials show).
export function playerAvatarSrc(photoUrl: string | null | undefined, gender: string | null | undefined): string | undefined {
  if (photoUrl) return photoUrl
  const icon = genderAvatarIcon(gender)
  return icon ? brandIconSrc(icon) : undefined
}
