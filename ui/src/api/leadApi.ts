import { isAxiosError } from 'axios'
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

// docs/specs/149: one club by the slug in the address. 404 (unknown, inactive or malformed: the server answers all three the same)
// is null; any other failure (429, network, 5xx) throws so the caller can tell "does not exist" from "could not check".
export async function getClubBySlug(slug: string): Promise<ClubSummary | null> {
  try {
    const { data } = await api.get<ClubSummary>(`/public/clubs/by-slug/${encodeURIComponent(slug)}`)
    return data
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null
    throw error
  }
}
