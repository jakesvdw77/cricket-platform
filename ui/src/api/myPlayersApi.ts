import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './axiosConfig'
import type { BattingStance, BowlingArm, BowlingType } from './playerApi'
import type { PublicAnswer, PublicAnswers } from './publicAvailabilityShared'
import type { PublicRoundWindow } from './publicSectionAvailabilityApi'

// docs/specs/119 Part 3 (3C): "Player Hub", what an agent (or a player for their own record) sees and does.
// Backend: /api/v1/me/players/**, authorised only from the caller's own active links and own player record.
export interface MyPlayerSummary {
  key: string
  firstName: string
  lastName: string
  photoUrl: string | null
  clubId: string
  clubName: string
  groupLabel: string | null
  self: boolean
  main: boolean
}

export interface MyPlayerAgent {
  linkId: string
  name: string
  maskedEmail: string
  main: boolean
  status: 'ACTIVE' | 'INVITED'
}

export interface MyPlayer extends MyPlayerSummary {
  sectionNames: string[]
  teamNames: string[]
  jerseyNumber: number | null
  canEditMedical: boolean
  // yyyy-MM-dd; editable by the main agent or the adult player only.
  dateOfBirth: string | null
  canEditDateOfBirth: boolean
  phone: string | null
  email: string | null
  altContactName: string | null
  altContactPhone: string | null
  battingStance: BattingStance | null
  bowlingArm: BowlingArm | null
  bowlingType: BowlingType | null
  isWicketKeeper: boolean
  medicalAidProvider: string | null
  medicalAidMemberNumber: string | null
  agentCount: number
  // Only the main agent may hand over, add agents or cancel invitations.
  canManageAgents: boolean
  // The caller's own link id, needed to leave. Not in the agreed contract yet; Leave is hidden while it is absent.
  myLinkId?: string | null
  // Only filled for the main agent.
  agents: MyPlayerAgent[]
}

export interface UpdateMyPlayerRequest {
  photoUrl: string | null
  // Echo the stored value when not editing or not allowed.
  dateOfBirth: string | null
  phone: string | null
  email: string | null
  altContactName: string | null
  altContactPhone: string | null
  battingStance: BattingStance | null
  bowlingArm: BowlingArm | null
  bowlingType: BowlingType | null
  isWicketKeeper: boolean
  medicalAidProvider: string | null
  medicalAidMemberNumber: string | null
}

export interface MyPoll {
  pollId: string
  kind: 'SQUAD' | 'GROUP'
  title: string
  teamName: string | null
  sectionName: string | null
  homeName: string | null
  awayName: string | null
  matchDate: string | null
  venue: string | null
  scheduledCloseAt: string | null
  windows: PublicRoundWindow[]
  answers: PublicAnswer[]
}

export async function listMyPlayers(): Promise<MyPlayerSummary[]> {
  const { data } = await api.get<MyPlayerSummary[]>('/me/players')
  return data
}

export async function getMyPlayer(key: string): Promise<MyPlayer> {
  const { data } = await api.get<MyPlayer>(`/me/players/${key}`)
  return data
}

export async function updateMyPlayer(key: string, body: UpdateMyPlayerRequest): Promise<MyPlayer> {
  const { data } = await api.put<MyPlayer>(`/me/players/${key}`, body)
  return data
}

export async function listMyPlayerPolls(key: string): Promise<MyPoll[]> {
  const { data } = await api.get<MyPoll[]>(`/me/players/${key}/polls`)
  return data
}

export async function saveMyPlayerPollAnswers(key: string, pollId: string, answers: PublicAnswer[]): Promise<PublicAnswers> {
  const { data } = await api.put<PublicAnswers>(`/me/players/${key}/polls/${pollId}/answers`, { answers })
  return data
}

export const myPlayersKey = ['me', 'players'] as const

export function useMyPlayers(enabled = true) {
  return useQuery({ queryKey: myPlayersKey, queryFn: listMyPlayers, enabled, retry: false })
}

export function useMyPlayer(key: string | undefined) {
  return useQuery({ queryKey: [...myPlayersKey, key], queryFn: () => getMyPlayer(key as string), enabled: Boolean(key), retry: false })
}

export function useUpdateMyPlayer(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateMyPlayerRequest) => updateMyPlayer(key, body),
    onSuccess: (data) => {
      queryClient.setQueryData([...myPlayersKey, key], data)
      return queryClient.invalidateQueries({ queryKey: myPlayersKey, exact: true })
    },
  })
}

export function useMyPlayerPolls(key: string | undefined) {
  return useQuery({ queryKey: [...myPlayersKey, key, 'polls'], queryFn: () => listMyPlayerPolls(key as string), enabled: Boolean(key), retry: false })
}

export function useSaveMyPlayerPollAnswers(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ pollId, answers }: { pollId: string; answers: PublicAnswer[] }) => saveMyPlayerPollAnswers(key, pollId, answers),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...myPlayersKey, key, 'polls'] }),
  })
}

export async function inviteMyPlayerAgent(key: string, body: { email: string; mode: 'HANDOVER' | 'ADD' }): Promise<void> {
  await api.post(`/me/players/${key}/agents`, body)
}

export function useInviteAgent(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { email: string; mode: 'HANDOVER' | 'ADD' }) => inviteMyPlayerAgent(key, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...myPlayersKey, key] }),
  })
}
