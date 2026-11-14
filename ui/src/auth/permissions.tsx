import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { MeAccess } from '../api/meApi'

// docs/specs/150-managers-and-access-grants.md: what the signed-in manager may do in the club they are working in,
// read from `me/access.permissions`. The UI uses it only to hide actions and menu entries a role cannot use; every
// endpoint checks again on the server, so a stale or missing answer can never grant anything.

export type PermissionKey =
  | 'PLAYERS_VIEW'
  | 'PLAYERS_EDIT'
  | 'TEAMS_VIEW'
  | 'TEAMS_EDIT'
  | 'MATCHES_VIEW'
  | 'MATCHES_EDIT'
  | 'RESULTS_VIEW'
  | 'RESULTS_EDIT'
  | 'SELECTION_VIEW'
  | 'SELECTION_MANAGE'
  | 'AVAILABILITY_VIEW'
  | 'AVAILABILITY_MANAGE'
  | 'STATS_VIEW'
  | 'ACCESS_VIEW'
  | 'ACCESS_MANAGE'
  | 'LEAGUES_EDIT'
  | 'CLUB_SETUP_EDIT'
  | 'IMPORTS_RUN'
  | 'PLAYER_ACCOUNTS_MANAGE'

export interface Permissions {
  /** Holds the permission anywhere in the club (or for one section when `sectionId` is given). */
  can: (key: PermissionKey, sectionId?: string | null) => boolean
  /** Holds at least one of the permissions. */
  canAny: (keys: readonly PermissionKey[]) => boolean
}

// Outside a provider (a shared component on its own, a test) nothing is hidden: the server is the real gate.
const OPEN: Permissions = { can: () => true, canAny: () => true }

const PermissionsContext = createContext<Permissions>(OPEN)

export function buildPermissions(access: MeAccess | undefined, clubId: string | undefined): Permissions {
  if (!access) return OPEN
  if (access.platformAdmin) return OPEN
  const club = access.permissions?.find((entry) => entry.clubId === clubId)
  // An older backend sends no permissions: keep the previous behaviour rather than hiding everything.
  if (access.permissions === undefined) return OPEN
  const items = club?.items ?? []
  const can = (key: PermissionKey, sectionId?: string | null) =>
    items.some((item) => item.key === key && (item.sectionIds === null || sectionId == null || item.sectionIds.includes(sectionId)))
  return { can, canAny: (keys) => keys.some((key) => can(key)) }
}

export function PermissionsProvider({ access, clubId, children }: { access: MeAccess | undefined; clubId: string | undefined; children: ReactNode }) {
  const value = useMemo(() => buildPermissions(access, clubId), [access, clubId])
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions(): Permissions {
  return useContext(PermissionsContext)
}
