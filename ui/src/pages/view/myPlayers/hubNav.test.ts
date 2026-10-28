import { describe, expect, it } from 'vitest'
import { HUB_NAV, LEGACY_REDIRECTS, bubblePill, defaultChild, hubPath, resolveRoute, visibleItems } from './hubNav'
import type { HubNavContext, HubNavItem, HubPillCounts } from './hubNav'

// docs/specs/121: the menu table is binding on routes, tests and copy.
const none: HubPillCounts = { openPolls: 0, invitations: 0, linkRequests: 0 }
const ctx: HubNavContext = { player: { key: 'k1', clubId: 'c1' }, person: null, clubSwitches: {} }
const byId = (id: string) => HUB_NAV.find((item) => item.id === id) as HubNavItem
const childLabels = (id: string) => byId(id).children?.map((child) => child.label)

describe('HUB_NAV', () => {
  it('has exactly the seven main items in order, never more than seven', () => {
    expect(HUB_NAV.map((item) => item.id)).toEqual(['availability', 'updates', 'schedule', 'stats', 'club', 'profile', 'account'])
    expect(HUB_NAV.map((item) => item.label)).toEqual(['Availability', 'Updates', 'Schedule', 'Stats', 'Club', 'Profile', 'Account'])
    expect(HUB_NAV.length).toBeLessThanOrEqual(7)
  })

  it('has only two levels: no child has children', () => {
    for (const item of HUB_NAV) for (const child of item.children ?? []) expect(child.children).toBeUndefined()
  })

  it('lists each parent\'s children in the agreed order', () => {
    expect(childLabels('availability')).toBeUndefined()
    expect(childLabels('updates')).toEqual(['Messages', 'Gallery', 'Social Media'])
    expect(childLabels('schedule')).toEqual(['Matches', 'Leagues', 'Results', 'Team sheets'])
    expect(childLabels('stats')).toEqual(['My stats', 'Leaderboards', 'Team stats'])
    expect(childLabels('club')).toEqual(['Club info', 'Bookings', 'Field Directory', 'Other Services'])
    expect(childLabels('profile')).toEqual(['Contact', 'Cricket', 'Agents'])
    expect(childLabels('account')).toEqual(['Invitations', 'Link requests', 'Link more players', 'Sign out'])
  })

  it('marks Field Directory as the only live Club item, and the other sections as Soon where they are not built', () => {
    expect(byId('club').children?.filter((child) => !child.soon).map((child) => child.label)).toEqual(['Field Directory'])
    for (const id of ['updates', 'stats']) expect(byId(id).children?.every((child) => child.soon)).toBe(true)
    expect(byId('schedule').children?.filter((child) => !child.soon).map((child) => child.label)).toEqual(['Leagues'])
    for (const id of ['profile', 'account']) expect(byId(id).children?.some((child) => child.soon)).toBe(false)
  })

  it('gives the two Account actions an action and no page', () => {
    const [, , find, signOut] = byId('account').children as HubNavItem[]
    expect(find.action).toBe('findPlayers')
    expect(signOut.action).toBe('signOut')
  })
})

describe('defaultChild', () => {
  it('opens on the first child that is a page and not Soon, else the first child', () => {
    expect(defaultChild(byId('club'))?.label).toBe('Field Directory')
    expect(defaultChild(byId('account'))?.label).toBe('Invitations')
    expect(defaultChild(byId('profile'))?.label).toBe('Contact')
    expect(defaultChild(byId('schedule'))?.label).toBe('Leagues')
    expect(defaultChild(byId('stats'))?.label).toBe('My stats')
  })

  it('skips an action even when it comes first, and has nothing for a leaf', () => {
    const parent: HubNavItem = { id: 'x', label: 'X', children: [{ id: 'x.a', label: 'A', action: 'signOut' }, { id: 'x.b', label: 'B' }] }
    expect(defaultChild(parent)?.id).toBe('x.b')
    expect(defaultChild(byId('availability'))).toBeUndefined()
  })
})

describe('LEGACY_REDIRECTS', () => {
  it('sends the old requests and matches URLs to their new homes, and nothing else', () => {
    expect(LEGACY_REDIRECTS).toEqual({ requests: 'account/requests', matches: 'schedule/matches' })
  })
})

describe('bubblePill', () => {
  it('shows "N open" for polls on Availability and nothing at zero', () => {
    expect(bubblePill(byId('availability'), { ...none, openPolls: 3 })).toBe('3 open')
    expect(bubblePill(byId('availability'), none)).toBeNull()
  })

  it('shows "N new" on a parent from the sum of its children and nothing when none has a count', () => {
    expect(bubblePill(byId('account'), { ...none, invitations: 2, linkRequests: 1 })).toBe('3 new')
    expect(bubblePill(byId('account'), none)).toBeNull()
    expect(bubblePill(byId('club'), { openPolls: 5, invitations: 5, linkRequests: 5 })).toBeNull()
  })

  it('shows the plain count on a leaf with its own source', () => {
    expect(bubblePill(byId('account').children?.[0] as HubNavItem, { ...none, invitations: 4 })).toBe('4')
    expect(bubblePill(byId('profile').children?.[0] as HubNavItem, { ...none, invitations: 4 })).toBeNull()
  })
})

describe('visibleItems and resolveRoute', () => {
  it('shows everything when nothing has a gate', () => {
    expect(visibleItems(ctx).map((item) => item.id)).toEqual(HUB_NAV.map((item) => item.id))
  })

  it('drops a gated item, and a parent whose children are all dropped', () => {
    const items: HubNavItem[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B', visibleWhen: () => false },
      { id: 'c', label: 'C', children: [{ id: 'c.x', label: 'X', visibleWhen: () => false }] },
      { id: 'd', label: 'D', children: [{ id: 'd.x', label: 'X' }, { id: 'd.y', label: 'Y', visibleWhen: (c) => c.clubSwitches.y === true }] },
    ]
    const tree = visibleItems(ctx, items)
    expect(tree.map((item) => item.id)).toEqual(['a', 'd'])
    expect(tree[1].children?.map((child) => child.id)).toEqual(['d.x'])
    expect(visibleItems({ ...ctx, clubSwitches: { y: true } }, items)[1].children).toHaveLength(2)
  })

  it('resolves the root, a section, an item, and falls back to Availability for unknown values', () => {
    expect(resolveRoute(undefined, undefined)).toMatchObject({ root: true, section: { id: 'availability' } })
    expect(resolveRoute('club', 'fields')).toMatchObject({ root: false, section: { id: 'club' }, item: { id: 'club.fields' } })
    expect(resolveRoute('club', 'nope')).toMatchObject({ section: { id: 'club' }, item: undefined })
    expect(resolveRoute('nonsense', undefined)).toMatchObject({ root: false, section: { id: 'availability' } })
  })

  it('builds hub paths without empty segments', () => {
    expect(hubPath('k1')).toBe('/account/players/k1')
    expect(hubPath('k1', 'club', 'fields')).toBe('/account/players/k1/club/fields')
  })
})
