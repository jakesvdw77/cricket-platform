import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './axiosConfig'

export interface MeAccess {
  personId: string | null
  personStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | null
  platformAdmin: boolean
  clubAdminClubIds: string[]
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
}

export type MyLinkRequestStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED'

export interface MyLinkRequest {
  id: string
  clubName: string
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
