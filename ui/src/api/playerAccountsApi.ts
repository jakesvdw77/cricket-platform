import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './axiosConfig'
import type { Page } from './productApi'

// docs/specs/119 Part 3 (slice 3B): the manager side of Access, Player accounts.
export interface SuggestedPlayer {
  playerId: string
  firstName: string
  lastName: string
  sectionName?: string | null
  dateOfBirth?: string | null
  // false: matched by name only, the stored date of birth differs from the one typed
  exactMatch?: boolean
  hasMainAgent: boolean
  mainAgentName?: string | null
}

export interface LinkRequest {
  id: string
  requesterName: string
  requesterEmail: string
  contactNumber?: string | null
  typedFirstName: string
  typedLastName: string
  typedDateOfBirth: string
  typedAge: number | null
  message?: string | null
  createdAt: string
  targetPlayerId?: string | null
  suggestedPlayer?: SuggestedPlayer | null
}

export type MainAgentMode = 'MAKE_MAIN' | 'ADD'

export interface ApproveLinkRequestInput {
  playerId?: string
  newPlayer?: { firstName: string; lastName: string; dateOfBirth: string; sectionId?: string }
  mainAgentMode: MainAgentMode
  confirm: true
}

export interface PlayerAccount {
  playerId: string
  firstName: string
  lastName: string
  sectionName?: string | null
  mainAgentName?: string | null
  mainAgentMaskedEmail?: string | null
  otherAgentCount: number
}

export interface PlayerLink {
  linkId: string
  agentName: string
  maskedEmail: string
  main: boolean
  grantedVia: string
  since: string
}

export interface PlayerAccountsParams {
  sectionId?: string
  noMainAgent?: boolean
  search?: string
  page: number
}

const base = (clubId: string) => `/manage/clubs/${clubId}`
const requestsKey = (clubId: string) => ['managed-club', clubId, 'link-requests'] as const
const accountsKey = (clubId: string) => ['managed-club', clubId, 'player-accounts'] as const

export async function listLinkRequests(clubId: string): Promise<LinkRequest[]> {
  const { data } = await api.get<LinkRequest[]>(`${base(clubId)}/link-requests`)
  return data
}

export async function getLinkRequestsSummary(clubId: string): Promise<{ waiting: number }> {
  const { data } = await api.get<{ waiting: number }>(`${base(clubId)}/link-requests/summary`)
  return data
}

export async function approveLinkRequest(clubId: string, id: string, input: ApproveLinkRequestInput): Promise<void> {
  await api.post(`${base(clubId)}/link-requests/${id}/approve`, input)
}

export async function declineLinkRequest(clubId: string, id: string, note?: string): Promise<void> {
  await api.post(`${base(clubId)}/link-requests/${id}/decline`, note ? { note } : {})
}

export async function listPlayerAccounts(clubId: string, params: PlayerAccountsParams): Promise<Page<PlayerAccount>> {
  const { data } = await api.get<Page<PlayerAccount>>(`${base(clubId)}/player-accounts`, {
    params: {
      page: params.page,
      ...(params.sectionId ? { sectionId: params.sectionId } : {}),
      ...(params.noMainAgent ? { noMainAgent: true } : {}),
      ...(params.search?.trim() ? { search: params.search.trim() } : {}),
    },
  })
  return data
}

export async function listPlayerLinks(clubId: string, playerId: string): Promise<PlayerLink[]> {
  const { data } = await api.get<PlayerLink[]>(`${base(clubId)}/players/${playerId}/links`)
  return data
}

export function useLinkRequests(clubId: string | undefined) {
  return useQuery({
    queryKey: [...requestsKey(clubId ?? ''), 'list'],
    queryFn: () => listLinkRequests(clubId as string),
    enabled: Boolean(clubId),
  })
}

// Also feeds the Players-list shortcut card; a failure just hides that card.
export function useLinkRequestsSummary(clubId: string | undefined) {
  return useQuery({
    queryKey: [...requestsKey(clubId ?? ''), 'summary'],
    queryFn: () => getLinkRequestsSummary(clubId as string),
    enabled: Boolean(clubId),
    retry: false,
  })
}

export function usePlayerAccounts(clubId: string | undefined, params: PlayerAccountsParams) {
  return useQuery({
    queryKey: [...accountsKey(clubId ?? ''), params],
    queryFn: () => listPlayerAccounts(clubId as string, params),
    enabled: Boolean(clubId),
    placeholderData: keepPreviousData,
  })
}

export function usePlayerLinks(clubId: string | undefined, playerId: string | undefined) {
  return useQuery({
    queryKey: [...accountsKey(clubId ?? ''), 'links', playerId],
    queryFn: () => listPlayerLinks(clubId as string, playerId as string),
    enabled: Boolean(clubId && playerId),
    retry: false,
  })
}

function useRefreshAfterDecision(clubId: string) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: requestsKey(clubId) }),
      queryClient.invalidateQueries({ queryKey: accountsKey(clubId) }),
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'players'] }),
    ])
}

export function useApproveLinkRequest(clubId: string) {
  const refresh = useRefreshAfterDecision(clubId)
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ApproveLinkRequestInput }) => approveLinkRequest(clubId, id, input),
    onSuccess: refresh,
  })
}

export function useDeclineLinkRequest(clubId: string) {
  const refresh = useRefreshAfterDecision(clubId)
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => declineLinkRequest(clubId, id, note),
    onSuccess: refresh,
  })
}
