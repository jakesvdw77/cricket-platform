import { describe, expect, it } from 'vitest'
import appSource from '../../App.tsx?raw'
import { BRAND_ICON_NAMES } from '../BrandIcon/brandIcons'
import { MANAGER_NAV, OVERVIEW_TILE_GROUPS, activeNavId, flatNavItems, managerTabs } from './managerNav'

const items = flatNavItems(MANAGER_NAV)

describe('managerNav', () => {
  it('has unique ids and destinations', () => {
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length)
    expect(new Set(items.map((item) => item.to)).size).toBe(items.length)
  })

  it('every destination is a /manage route registered in App.tsx', () => {
    for (const item of items) {
      if (item.to === '/manage') continue
      const relative = item.to.replace(/^\/manage\//, '')
      expect(appSource, `${item.to} missing from App.tsx`).toContain(`path="${relative}"`)
    }
  })

  it('every icon is a known brand icon (or a MUI glyph name)', () => {
    for (const item of items) {
      if (item.icon === 'home' || item.icon === 'menu') continue
      expect(BRAND_ICON_NAMES as readonly string[]).toContain(item.icon)
    }
  })

  it('only Overview uses the home glyph for now', () => {
    expect(items.filter((item) => item.icon === 'home').map((item) => item.id)).toEqual(['overview'])
  })

  it('the Overview tiles are drawn from the nav, in the original two groups of 9 and 3', () => {
    expect(OVERVIEW_TILE_GROUPS.map((group) => group.ids.length)).toEqual([9, 3])
    const ids = items.map((item) => item.id)
    for (const group of OVERVIEW_TILE_GROUPS) {
      for (const id of group.ids) expect(ids).toContain(id)
    }
  })

  it('the bottom tabs are Home, Matches, Polls, Players', () => {
    expect(managerTabs().map((tab) => tab.label)).toEqual(['Home', 'Matches', 'Polls', 'Players'])
  })

  it.each([
    ['/manage', 'overview'],
    ['/manage/', 'overview'],
    ['/manage/fixtures/matches', 'matches'],
    ['/manage/fixtures/matches/1/edit', 'matches'],
    ['/manage/fixtures/leagues/2/schedule', 'leagues'],
    ['/manage/availability', 'polls'],
    ['/manage/availability/squad/m/p', 'polls'],
    ['/manage/player-availability', 'polls'],
    ['/manage/teams/new', 'teams'],
    ['/manage/sections/s/teams', 'teams'],
    ['/manage/sections', 'club-profile'],
    ['/manage/sponsors/9/contacts', 'club-profile'],
    ['/manage/fixtures/seasons', 'club-profile'],
    ['/manage/permissions', 'managers'],
  ])('%s highlights %s', (path, id) => {
    expect(activeNavId(MANAGER_NAV, path)).toBe(id)
  })

  it('highlights nothing for an unknown route', () => {
    expect(activeNavId(MANAGER_NAV, '/manage/profile')).toBeUndefined()
  })
})
