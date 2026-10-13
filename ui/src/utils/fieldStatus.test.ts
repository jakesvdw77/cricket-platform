import { describe, expect, it } from 'vitest'
import {
  FIELD_STATUS_ACTIONS,
  fieldEditState,
  fieldStatusBadge,
  fieldStatusFrom,
  fieldStatusOf,
} from './fieldStatus'

describe('fieldStatus', () => {
  it('maps the server verification status to the UI status, treating anything unknown as verified', () => {
    expect(fieldStatusFrom('UNVERIFIED')).toBe('unverified')
    expect(fieldStatusFrom('REJECTED')).toBe('rejected')
    expect(fieldStatusFrom('VERIFIED')).toBe('verified')
    expect(fieldStatusFrom(null)).toBe('verified')
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

    it('refuses when the calling club is unknown', () => {
      expect(fieldEditState({ verificationStatus: 'UNVERIFIED', createdByClubId: 'club-1' }, undefined).editable).toBe(false)
    })
  })
})
