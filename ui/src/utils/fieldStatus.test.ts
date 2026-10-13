import { describe, expect, it } from 'vitest'
import {
  FIELD_STATUS_ACTIONS,
  fieldEditState,
  fieldStatusBadge,
  fieldStatusFrom,
  fieldStatusOf,
} from './fieldStatus'

describe('fieldStatus', () => {
  it('maps the server verification status to the UI status, and has no status for a missing one', () => {
    expect(fieldStatusFrom('UNVERIFIED')).toBe('unverified')
    expect(fieldStatusFrom('REJECTED')).toBe('rejected')
    expect(fieldStatusFrom('VERIFIED')).toBe('verified')
    expect(fieldStatusFrom(null)).toBeNull()
    expect(fieldStatusFrom(undefined)).toBeNull()
    // fieldStatusOf never claims Verified for a missing status.
    expect(fieldStatusOf({ verificationStatus: undefined as never })).toBe('unverified')
    expect(fieldStatusOf({ verificationStatus: 'REJECTED' })).toBe('rejected')
  })

  it('offers only the valid changes per status; a verified field has none and a rejected one is reopened, never verified', () => {
    expect(FIELD_STATUS_ACTIONS.unverified).toEqual(['verify', 'reject'])
    expect(FIELD_STATUS_ACTIONS.verified).toEqual([])
    expect(FIELD_STATUS_ACTIONS.rejected).toEqual(['reopen'])
  })

  it('gives each status its badge label and tone', () => {
    expect(fieldStatusBadge('verified')).toEqual({ label: 'Verified', tone: 'positive' })
    expect(fieldStatusBadge('unverified')).toEqual({ label: 'Unverified', tone: 'warning' })
    expect(fieldStatusBadge('rejected')).toEqual({ label: 'Rejected', tone: 'closed' })
  })

  describe('fieldEditState', () => {
    it('allows the club that captured an unverified field to edit it', () => {
      expect(fieldEditState({ verificationStatus: 'UNVERIFIED', createdByClubId: 'club-1' }, 'club-1')).toEqual({ editable: true, reason: null })
    })

    it('refuses another club on an unverified field, with a reason', () => {
      const state = fieldEditState({ verificationStatus: 'UNVERIFIED', createdByClubId: 'club-2' }, 'club-1')
      expect(state.editable).toBe(false)
      expect(state.reason).toMatch(/club that captured/)
    })

    it('refuses everyone on a verified field, saying only a platform admin can change it', () => {
      const state = fieldEditState({ verificationStatus: 'VERIFIED', createdByClubId: 'club-1' }, 'club-1')
      expect(state).toEqual({ editable: false, reason: 'Only a platform admin can change a verified field.' })
    })

    it('gives a rejected field its own reason', () => {
      expect(fieldEditState({ verificationStatus: 'REJECTED', createdByClubId: 'club-1' }, 'club-1')).toEqual({
        editable: false,
        reason: 'A rejected field cannot be edited.',
      })
    })

    it('gives a merged field its own reason, whatever its status', () => {
      expect(fieldEditState({ verificationStatus: 'VERIFIED', createdByClubId: 'club-1', mergedIntoId: 'f-2' }, 'club-1')).toEqual({
        editable: false,
        reason: 'This field has been merged into another field.',
      })
    })

    it('refuses when the calling club is unknown', () => {
      expect(fieldEditState({ verificationStatus: 'UNVERIFIED', createdByClubId: 'club-1' }, undefined).editable).toBe(false)
    })
  })
})
