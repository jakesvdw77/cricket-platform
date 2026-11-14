import { describe, expect, it } from 'vitest'
import type { AccessGrantList, AccessRole } from '../../../api/accessGrantsApi'
import { addOutcome, assignableRoles, canChangeRoles, cellFor, clubWideFor, placeHelper, placeLabel, sectionsFor, statusLabel } from './accessGrantFormat'

const role = (key: string, assignable: boolean, permissions: string[]): AccessRole => ({
  id: key,
  key,
  name: key,
  description: '',
  assignable,
  permissions: permissions.map((permission) => ({ key: permission, label: permission, level: permission.endsWith('VIEW') ? 'VIEW' : 'EDIT', reach: 'SECTION' })),
})

describe('accessGrantFormat', () => {
  it('names the place of a grant', () => {
    expect(placeLabel({ scopeType: 'CLUB', sectionName: null })).toBe('Whole Club')
    expect(placeLabel({ scopeType: 'SECTION', sectionName: 'Juniors' })).toBe('Juniors')
  })

  it('says how long ago an invitation went out', () => {
    const now = new Date('2026-11-14T12:00:00Z')
    expect(statusLabel({ status: 'ACTIVE', invitationSentAt: null }, now)).toBe('Active')
    expect(statusLabel({ status: 'INVITED', invitationSentAt: null }, now)).toBe('Invited')
    expect(statusLabel({ status: 'INVITED', invitationSentAt: '2026-11-14T08:00:00Z' }, now)).toBe('Invited Today')
    expect(statusLabel({ status: 'INVITED', invitationSentAt: '2026-11-13T08:00:00Z' }, now)).toBe('Invited 1 Day Ago')
    expect(statusLabel({ status: 'INVITED', invitationSentAt: '2026-11-10T08:00:00Z' }, now)).toBe('Invited 4 Days Ago')
  })

  it('offers only assignable roles, and Change Role only when there is a second one', () => {
    const roles = [role('MANAGER', true, []), role('VIEWER', false, [])]
    expect(assignableRoles(roles).map((entry) => entry.key)).toEqual(['MANAGER'])
    expect(canChangeRoles(roles)).toBe(false)
    expect(canChangeRoles([...roles, role('SCORER', true, [])])).toBe(true)
    expect(assignableRoles(undefined)).toEqual([])
  })

  it('reads what the caller may give from the list', () => {
    const list: AccessGrantList = {
      items: [],
      clubWideCount: 0,
      canManage: true,
      canGrantClubWide: true,
      grantableSectionIds: ['s1'],
      roles: [{ roleId: 'VIEWER', clubWide: true, sectionIds: ['s1'] }],
    }
    expect(clubWideFor(list, 'VIEWER')).toBe(true)
    expect(clubWideFor(list, 'MANAGER')).toBe(false)
    expect(sectionsFor(list, 'VIEWER')).toEqual(['s1'])
    expect(sectionsFor(undefined, 'VIEWER')).toEqual([])
  })

  it('words the three outcomes of adding someone', () => {
    const grant = {} as never
    expect(addOutcome({ grant, accountExisted: false, invitationSent: true, invitationFailed: false })).toEqual({ message: 'Access given. Invitation sent.', tone: 'success' })
    expect(addOutcome({ grant, accountExisted: true, invitationSent: false, invitationFailed: false })).toEqual({ message: 'Access given. No invitation needed.', tone: 'success' })
    expect(addOutcome({ grant, accountExisted: false, invitationSent: false, invitationFailed: true }).tone).toBe('warning')
  })

  it('words the helper line for the chosen place', () => {
    expect(placeHelper(null, true)).toContain('whole club')
    expect(placeHelper(null, false)).toBe('Choose a section.')
    expect(placeHelper('Juniors', false)).toContain('Juniors and everything beneath it')
  })

  it('shows edit over view in a grid cell, and nothing when the role has neither', () => {
    expect(cellFor(role('A', true, ['PLAYERS_VIEW', 'PLAYERS_EDIT']), 'PLAYERS')).toBe('edit')
    expect(cellFor(role('B', true, ['PLAYERS_VIEW']), 'PLAYERS')).toBe('view')
    expect(cellFor(role('C', true, []), 'PLAYERS')).toBe('none')
  })
})
