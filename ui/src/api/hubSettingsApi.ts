import api from './axiosConfig'

// docs/specs/148-player-hub-club-info.md (API Contract): the club's switches for what parents and players see in the Player Hub.
// Its own small endpoint (not the club profile). Club administrators only; the PUT is a full replace of the eight switches.
export interface HubSettings {
  identityShown: boolean
  contactShown: boolean
  linksShown: boolean
  logosShown: boolean
  logoDownloadAllowed: boolean
  directoryShown: boolean
  directoryPhoneShown: boolean
  directoryEmailShown: boolean
}

export const hubSettingsKey = (clubId: string) => ['managed-club', clubId, 'hub-settings'] as const

function hubSettingsPath(clubId: string): string {
  return `/manage/clubs/${clubId}/hub-settings`
}

export async function getHubSettings(clubId: string): Promise<HubSettings> {
  const { data } = await api.get<HubSettings>(hubSettingsPath(clubId))
  return data
}

export async function updateHubSettings(clubId: string, settings: HubSettings): Promise<HubSettings> {
  const { data } = await api.put<HubSettings>(hubSettingsPath(clubId), settings)
  return data
}
