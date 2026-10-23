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
