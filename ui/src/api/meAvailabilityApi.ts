import { keepPreviousData, useQuery } from '@tanstack/react-query'
import api from './axiosConfig'
import { myPlayersKey } from './myPlayersApi'

// Player Hub Availability sub-menus (Closed Polls, My Responses), mirroring MyClosedPollsDto, MyPollResponsesDto and MyPollHistoryRowDto.
// Backend: GET /api/v1/me/players/{playerKey}/polls/closed and /polls/responses, authorised by the caller's own active link.

export type MyPollAnswerStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'UNSURE'
// The status filter adds the fourth state.
export type MyPollStatusFilter = MyPollAnswerStatus | 'NOT_ANSWERED'

export interface MyPollHistoryAnswer {
  windowId: string | null
  label: string | null
  status: MyPollAnswerStatus
}

export interface MyPollHistoryRow {
  pollId: string
  kind: 'SQUAD' | 'GROUP'
  title: string
  teamName: string | null
  matchDate: string | null
  homeName: string | null
  awayName: string | null
  venue: string | null
  windowDate: string[] | null
  open: boolean
  closedAt: string | null
  answers: MyPollHistoryAnswer[]
  answered: boolean
  // true / false once the club has announced the selection; null before that or for a poll with no selection.
  selected: boolean | null
}

export interface MyClosedPolls {
  sinceDays: number
  total: number
  rows: MyPollHistoryRow[]
}

export interface MyPollResponsesSummary {
  polls: number
  answered: number
  available: number
  unavailable: number
  notSure: number
  notAnswered: number
}

export interface MyPollResponses {
  scope: { seasonId: string | null }
  seasons: Array<{ id: string; label: string }>
  currentSeasonId: string | null
  summary: MyPollResponsesSummary
  rows: MyPollHistoryRow[]
}

export interface MyClosedPollsQuery {
  sinceDays?: number
  status?: MyPollStatusFilter | null
}

export interface MyPollResponsesQuery {
  seasonId?: string | null
  status?: MyPollStatusFilter | null
}

export async function getMyClosedPolls(key: string, query: MyClosedPollsQuery): Promise<MyClosedPolls> {
  const { data } = await api.get<MyClosedPolls>(`/me/players/${key}/polls/closed`, {
    params: { sinceDays: query.sinceDays ?? 30, ...(query.status && { status: query.status }) },
  })
  return data
}

export async function getMyPollResponses(key: string, query: MyPollResponsesQuery): Promise<MyPollResponses> {
  const { data } = await api.get<MyPollResponses>(`/me/players/${key}/polls/responses`, {
    params: { ...(query.seasonId && { seasonId: query.seasonId }), ...(query.status && { status: query.status }) },
  })
  return data
}

export function useMyClosedPolls(key: string | undefined, query: MyClosedPollsQuery = {}, enabled = true) {
  return useQuery({
    queryKey: [...myPlayersKey, key, 'polls', 'closed', query.sinceDays ?? 30, query.status ?? ''],
    queryFn: () => getMyClosedPolls(key as string, query),
    enabled: Boolean(key) && enabled,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

export function useMyPollResponses(key: string | undefined, query: MyPollResponsesQuery = {}, enabled = true) {
  return useQuery({
    queryKey: [...myPlayersKey, key, 'polls', 'responses', query.seasonId ?? '', query.status ?? ''],
    queryFn: () => getMyPollResponses(key as string, query),
    enabled: Boolean(key) && enabled,
    placeholderData: keepPreviousData,
    retry: false,
  })
}
