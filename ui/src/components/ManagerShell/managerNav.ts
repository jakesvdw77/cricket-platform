import type { BrandIconName } from '../BrandIcon'
import { NAV_GLYPH_NAMES } from '../NavItemIcon'
import type { NavGlyphName } from '../NavItemIcon'

// docs/specs/079-manager-shell-and-overview.md: the one source for the manager's navigation. The
// side menu, the phone bottom bar, the Menu sheet and the Overview tile grid all read it.

// A brand icon, or a MUI glyph on a brand-coloured disc (NavItemIcon's glyph names).
export type NavIconName = BrandIconName | NavGlyphName

export function isNavGlyph(name: NavIconName): name is NavGlyphName {
  return (NAV_GLYPH_NAMES as readonly string[]).includes(name)
}

export interface NavItem {
  id: string
  label: string
  // Title on the Overview tile when it differs from the menu label (e.g. "Team Managers & Permissions").
  tileTitle?: string
  description: string
  to: string
  icon: NavIconName
  // Which pathnames highlight this item. A string is a route prefix that matches on a segment
  // boundary (`/manage/players` matches `/manage/players/1/edit`, not `/manage/players-x`); a
  // RegExp is tested as is. `to` itself always counts, and Overview matches `/manage` exactly.
  match?: Array<string | RegExp>
  // True when `to` matches only itself, not the routes beneath it.
  exact?: boolean
  // The bottom-bar tab this item lights when it is active, if not its own id (the hub is one page).
  tabId?: string
}

export interface NavGroup {
  // null renders no heading (the Overview row sits above the named groups).
  label: string | null
  items: NavItem[]
}

export const MANAGER_NAV: NavGroup[] = [
  {
    label: null,
    items: [{ id: 'overview', label: 'Overview', description: 'What needs you today', to: '/manage', icon: 'nav/overview-home' }],
  },
  {
    label: 'Schedule',
    items: [
      {
        id: 'leagues',
        label: 'Leagues',
        description: "Create and manage your club's own leagues",
        to: '/manage/fixtures/leagues',
        icon: 'nav/cricket-leagues',
      },
      {
        id: 'matches',
        label: 'Matches',
        description: 'Schedule fixtures and build playing XIs',
        to: '/manage/fixtures/matches',
        icon: 'nav/upcoming-matches',
      },
      {
        id: 'results',
        label: 'Results',
        description: 'Capture and review match results',
        to: '/manage/results',
        icon: 'nav/match-results',
      },
    ],
  },
  {
    label: 'People',
    items: [
      {
        id: 'teams',
        label: 'Teams',
        description: 'Register teams',
        to: '/manage/teams',
        icon: 'nav/teams',
        // Section-scoped team screens live under /manage/sections/:sectionId/teams.
        match: [/^\/manage\/sections\/[^/]+\/teams(\/|$)/],
      },
      {
        id: 'players',
        label: 'Players',
        description: 'Manage the player roster',
        to: '/manage/players',
        icon: 'nav/cricket-players',
      },
      {
        id: 'availability',
        label: 'Availability',
        description: 'Polls, player availability and match-day cover',
        to: '/manage/availability',
        icon: 'nav/availability-polls',
        // Every Availability page (the hub's Polls, Players and Match-day cover tabs, and the poll,
        // response and new-poll pages) keeps it highlighted.
        match: ['/manage/availability/new', '/manage/availability/group', '/manage/availability/squad', '/manage/section-availability', '/manage/player-availability'],
      },
      { id: 'squads', label: 'Team selection', description: 'Pick the team for each match', to: '/manage/team-selection', icon: 'nav/squads' },
      {
        id: 'communication',
        label: 'Communication',
        description: 'Message the squad',
        to: '/manage/communication',
        icon: 'nav/communication',
      },
    ],
  },
  {
    label: 'Club',
    items: [
      {
        id: 'club-profile',
        label: 'Club profile',
        tileTitle: 'Club Profile',
        description: "Edit your club's details",
        to: '/manage/club-profile',
        icon: 'nav/club-profile',
        // Reached from the Club Profile page, so they keep it highlighted.
        match: ['/manage/club-contacts', '/manage/sponsors', '/manage/sections', '/manage/fixtures/seasons'],
      },
      {
        id: 'gallery',
        label: 'Gallery',
        description: 'Share photos and highlights from your club',
        to: '/manage/gallery',
        icon: 'nav/photo-gallery',
      },
      {
        id: 'managers',
        label: 'Managers',
        tileTitle: 'Team Managers & Permissions',
        description: 'Add managers, manage access',
        to: '/manage/permissions',
        icon: 'nav/roles-permissions',
      },
    ],
  },
]

// The phone bottom bar: Home, Matches, Availability, Players, then a Menu button that opens the sheet.
export const MANAGER_TAB_IDS = ['overview', 'matches', 'availability', 'players'] as const
export const MANAGER_TAB_LABELS: Record<string, string> = { overview: 'Home' }

export function flatNavItems(groups: NavGroup[] = MANAGER_NAV): NavItem[] {
  return groups.flatMap((group) => group.items)
}

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (item.id === 'overview') return path === '/manage'
  if (item.exact ? path === item.to : underPrefix(path, item.to)) return true
  return (item.match ?? []).some((pattern) => (typeof pattern === 'string' ? underPrefix(path, pattern) : pattern.test(path)))
}

// First item in menu order that matches; People precedes Club so a team under a section is Teams.
export function activeNavId(groups: NavGroup[], pathname: string): string | undefined {
  return flatNavItems(groups).find((item) => isNavItemActive(item, pathname))?.id
}

// The bottom-bar tab to light: the active item's tabId, else its own id.
export function activeTabId(groups: NavGroup[], pathname: string): string | undefined {
  const id = activeNavId(groups, pathname)
  return flatNavItems(groups).find((item) => item.id === id)?.tabId ?? id
}

export interface ManagerTab {
  id: string
  label: string
  to: string
  icon: NavIconName
}

// The bottom-bar tabs resolved from MANAGER_NAV (Overview is shown as "Home").
export function managerTabs(groups: NavGroup[] = MANAGER_NAV): ManagerTab[] {
  const items = flatNavItems(groups)
  return MANAGER_TAB_IDS.flatMap((id) => {
    const item = items.find((candidate) => candidate.id === id)
    return item ? [{ id, label: MANAGER_TAB_LABELS[id] ?? item.label, to: item.to, icon: item.icon }] : []
  })
}
