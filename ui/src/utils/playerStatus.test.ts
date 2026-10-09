import { describe, expect, it } from 'vitest'
import { PLAYER_STATUS_ACTIONS, PLAYER_STATUS_LABEL, playerStatusBadge, playerStatusOf } from './playerStatus'

describe('playerStatus (docs/specs/088)', () => {
  it('derives the status, with a suspended player winning over the verification status', () => {
    expect(playerStatusOf({ active: true, verificationStatus: 'VERIFIED' })).toBe('verified')
    expect(playerStatusOf({ active: true, verificationStatus: 'UNVERIFIED' })).toBe('unverified')
    expect(playerStatusOf({ active: true, verificationStatus: 'REJECTED' })).toBe('rejected')
    expect(playerStatusOf({ active: false, verificationStatus: 'VERIFIED' })).toBe('suspended')
    expect(playerStatusOf({ active: false, verificationStatus: 'UNVERIFIED' })).toBe('suspended')
  })

  it('offers only the valid changes from each status', () => {
    expect(PLAYER_STATUS_ACTIONS).toEqual({
      unverified: ['verify', 'reject'],
      verified: ['suspend'],
      rejected: ['verify'],
      suspended: ['reactivate'],
    })
  })

  it('has a label and a badge tone for every status', () => {
    expect(playerStatusBadge('verified')).toEqual({ label: 'Verified', tone: 'positive' })
    expect(playerStatusBadge('unverified')).toEqual({ label: 'Unverified', tone: 'warning' })
    expect(playerStatusBadge('rejected')).toEqual({ label: 'Rejected', tone: 'closed' })
    expect(playerStatusBadge('suspended')).toEqual({ label: 'Suspended', tone: 'muted' })
    expect(Object.values(PLAYER_STATUS_LABEL)).toHaveLength(4)
  })
})
