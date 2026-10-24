// docs/specs/121-player-hub-menu-and-fields.md: the one source for the Player Hub's menu, in the shape of
// components/ManagerShell/managerNav.ts. The menu, the routes, the footer Back and the Escape key all read it, so a Hub
// item is added in this list and nowhere else. At most seven top-level items and two levels (a unit test pins both).
// Ids, labels and order are binding on routes, tests and copy; the Club order is Club info, Bookings, Field Directory,
// Other Services, and Updates holds Messages, Gallery, Social Media (owner, 2026-10-24).

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
    id: 'updates',
    label: 'Updates',
    children: [
      { id: 'updates.messages', label: 'Messages', soon: true, soonCopy: 'Notices from the club to parents and players.' },
      { id: 'updates.gallery', label: 'Gallery', soon: true, soonCopy: 'Photos and highlights.' },
      { id: 'updates.social', label: 'Social Media', soon: true, soonCopy: "The club's social media pages, once the club adds them." },
    ],
  },
  {
    id: 'schedule',
    label: 'Schedule',
    children: [
      {
        id: 'schedule.matches',
        label: 'Matches',
        soon: true,
        soonCopy: 'Upcoming matches and training for this player will show here once the club shares them with linked accounts.',
      },
      {
        id: 'schedule.leagues',
        label: 'Leagues',
        soon: true,
        soonCopy: "The leagues and competitions this player's teams play in, once the club shares them with linked accounts.",
      },
      { id: 'schedule.results', label: 'Results', soon: true, soonCopy: "Published results for this player's teams." },
      { id: 'schedule.sheets', label: 'Team sheets', soon: true, soonCopy: 'The team sheet for each match once it is announced.' },
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
      { id: 'club.info', label: 'Club info', soon: true, soonCopy: "Contacts, the club's places and links." },
      { id: 'club.bookings', label: 'Bookings', soon: true, soonCopy: 'Nets and facility bookings.' },
      // The one live item (so Club opens on it).
      { id: 'club.fields', label: 'Field Directory' },
      { id: 'club.services', label: 'Other Services', soon: true, soonCopy: 'Other services the club offers, once the club adds them.' },
    ],
  },
  {
    id: 'profile',
    label: 'Profile',
    children: [
      { id: 'profile.contact', label: 'Contact' },
      { id: 'profile.cricket', label: 'Cricket' },
      { id: 'profile.agents', label: 'Agents' },
    ],
  },
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

// The Profile sub views and their titles. `edit` lives under a page (profile/contact/edit, also cricket); `edit-card` is the player card's photo and date of birth, from any page;
// the agent views live under Agents (profile/agents/hand-over and the rest).
export const PROFILE_SUBVIEWS: Record<string, string> = {
  edit: 'Edit Profile',
  'edit-card': 'Edit Photo and Date of Birth',
  leave: 'Leave',
}
export const PROFILE_EDIT_PAGES = ['contact', 'cricket']
export const PROFILE_PAGES = [...PROFILE_EDIT_PAGES, 'agents']

// True when `view` is a real Profile sub view of the page `item`.
export function isProfileSubView(item: string | undefined, view: string | undefined): boolean {
  if (!view || !(view in PROFILE_SUBVIEWS) || !item) return false
  // The Agents page's own edit is profile/agents/edit (add or hand over, pending invitations).
  if (view === 'edit') return PROFILE_EDIT_PAGES.includes(item) || item === 'agents'
  // The card's own edit (photo and date of birth) opens from any Profile page and returns to it.
  if (view === 'edit-card') return PROFILE_PAGES.includes(item)
  return item === 'agents'
}

// profile/agents/hand-over, add-agent and cancel-invite are old links: they redirect to the Agents edit view.
export const isLegacyAgentView = (item: string | undefined, view: string | undefined): boolean => item === 'agents' && LEGACY_AGENT_VIEWS.includes(view ?? '')

// Old Profile deep links (/profile/edit, /profile/hand-over ...) land on the page that now owns them.
const LEGACY_AGENT_VIEWS = ['hand-over', 'add-agent', 'cancel-invite']
export function legacyProfileTarget(view: string | undefined): string | undefined {
  if (!view || !(view in PROFILE_SUBVIEWS || LEGACY_AGENT_VIEWS.includes(view))) return undefined
  if (view === 'edit') return 'profile/contact/edit'
  if (view === 'hand-over') return 'profile/agents/edit?mode=handover'
  if (view === 'add-agent') return 'profile/agents/edit?mode=add'
  if (view === 'cancel-invite') return 'profile/agents/edit'
  return view === 'edit-card' ? undefined : `profile/agents/${view}`
}

// Old URLs that still land somewhere sensible (Decision 14). `/stats` is not here: Stats is now a section of its own, and
// on desktop and tablet it opens on My stats (its first child) by itself; on a phone it is the Stats sub menu.
// `/account/invitations` stays a real route (App.tsx).
export const LEGACY_REDIRECTS: Record<string, string> = {
  requests: 'account/requests',
  matches: 'schedule/matches',
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
// its first child (Decision 16). Club gives Field Directory, Account gives Invitations, Schedule gives Matches (a Soon item, so it opens the first child).
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
  // The segment after the item: a Profile sub view (edit, hand-over ...).
  view?: string
}

export interface HubBackAction {
  label: string
  target: string
}

// The footer's one Back (Decision 15); Escape runs the same action. Null means no Back control at all.
export function hubBack(state: HubBackState): HubBackAction | null {
  const { playerKey, layout, many, section, item, view } = state
  const main = hubPath(playerKey)
  const route = resolveRoute(section, item)
  if (route.section.id === 'profile' && isProfileSubView(item, view)) {
    return { label: 'Back to Profile', target: hubPath(playerKey, 'profile', item) }
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
