import { describe, expect, it } from 'vitest'
import { hubBack } from './hubNav'
import type { HubBackState } from './hubNav'

// docs/specs/121 Decision 15: the footer's one Back. Label and target for every screen kind.
const state = (overrides: Partial<HubBackState>): HubBackState => ({ playerKey: 'k1', layout: 'wide', many: true, ...overrides })
const BASE = '/account/players/k1'

describe('hubBack on a phone', () => {
  const phone = { layout: 'phone' } as const

  it('is Back to players on the main menu for several players, and nothing for one', () => {
    expect(hubBack(state({ ...phone }))).toEqual({ label: 'Back to players', target: '/account' })
    expect(hubBack(state({ ...phone, many: false }))).toBeNull()
  })

  it('is Back to menu on a page, a Soon page and a parent\'s page, whatever the player count', () => {
    for (const many of [true, false]) {
      expect(hubBack(state({ ...phone, many, section: 'availability' }))).toEqual({ label: 'Back to menu', target: BASE })
      expect(hubBack(state({ ...phone, many, section: 'club', item: 'fields' }))).toEqual({ label: 'Back to menu', target: BASE })
      expect(hubBack(state({ ...phone, many, section: 'stats' }))).toEqual({ label: 'Back to menu', target: BASE })
    }
  })

  it('is Back to Profile on a Profile edit view, going to that Profile page', () => {
    expect(hubBack(state({ ...phone, section: 'profile', item: 'contact', view: 'edit' }))).toEqual({ label: 'Back to Profile', target: `${BASE}/profile/contact` })
  })
})

describe('hubBack on tablet and desktop', () => {
  it('is Back to players on the main menu for several players, and nothing for one', () => {
    expect(hubBack(state({}))).toEqual({ label: 'Back to players', target: '/account' })
    expect(hubBack(state({ many: false }))).toBeNull()
  })

  it('is Back to players on a leaf page such as Availability, since the menu column is already the main menu', () => {
    expect(hubBack(state({ section: 'availability' }))).toEqual({ label: 'Back to players', target: '/account' })
    expect(hubBack(state({ section: 'availability', many: false }))).toBeNull()
  })

  it('is Back to menu while a sub menu is open, going up to Availability with the main menu', () => {
    for (const many of [true, false]) {
      expect(hubBack(state({ many, section: 'club', item: 'fields' }))).toEqual({ label: 'Back to menu', target: `${BASE}/availability` })
      expect(hubBack(state({ many, section: 'schedule' }))).toEqual({ label: 'Back to menu', target: `${BASE}/availability` })
      expect(hubBack(state({ many, section: 'profile', item: 'agents' }))).toEqual({ label: 'Back to menu', target: `${BASE}/availability` })
    }
  })

  it.each([
    ['contact', 'edit'],
    ['cricket', 'edit'],
    ['agents', 'edit'],
    ['contact', 'edit-card'],
    ['cricket', 'edit-card'],
    ['agents', 'edit-card'],
    ['agents', 'leave'],
  ])('is Back to Profile on profile/%s/%s, returning to that page', (item, view) => {
    expect(hubBack(state({ section: 'profile', item, view }))).toEqual({ label: 'Back to Profile', target: `${BASE}/profile/${item}` })
  })

  it('treats a view that is not a real Profile sub view as an ordinary page', () => {
    expect(hubBack(state({ section: 'profile', item: 'contact', view: 'leave' }))).toEqual({ label: 'Back to menu', target: `${BASE}/availability` })
    expect(hubBack(state({ section: 'profile', item: 'contact', view: 'bogus' }))).toEqual({ label: 'Back to menu', target: `${BASE}/availability` })
  })

  it('does not give Back to Profile outside the Profile section', () => {
    expect(hubBack(state({ section: 'club', item: 'fields', view: 'edit' }))?.label).toBe('Back to menu')
  })
})

// docs/specs/123: Schedule > Leagues. A league page goes back to the list (same season); the list is an ordinary Schedule child.
describe('hubBack on Schedule > Leagues', () => {
  const list = { section: 'schedule', item: 'leagues' } as const

  it('is Back to menu on the list on a phone', () => {
    expect(hubBack(state({ layout: 'phone', ...list }))).toEqual({ label: 'Back to menu', target: BASE })
  })

  it('is Back to menu on the list on a wide screen, going up to the main menu', () => {
    expect(hubBack(state({ ...list }))).toEqual({ label: 'Back to menu', target: `${BASE}/availability` })
  })

  it('is Back to Leagues on a league page, on every layout, whatever the player count', () => {
    for (const layout of ['phone', 'wide'] as const) {
      for (const many of [true, false]) {
        expect(hubBack(state({ layout, many, ...list, view: 'l1' }))).toEqual({ label: 'Back to Leagues', target: `${BASE}/schedule/leagues` })
      }
    }
  })

  it('keeps the season of the league page in the target', () => {
    expect(hubBack(state({ ...list, view: 'l1', season: 's0' }))).toEqual({ label: 'Back to Leagues', target: `${BASE}/schedule/leagues?season=s0` })
    expect(hubBack(state({ layout: 'phone', ...list, view: 'l1', season: 'a b' })).target).toBe(`${BASE}/schedule/leagues?season=a%20b`)
  })
})
