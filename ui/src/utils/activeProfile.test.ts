import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile } from '../api/meApi'
import { activeProfileKey, getRememberedProfileKey, openProfile, profileKey, resolveManagerClubId, setRememberedProfileKey } from './activeProfile'

// docs/specs/119 slice 4 (Decisions 7, 25, 29). The test address is localhost, the root domain, so there is no club slug here;
// the club-address cases are in activeProfile.subdomain.test.ts.
const profile = (overrides: Partial<Profile>): Profile => ({ kind: 'MY_PLAYERS', title: 'My players', landing: '/account', pendingCount: 0, ...overrides })
const manager = (clubId: string, clubSlug = clubId): Profile => profile({ kind: 'MANAGER', title: `Manager of ${clubId}`, clubId, clubSlug, landing: '/manage' })

beforeEach(() => localStorage.clear())

describe('profileKey', () => {
  it('is the kind plus the club id, blank for a profile with no club', () => {
    expect(profileKey({ kind: 'MY_PLAYERS' })).toBe('MY_PLAYERS:')
    expect(profileKey({ kind: 'MANAGER', clubId: 'c1' })).toBe('MANAGER:c1')
  })
})

describe('remembered choice', () => {
  it('round trips and clears', () => {
    expect(getRememberedProfileKey()).toBeNull()
    setRememberedProfileKey('MANAGER:c1')
    expect(getRememberedProfileKey()).toBe('MANAGER:c1')
    setRememberedProfileKey(null)
    expect(getRememberedProfileKey()).toBeNull()
  })

  it('never throws when storage is unavailable, the choice just is not remembered', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => setRememberedProfileKey('MANAGER:c1')).not.toThrow()
    expect(getRememberedProfileKey()).toBeNull()
    expect(() => openProfile(manager('c1'), vi.fn(), true)).not.toThrow()
    get.mockRestore()
    set.mockRestore()
  })
})

describe('resolveManagerClubId', () => {
  it('takes the first manager card when nothing else says otherwise', () => {
    expect(resolveManagerClubId([profile({}), manager('c2'), manager('c1')], ['c1'])).toBe('c2')
  })

  it('prefers the last chosen manager card when it is still known', () => {
    localStorage.setItem('profile:activeClub', 'c1')
    expect(resolveManagerClubId([manager('c2'), manager('c1')], [])).toBe('c1')
  })

  it('ignores a stored club the person no longer manages', () => {
    localStorage.setItem('profile:activeClub', 'gone')
    expect(resolveManagerClubId([manager('c2')], ['c2'])).toBe('c2')
  })

  it('accepts a stored club that only the older club admin list knows', () => {
    localStorage.setItem('profile:activeClub', 'c9')
    expect(resolveManagerClubId(undefined, ['c1', 'c9'])).toBe('c9')
  })

  it('falls back to the first club admin club when there are no profiles (older backend)', () => {
    expect(resolveManagerClubId(undefined, ['c1', 'c2'])).toBe('c1')
    expect(resolveManagerClubId([], [])).toBeUndefined()
  })
})

describe('activeProfileKey', () => {
  const profiles = [profile({}), manager('c1')]
  it('names the card by the area of the app the person is in', () => {
    expect(activeProfileKey('/account/players/k', profiles)).toBe('MY_PLAYERS:')
    expect(activeProfileKey('/admin/clubs', profiles)).toBe('PLATFORM_ADMIN:')
    expect(activeProfileKey('/manage/players', profiles)).toBe('MANAGER:c1')
    expect(activeProfileKey('/', profiles)).toBeNull()
  })

  it('has no manager card to name when there is no club to load', () => {
    expect(activeProfileKey('/manage', [profile({})])).toBeNull()
  })
})

describe('openProfile', () => {
  it('navigates to the landing of the card', () => {
    const navigate = vi.fn()
    openProfile(profile({}), navigate)
    expect(navigate).toHaveBeenCalledWith('/account')
  })

  it('remembers the choice only when asked to, and always keeps the last manager club', () => {
    openProfile(manager('c1'), vi.fn())
    expect(getRememberedProfileKey()).toBeNull()
    expect(localStorage.getItem('profile:activeClub')).toBe('c1')

    openProfile(manager('c2'), vi.fn(), true)
    expect(getRememberedProfileKey()).toBe('MANAGER:c2')
    expect(localStorage.getItem('profile:activeClub')).toBe('c2')
  })

  it('does not touch the last manager club for a non-manager card', () => {
    localStorage.setItem('profile:activeClub', 'c1')
    openProfile(profile({}), vi.fn())
    expect(localStorage.getItem('profile:activeClub')).toBe('c1')
  })
})
