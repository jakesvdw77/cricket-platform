import { describe, expect, it } from 'vitest'
import appSource from '../../App.tsx?raw'
import { BRAND_ICON_NAMES } from '../BrandIcon/brandIcons'
import { MANAGER_NAV, activeNavId, activeTabId, flatNavItems, isNavGlyph, isNavItemActive, managerTabs } from './managerNav'

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
      // A route is either declared whole or as a child (`path="players"` under `path="availability"`).
      const segments = relative.split('/')
      const declared =
        appSource.includes(`path="${relative}"`) ||
        (segments.length > 1 &&
          appSource.includes(`path="${segments.slice(0, -1).join('/')}"`) &&
          appSource.includes(`path="${segments[segments.length - 1]}"`))
      expect(declared, `${item.to} missing from App.tsx`).toBe(true)
    }
  })

  it('every icon is a known brand icon (or a MUI glyph name)', () => {
    for (const item of items) {
      if (isNavGlyph(item.icon)) continue
      expect(BRAND_ICON_NAMES as readonly string[]).toContain(item.icon)
    }
  })

  it('Overview uses its own brand icon', () => {
    expect(items.find((item) => item.id === 'overview')?.icon).toBe('nav/overview-home')
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
    ['/manage/availability/', 'polls'],
    ['/manage/availability/new', 'polls'],
    ['/manage/availability/group/r1', 'polls'],
    ['/manage/availability/squad/m/p', 'polls'],
    ['/manage/section-availability', 'polls'],
    ['/manage/availability/players', 'player-availability'],
    ['/manage/player-availability', 'player-availability'],
    ['/manage/availability/coverage', 'team-availability'],
    ['/manage/communication', 'communication'],
    ['/manage/teams/new', 'teams'],
    ['/manage/sections/s/teams', 'teams'],
    ['/manage/sections', 'club-profile'],
    ['/manage/sponsors/9/contacts', 'club-profile'],
    ['/manage/fixtures/seasons', 'club-profile'],
    ['/manage/permissions', 'managers'],
  ])('%s highlights %s', (path, id) => {
    expect(activeNavId(MANAGER_NAV, path)).toBe(id)
  })

  it('groups People as Teams, Players, Squads, Communication and Availability as Polls, Player availability, Match-day cover', () => {
    const labels = (name: string) => MANAGER_NAV.find((group) => group.label === name)?.items.map((item) => item.label)
    expect(labels('People')).toEqual(['Teams', 'Players', 'Squads', 'Communication'])
    expect(labels('Availability')).toEqual(['Polls', 'Player availability', 'Match-day cover'])
  })

  it('lights exactly one item on every real path', () => {
    const paths = [
      '/manage', '/manage/fixtures/matches', '/manage/fixtures/leagues', '/manage/results', '/manage/teams',
      '/manage/sections/s/teams', '/manage/players', '/manage/squads', '/manage/communication',
      '/manage/availability', '/manage/availability/new', '/manage/availability/group/r1',
      '/manage/availability/squad/m/p', '/manage/availability/players', '/manage/availability/coverage',
      '/manage/player-availability', '/manage/section-availability', '/manage/club-profile', '/manage/gallery',
      '/manage/notifications', '/manage/permissions',
    ]
    // Section-scoped team routes also sit under Club profile's /manage/sections; first-match-wins
    // (Teams precedes Club) resolves that, so it is covered by the activeNavId cases above.
    for (const path of paths.filter((p) => !p.startsWith('/manage/sections'))) {
      expect(items.filter((item) => isNavItemActive(item, path)).map((item) => item.id), path).toHaveLength(1)
    }
  })

  it('the bottom bar lights Polls for the whole availability hub', () => {
    for (const path of ['/manage/availability', '/manage/availability/players', '/manage/availability/coverage', '/manage/player-availability']) {
      expect(activeTabId(MANAGER_NAV, path), path).toBe('polls')
    }
    expect(activeTabId(MANAGER_NAV, '/manage/players')).toBe('players')
  })

  it('highlights nothing for an unknown route', () => {
    expect(activeNavId(MANAGER_NAV, '/manage/profile')).toBeUndefined()
  })
})
