import type { AccessGrant, AccessGrantList, AccessRole, AccessRolePermission, AddAccessGrantResult } from '../../../api/accessGrantsApi'

// docs/specs/150: plain wording for the Access page. No em dashes, Title Case labels.

export function fullName(grant: Pick<AccessGrant, 'firstName' | 'lastName'>): string {
  return `${grant.firstName} ${grant.lastName}`.trim()
}

export function placeLabel(grant: Pick<AccessGrant, 'scopeType' | 'sectionName'>): string {
  return grant.scopeType === 'CLUB' ? 'Whole Club' : grant.sectionName ?? 'Section'
}

export function statusLabel(grant: Pick<AccessGrant, 'status' | 'invitationSentAt'>, now: Date = new Date()): string {
  if (grant.status === 'ACTIVE') return 'Active'
  if (!grant.invitationSentAt) return 'Invited'
  const days = Math.floor((now.getTime() - new Date(grant.invitationSentAt).getTime()) / 86_400_000)
  if (days <= 0) return 'Invited Today'
  return days === 1 ? 'Invited 1 Day Ago' : `Invited ${days} Days Ago`
}

/** Roles worth showing in a picker: only the ones that may be given today. */
export function assignableRoles(roles: AccessRole[] | undefined): AccessRole[] {
  return (roles ?? []).filter((role) => role.assignable)
}

/** Change Role is only useful once there is a second role to change to. */
export function canChangeRoles(roles: AccessRole[] | undefined): boolean {
  return assignableRoles(roles).length > 1
}

export function sectionsFor(list: AccessGrantList | undefined, roleId: string | undefined): string[] {
  return list?.roles.find((entry) => entry.roleId === roleId)?.sectionIds ?? []
}

export function clubWideFor(list: AccessGrantList | undefined, roleId: string | undefined): boolean {
  return Boolean(list?.roles.find((entry) => entry.roleId === roleId)?.clubWide)
}

/** The outcome line after Add Person. */
export function addOutcome(result: AddAccessGrantResult): { message: string; tone: 'success' | 'warning' } {
  if (result.invitationFailed) {
    return { message: 'Access given, but the invitation email could not be sent. Resend it from the card.', tone: 'warning' }
  }
  if (result.accountExisted) return { message: 'Access given. No invitation needed.', tone: 'success' }
  return { message: 'Access given. Invitation sent.', tone: 'success' }
}

/** The plain sentence under a role in the picker: what it covers at the chosen place. */
export function placeHelper(sectionName: string | null, clubWide: boolean): string {
  if (clubWide) return 'The whole club, every section and everything beneath it.'
  if (!sectionName) return 'Choose a section.'
  return `${sectionName} and everything beneath it. Leagues and club setup need a whole-club grant.`
}

export interface PermissionGroup {
  title: string
  keys: string[]
}

// The order and grouping of the Roles grid (mockup, spec 150).
export const PERMISSION_GROUPS: PermissionGroup[] = [
  { title: 'People and Teams', keys: ['PLAYERS', 'TEAMS', 'PLAYER_ACCOUNTS'] },
  { title: 'Matches and Results', keys: ['MATCHES', 'RESULTS', 'STATS'] },
  { title: 'Selection and Availability', keys: ['SELECTION', 'AVAILABILITY'] },
  { title: 'Club Setup', keys: ['LEAGUES', 'CLUB_SETUP', 'IMPORTS'] },
  { title: 'Access', keys: ['ACCESS_VIEW_ROW', 'ACCESS'] },
]

export const ROW_LABELS: Record<string, string> = {
  PLAYERS: 'Players',
  TEAMS: 'Teams and Squads',
  PLAYER_ACCOUNTS: 'Player Accounts and Link Requests',
  MATCHES: 'Matches',
  RESULTS: 'Results and Scorecards',
  STATS: 'Stats and Leaderboards',
  SELECTION: 'Team Selection and Playing XI',
  AVAILABILITY: 'Availability Polls and Rounds',
  LEAGUES: 'Leagues and Seasons',
  CLUB_SETUP: 'Club Profile, Structure, Sponsors, Contacts',
  IMPORTS: 'Imports',
  ACCESS_VIEW_ROW: 'See Who Has Access',
  ACCESS: 'Add, Change and Remove Access',
}

// Row key to the permission keys that mean "view" and "edit" for that row; a row with only an edit key (club setup) has no view cell.
const ROW_KEYS: Record<string, { view?: string; edit?: string }> = {
  PLAYERS: { view: 'PLAYERS_VIEW', edit: 'PLAYERS_EDIT' },
  TEAMS: { view: 'TEAMS_VIEW', edit: 'TEAMS_EDIT' },
  PLAYER_ACCOUNTS: { edit: 'PLAYER_ACCOUNTS_MANAGE' },
  MATCHES: { view: 'MATCHES_VIEW', edit: 'MATCHES_EDIT' },
  RESULTS: { view: 'RESULTS_VIEW', edit: 'RESULTS_EDIT' },
  STATS: { view: 'STATS_VIEW' },
  SELECTION: { view: 'SELECTION_VIEW', edit: 'SELECTION_MANAGE' },
  AVAILABILITY: { view: 'AVAILABILITY_VIEW', edit: 'AVAILABILITY_MANAGE' },
  LEAGUES: { edit: 'LEAGUES_EDIT' },
  CLUB_SETUP: { edit: 'CLUB_SETUP_EDIT' },
  IMPORTS: { edit: 'IMPORTS_RUN' },
  ACCESS_VIEW_ROW: { view: 'ACCESS_VIEW' },
  ACCESS: { edit: 'ACCESS_MANAGE' },
}

/** One grid cell: 'edit' when the role carries the edit permission, else 'view' when it carries the view one, else none. */
export function cellFor(role: AccessRole, rowKey: string): 'edit' | 'view' | 'none' {
  const keys = ROW_KEYS[rowKey]
  const held = new Set(role.permissions.map((permission) => permission.key))
  if (keys?.edit && held.has(keys.edit)) return 'edit'
  if (keys?.view && held.has(keys.view)) return 'view'
  return 'none'
}

/** True for a row that only counts when the role is given for the whole club (no section behind the data). */
export function isClubWideRow(rowKey: string, roles: AccessRole[]): boolean {
  const key = ROW_KEYS[rowKey]?.edit
  const permission = roles.flatMap((role) => role.permissions).find((entry: AccessRolePermission) => entry.key === key)
  return permission?.reach === 'CLUB'
}
