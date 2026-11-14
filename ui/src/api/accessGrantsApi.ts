import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './axiosConfig'

// docs/specs/150-managers-and-access-grants.md: who has which role where. Every rule is enforced by the server; the flags below
// (canChange, canRemove, canResend, grantable...) only stop the screen offering what the server would refuse.
export interface AccessRolePermission {
  key: string
  label: string
  level: 'VIEW' | 'EDIT'
  reach: 'SECTION' | 'CLUB'
}

export interface AccessRole {
  id: string
  key: string
  name: string
  description: string
  // false until the areas the role covers are enforced (spec 150, Release 3)
  assignable: boolean
  permissions: AccessRolePermission[]
}

export interface AccessGrant {
  id: string
  personId: string
  firstName: string
  lastName: string
  email: string | null
  roleId: string
  roleName: string
  scopeType: 'CLUB' | 'SECTION'
  sectionId: string | null
  sectionName: string | null
  status: 'ACTIVE' | 'INVITED'
  addedByName: string | null
  invitationSentAt: string | null
  self: boolean
  canChange: boolean
  canRemove: boolean
  canResend: boolean
}

export interface RoleGrantability {
  roleId: string
  clubWide: boolean
  sectionIds: string[]
}

export interface AccessGrantList {
  items: AccessGrant[]
  // club-wide holders left out of items (a section viewer): a count only
  clubWideCount: number
  canManage: boolean
  canGrantClubWide: boolean
  grantableSectionIds: string[]
  roles: RoleGrantability[]
}

export interface AddAccessGrantInput {
  email: string
  firstName: string
  lastName: string
  roleId: string
  scope: 'CLUB' | 'SECTION'
  sectionId?: string
}

export interface AddAccessGrantResult {
  grant: AccessGrant
  accountExisted: boolean
  invitationSent: boolean
  invitationFailed: boolean
}

const base = (clubId: string) => `/manage/clubs/${clubId}/access`
const rolesKey = (clubId: string) => ['managed-club', clubId, 'access-roles'] as const
export const accessGrantsKey = (clubId: string) => ['managed-club', clubId, 'access-grants'] as const

export async function listAccessRoles(clubId: string): Promise<AccessRole[]> {
  const { data } = await api.get<AccessRole[]>(`${base(clubId)}/roles`)
  return data
}

export async function listAccessGrants(clubId: string): Promise<AccessGrantList> {
  const { data } = await api.get<AccessGrantList>(`${base(clubId)}/grants`)
  return data
}

export function useAccessRoles(clubId: string | undefined) {
  return useQuery({ queryKey: rolesKey(clubId ?? ''), queryFn: () => listAccessRoles(clubId as string), enabled: Boolean(clubId) })
}

export function useAccessGrants(clubId: string | undefined) {
  return useQuery({ queryKey: accessGrantsKey(clubId ?? ''), queryFn: () => listAccessGrants(clubId as string), enabled: Boolean(clubId) })
}

function useGrantMutation<TVariables, TResult>(clubId: string, run: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accessGrantsKey(clubId) }),
  })
}

export function useAddAccessGrant(clubId: string) {
  return useGrantMutation<AddAccessGrantInput, AddAccessGrantResult>(clubId, async (input) => {
    const { data } = await api.post<AddAccessGrantResult>(`${base(clubId)}/grants`, input)
    return data
  })
}

export function useChangeAccessGrantRole(clubId: string) {
  return useGrantMutation<{ id: string; roleId: string }, AccessGrant>(clubId, async ({ id, roleId }) => {
    const { data } = await api.patch<AccessGrant>(`${base(clubId)}/grants/${id}`, { roleId })
    return data
  })
}

export function useResendAccessInvitation(clubId: string) {
  return useGrantMutation<string, void>(clubId, async (id) => {
    await api.post(`${base(clubId)}/grants/${id}/resend`)
  })
}

export function useRemoveAccessGrant(clubId: string) {
  return useGrantMutation<string, void>(clubId, async (id) => {
    await api.delete(`${base(clubId)}/grants/${id}`)
  })
}
