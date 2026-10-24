// docs/specs/121-player-hub-menu-and-fields.md: the one source for the Player Hub's menu, in the shape of
// components/ManagerShell/managerNav.ts. The menu, the routes, the footer Back and the Escape key all read it, so a Hub
// item is added in this list and nowhere else. At most six top-level items and two levels (a unit test pins both).
// Ids, labels and order are binding on routes, tests and copy; the Club order is Messages, Club info, Gallery, Bookings,
// Field Directory (Decision 16).

export type HubPillSource = 'openPolls' | 'invitations' | 'linkRequests'

export interface HubPillCounts {
  openPolls: number
  invitations: number
  linkRequests: number
}

// What `visibleWhen` can read. `clubSwitches` is keyed by switch id; empty for now (Decision 13).
export interface HubNavContext {
  player: { key: string; clubId?: string } | null
  person: { name?: string } | null
  clubSwitches: Record<string, boolean>
}

export interface HubNavItem {
  id: string
  label: string
  children?: HubNavItem[]
  // Where the row's pill comes from; a parent's pill bubbles up from its children (bubblePill).
  pill?: HubPillSource
  // Locked: dashed "Soon" pill and a dashed "Coming soon" panel.
  soon?: boolean
  soonCopy?: string
  // Not a page (Decision 11): signOut signs out, findPlayers goes to /welcome.
  action?: 'signOut' | 'findPlayers'
  // The only gate: no function means visible. Combines what linked accounts may see with a club switch.
  visibleWhen?: (ctx: HubNavContext) => boolean
}

export const HUB_NAV: HubNavItem[] = [
  { id: 'availability', label: 'Availability', pill: 'openPolls' },
  {
    id: 'matches',
    label: 'Matches',
    children: [
      {
        id: 'matches.schedule',
        label: 'Schedule',
        soon: true,
        soonCopy: 'Upcoming matches and training for this player will show here once the club shares them with linked accounts.',
      },
      { id: 'matches.results', label: 'Results', soon: true, soonCopy: "Published results for this player's teams." },
      { id: 'matches.sheets', label: 'Team sheets', soon: true, soonCopy: 'The team sheet for each match once it is announced.' },
    ],
  },
  {
    id: 'stats',
    label: 'Stats',
    children: [
      {
        id: 'stats.mine',
        label: 'My stats',
        soon: true,
        soonCopy: "Personal bests, form and season progress. Figures come from the club's published results and are never ranked against other players.",
      },
      { id: 'stats.boards', label: 'Leaderboards', soon: true, soonCopy: 'Club leaderboards, shown only where the club switches them on.' },
      { id: 'stats.teams', label: 'Team stats', soon: true, soonCopy: "How the player's teams are doing this season." },
    ],
  },
  {
    id: 'club',
    label: 'Club',
    children: [
      { id: 'club.messages', label: 'Messages', soon: true, soonCopy: 'Notices from the club to parents and players.' },
      { id: 'club.info', label: 'Club info', soon: true, soonCopy: "Contacts, the club's places and links." },
      { id: 'club.gallery', label: 'Gallery', soon: true, soonCopy: 'Photos and highlights.' },
      { id: 'club.bookings', label: 'Bookings', soon: true, soonCopy: 'Nets and facility bookings.' },
      // Not a Soon item (so Club opens on it); the real screen is checkpoint B, a Soon-style placeholder until then.
      { id: 'club.fields', label: 'Field Directory' },
    ],
  },
  { id: 'profile', label: 'Profile' },
  {
    id: 'account',
    label: 'Account',
    children: [
      { id: 'account.invitations', label: 'Invitations', pill: 'invitations' },
      { id: 'account.requests', label: 'Link requests', pill: 'linkRequests' },
      { id: 'account.find', label: 'Find more players', action: 'findPlayers' },
      { id: 'account.signout', label: 'Sign out', action: 'signOut' },
    ],
  },
]

// The Profile sub views keep their routes (/profile/edit and the rest) and their titles.
export const PROFILE_SUBVIEWS: Record<string, string> = {
  edit: 'Edit Profile',
  'hand-over': 'Hand Over',
  'add-agent': 'Add Agent',
  leave: 'Leave',
  'cancel-invite': 'Cancel Invitation',
}

// Old URLs that still land somewhere sensible (Decision 14). `/stats` is not here: Stats is now a section of its own, and
// on desktop and tablet it opens on My stats (its first child) by itself; on a phone it is the Stats sub menu.
// `/account/invitations` stays a real route (App.tsx).
export const LEGACY_REDIRECTS: Record<string, string> = {
  requests: 'account/requests',
  schedule: 'matches/schedule',
}

// The part of an id after the dot: the URL segment (`club.fields` is `club/fields`).
export const segmentOf = (item: HubNavItem): string => item.id.split('.').pop() ?? item.id

export const isParent = (item: HubNavItem): boolean => Boolean(item.children)

// The visible tree: an item with a false `visibleWhen` is dropped, and so is a parent whose children are all dropped.
export function visibleItems(ctx: HubNavContext, items: HubNavItem[] = HUB_NAV): HubNavItem[] {
  const result: HubNavItem[] = []
  for (const item of items) {
    if (item.visibleWhen && !item.visibleWhen(ctx)) continue
    if (item.children) {
      const children = visibleItems(ctx, item.children)
      if (children.length === 0) continue
      result.push({ ...item, children })
    } else {
      result.push(item)
    }
  }
  return result
}

// What a parent opens on where the menu column stays visible: its first child that is a page and not a Soon item, else
// its first child (Decision 16). Club gives Field Directory, Account gives Invitations, Matches gives Schedule.
export function defaultChild(item: HubNavItem): HubNavItem | undefined {
  const children = item.children ?? []
  return children.find((child) => !child.soon && !child.action) ?? children[0]
}

export interface ResolvedRoute {
  // True when no section was given: the main menu (a phone) or Availability (desktop and tablet).
  root: boolean
  section: HubNavItem
  // The chosen child of a parent section, when the URL names a real one.
  item?: HubNavItem
}

// An unknown section or item means Availability, as before (a known section with an unknown item is just that section).
export function resolveRoute(section: string | undefined, item: string | undefined, items: HubNavItem[] = HUB_NAV): ResolvedRoute {
  const fallback = items.find((entry) => entry.id === 'availability') ?? items[0]
  if (!section) return { root: true, section: fallback }
  const found = items.find((entry) => segmentOf(entry) === section)
  if (!found) return { root: false, section: fallback }
  const child = found.children?.find((entry) => segmentOf(entry) === item)
  return { root: false, section: found, item: child }
}

export const hubPath = (playerKey: string, section?: string, item?: string): string =>
  ['/account/players', playerKey, section, item].filter(Boolean).join('/')

// The pill on a row: a leaf with its own source shows it ("3 open", or the plain count); a parent shows one "N new" from
// the sum of its children's counts, or nothing when none has one. Zero counts show nothing.
export function bubblePill(item: HubNavItem, counts: HubPillCounts): string | null {
  if (item.children) {
    const total = item.children.reduce((sum, child) => sum + (child.pill ? counts[child.pill] : 0), 0)
    return total > 0 ? `${total} new` : null
  }
  if (!item.pill) return null
  const count = counts[item.pill]
  if (count <= 0) return null
  return item.pill === 'openPolls' ? `${count} open` : `${count}`
}

export type HubLayout = 'phone' | 'wide'

export interface HubBackState {
  playerKey: string
  // phone is below 600 px; wide is tablet and desktop, where the menu column stays visible.
  layout: HubLayout
  // More than one player: the picker exists, so the main menu has a Back to players.
  many: boolean
  // The URL's section, item and sub segments.
  section?: string
  item?: string
  sub?: string
}

export interface HubBackAction {
  label: string
  target: string
}

// The footer's one Back (Decision 15); Escape runs the same action. Null means no Back control at all.
export function hubBack(state: HubBackState): HubBackAction | null {
  const { playerKey, layout, many, section, item, sub } = state
  const main = hubPath(playerKey)
  const route = resolveRoute(section, item)
  if (route.section.id === 'profile' && sub !== undefined && sub in PROFILE_SUBVIEWS) {
    return { label: 'Back to Profile', target: hubPath(playerKey, 'profile') }
  }
  const toPlayers = many ? { label: 'Back to players', target: '/account' } : null
  if (layout === 'phone') {
    if (route.root) return toPlayers
    if (isParent(route.section)) {
      if (!route.item) return { label: 'Back to menu', target: main }
      return { label: `Back to ${route.section.label}`, target: hubPath(playerKey, segmentOf(route.section)) }
    }
    return { label: 'Back to menu', target: main }
  }
  // Tablet and desktop: while a sub menu is open the footer goes up to the main menu (the column swaps back to the main
  // list, here with Availability beside it); with the main menu showing it goes to the picker.
  if (!route.root && isParent(route.section)) return { label: 'Back to menu', target: hubPath(playerKey, 'availability') }
  return toPlayers
}
