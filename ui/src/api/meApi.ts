import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './axiosConfig'

// docs/specs/119 slice 4: the profile cards. At most one MY_PLAYERS plus one MANAGER per club (and PLATFORM_ADMIN).
export type ProfileKind = 'MY_PLAYERS' | 'MANAGER' | 'PLATFORM_ADMIN'

export interface Profile {
  kind: ProfileKind
  title: string
  subtitle?: string | null
  clubId?: string | null
  clubName?: string | null
  clubSlug?: string | null
  landing: '/account' | '/manage' | '/admin'
  pendingCount: number
}

export interface MeAccess {
  personId: string | null
  personStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | null
  platformAdmin: boolean
  clubAdminClubIds: string[]
  // Absent from an older backend; callers fall back to the previous routing then.
  profiles?: Profile[]
}

export async function activateSession(): Promise<MeAccess> {
  const { data } = await api.post<MeAccess>('/me/activate')
  return data
}

// docs/specs/119 Part 3: matching a signed-in account to players (backend: /me/register, /me/player-matches, /me/links).
export interface PlayerMatch {
  ref: string
  firstName: string
  surnameInitial: string
  clubId?: string
  clubName: string
  groupLabel: string | null
  birthYear: number | null
  adult: boolean
}

export interface MainAgentMatch extends PlayerMatch {
  maskedMainAgentEmail: string
}

export interface PlayerMatches {
  withoutMainAgent: PlayerMatch[]
  withMainAgent: MainAgentMatch[]
}

export async function registerAccount(): Promise<void> {
  await api.post('/me/register')
}

export async function getPlayerMatches(): Promise<PlayerMatches> {
  const { data } = await api.get<PlayerMatches>('/me/player-matches')
  return data
}

export async function confirmLinks(playerRefs: string[]): Promise<{ linked: PlayerMatch[] }> {
  const { data } = await api.post<{ linked: PlayerMatch[] }>('/me/links', { confirm: true, playerRefs })
  return data
}

export function usePlayerMatches(enabled = true) {
  return useQuery({ queryKey: ['me', 'player-matches'], queryFn: getPlayerMatches, enabled, retry: false })
}

export function useRegisterAccount() {
  return useMutation({ mutationFn: registerAccount })
}

export function useConfirmLinks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: confirmLinks,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })
}

// docs/specs/119 Part 3 (slice 3B): link requests, the requester's side.
export interface LinkRequestInput {
  clubId: string
  firstName: string
  lastName: string
  dateOfBirth: string
  contactNumber: string
  message?: string
  targetPlayerRef?: string
  sectionId?: string
}

export type MyLinkRequestStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED'

export interface MyLinkRequest {
  id: string
  clubName: string
  sectionName?: string | null
  playerName: string
  status: MyLinkRequestStatus
  decisionNote?: string | null
  createdAt: string
  decidedAt?: string | null
}

export interface MyClub {
  id: string
  name: string
}

export async function createLinkRequest(input: LinkRequestInput): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/me/link-requests', input)
  return data
}

export async function listMyLinkRequests(): Promise<MyLinkRequest[]> {
  const { data } = await api.get<MyLinkRequest[]>('/me/link-requests')
  return data
}

export async function cancelLinkRequest(id: string): Promise<void> {
  await api.delete(`/me/link-requests/${id}`)
}

export async function listMyClubs(): Promise<MyClub[]> {
  const { data } = await api.get<MyClub[]>('/me/clubs')
  return data
}

export interface ClubSectionOption {
  id: string
  name: string
  groupLabel?: string | null
}

export async function listClubSections(clubId: string): Promise<ClubSectionOption[]> {
  const { data } = await api.get<ClubSectionOption[]>(`/me/clubs/${clubId}/sections`)
  return data
}

export function useClubSections(clubId: string | undefined) {
  return useQuery({
    queryKey: ['me', 'clubs', clubId, 'sections'],
    queryFn: () => listClubSections(clubId as string),
    enabled: Boolean(clubId),
    retry: false,
  })
}

export function useMyClubs() {
  return useQuery({ queryKey: ['me', 'clubs'], queryFn: listMyClubs, retry: false })
}

export function useMyLinkRequests(enabled = true) {
  return useQuery({ queryKey: ['me', 'link-requests'], queryFn: listMyLinkRequests, enabled, retry: false })
}

export function useCreateLinkRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createLinkRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me', 'link-requests'] }),
  })
}

export function useCancelLinkRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelLinkRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me', 'link-requests'] }),
  })
}

// docs/specs/119 slice 4: the same profile list the activate call carries, for the switcher and the chooser.
export async function listMyProfiles(): Promise<Profile[]> {
  const { data } = await api.get<Profile[]>('/me/profiles')
  return data
}

export function useMyProfiles(enabled = true) {
  return useQuery({ queryKey: ['me', 'profiles'], queryFn: listMyProfiles, enabled, retry: false, staleTime: 60_000 })
}

// Invitations to manage a player (docs/specs/119 slice 4, "Changing agents").
export interface MyInvitation {
  linkId: string
  playerName: string
  clubName: string
  invitedByName: string
  makeMain: boolean
  expiresAt: string
}

export async function listMyInvitations(): Promise<MyInvitation[]> {
  const { data } = await api.get<MyInvitation[]>('/me/invitations')
  return data
}

export function useMyInvitations(enabled = true) {
  return useQuery({ queryKey: ['me', 'invitations'], queryFn: listMyInvitations, enabled, retry: false })
}

export function useInvitationAction(action: 'accept' | 'decline') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (linkId: string) => {
      await api.post(`/me/links/${linkId}/${action}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })
}

// Cancel a sent invitation, or leave as an agent (409 "hand over first" for a main agent with other agents).
export function useRemoveMyLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (linkId: string) => {
      await api.delete(`/me/links/${linkId}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })
}
