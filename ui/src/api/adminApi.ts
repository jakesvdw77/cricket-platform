import api from './axiosConfig'

export interface AdminIdentity {
  keycloakUserId: string
  username: string
  email: string
}

export async function getAdminIdentity(): Promise<AdminIdentity> {
  const { data } = await api.get<AdminIdentity>('/platform/me')
  return data
}
