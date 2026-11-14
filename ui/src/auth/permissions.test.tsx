import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { MeAccess } from '../api/meApi'
import { buildPermissions, PermissionsProvider, usePermissions } from './permissions'

const CLUB = 'club-1'
const JUNIORS = 'juniors'
const SENIORS = 'seniors'

const access = (overrides: Partial<MeAccess>): MeAccess => ({
  personId: 'p1',
  personStatus: 'ACTIVE',
  platformAdmin: false,
  clubAdminClubIds: [CLUB],
  ...overrides,
})

describe('buildPermissions', () => {
  it('holds exactly what the club entry lists, club-wide when sectionIds is null', () => {
    const permissions = buildPermissions(
      access({ permissions: [{ clubId: CLUB, clubWide: true, items: [{ key: 'PLAYERS_VIEW', sectionIds: null }] }] }),
      CLUB,
    )

    expect(permissions.can('PLAYERS_VIEW')).toBe(true)
    expect(permissions.can('PLAYERS_VIEW', SENIORS)).toBe(true)
    expect(permissions.can('PLAYERS_EDIT')).toBe(false)
  })

  it('limits a section grant to its sections', () => {
    const permissions = buildPermissions(
      access({ permissions: [{ clubId: CLUB, clubWide: false, items: [{ key: 'MATCHES_EDIT', sectionIds: [JUNIORS] }] }] }),
      CLUB,
    )

    expect(permissions.can('MATCHES_EDIT')).toBe(true)
    expect(permissions.can('MATCHES_EDIT', JUNIORS)).toBe(true)
    expect(permissions.can('MATCHES_EDIT', SENIORS)).toBe(false)
  })

  it('reads only the club being worked in', () => {
    const permissions = buildPermissions(
      access({ permissions: [{ clubId: 'other', clubWide: true, items: [{ key: 'PLAYERS_VIEW', sectionIds: null }] }] }),
      CLUB,
    )

    expect(permissions.can('PLAYERS_VIEW')).toBe(false)
    expect(permissions.canAny(['PLAYERS_VIEW', 'TEAMS_VIEW'])).toBe(false)
  })

  it('answers canAny when at least one is held', () => {
    const permissions = buildPermissions(
      access({ permissions: [{ clubId: CLUB, clubWide: true, items: [{ key: 'TEAMS_VIEW', sectionIds: null }] }] }),
      CLUB,
    )

    expect(permissions.canAny(['PLAYERS_VIEW', 'TEAMS_VIEW'])).toBe(true)
  })

  it('hides nothing for a platform admin, an older backend, or before the answer arrives', () => {
    expect(buildPermissions(access({ platformAdmin: true, permissions: [] }), CLUB).can('ACCESS_MANAGE')).toBe(true)
    expect(buildPermissions(access({ permissions: undefined }), CLUB).can('ACCESS_MANAGE')).toBe(true)
    expect(buildPermissions(undefined, CLUB).can('ACCESS_MANAGE')).toBe(true)
  })
})

describe('PermissionsProvider', () => {
  function Probe() {
    const { can } = usePermissions()
    return <p>{can('PLAYERS_EDIT') ? 'may edit' : 'read only'}</p>
  }

  it('gives a component what the caller holds', () => {
    render(
      <PermissionsProvider
        access={access({ permissions: [{ clubId: CLUB, clubWide: true, items: [{ key: 'PLAYERS_VIEW', sectionIds: null }] }] })}
        clubId={CLUB}
      >
        <Probe />
      </PermissionsProvider>,
    )

    expect(screen.getByText('read only')).toBeInTheDocument()
  })

  it('shows everything outside a provider, because the server is the real gate', () => {
    render(<Probe />)

    expect(screen.getByText('may edit')).toBeInTheDocument()
  })
})
