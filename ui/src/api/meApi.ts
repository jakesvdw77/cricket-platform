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
