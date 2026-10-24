// @vitest-environment-options {"url": "http://riverside.localhost:5173/manage"}
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile } from '../api/meApi'
import { currentClubSlug, openProfile, resolveManagerClubId } from './activeProfile'

// docs/specs/119 slice 4 (Decision 29): on a club address the hat follows the address, and another club's card is a
// navigation to that club's own address, never an in-place swap.
const manager = (clubId: string, clubSlug: string): Profile => ({ kind: 'MANAGER', title: 'Club manager', clubId, clubSlug, landing: '/manage', pendingCount: 0 })

beforeEach(() => localStorage.clear())

describe('on a club address', () => {
  it('reads the club slug from the host', () => {
    expect(currentClubSlug()).toBe('riverside')
  })

  it('loads the club of the address even when another card was chosen last', () => {
    localStorage.setItem('profile:activeClub', 'c2')
    expect(resolveManagerClubId([manager('c2', 'hillcrest'), manager('c1', 'riverside')], [])).toBe('c1')
  })

  it('a card of the same club swaps in place', () => {
    const navigate = vi.fn()
    openProfile(manager('c1', 'riverside'), navigate)
    expect(navigate).toHaveBeenCalledWith('/manage')
  })

  it('a card of another club goes to that club address, not an in-place navigation', () => {
    const navigate = vi.fn()
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, hostname: window.location.hostname, protocol: window.location.protocol, assign })
    openProfile(manager('c2', 'hillcrest'), navigate)
    vi.unstubAllGlobals()

    expect(navigate).not.toHaveBeenCalled()
    expect(assign).toHaveBeenCalledWith('http://hillcrest.localhost:5173/manage')
  })
})
