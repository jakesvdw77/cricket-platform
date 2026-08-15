import api from './axiosConfig'

export interface MatchSummary {
  id: string
  opponent: string
  scheduledAt: string
}

export async function fetchUpcomingMatches(): Promise<MatchSummary[]> {
  const { data } = await api.get<MatchSummary[]>('/matches/upcoming')
  return data
}
