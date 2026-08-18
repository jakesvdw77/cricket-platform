import api from './axiosConfig'

export interface SubmitLeadPayload {
  name: string
  email: string
  clubName: string
  phone?: string
  message?: string
}

export interface ClubSummary {
  id: string
  name: string
  slug: string
}

export async function submitLead(payload: SubmitLeadPayload): Promise<void> {
  await api.post('/leads', payload)
}

export async function searchClubs(query: string): Promise<ClubSummary[]> {
  const { data } = await api.get<ClubSummary[]>('/public/clubs', {
    params: { query },
  })
  return data
}
