import api from './axiosConfig'

// docs/specs/114-share-result.md (API Contract): the club-wide default for Initials only on a shared result. Its own small
// endpoint (not the club profile, whose PUT is a full replace that would reset it).
export interface ShareSettings {
  initialsOnlyDefault: boolean
}

export const shareSettingsKey = (clubId: string) => ['managed-club', clubId, 'share-settings'] as const

function shareSettingsPath(clubId: string): string {
  return `/manage/clubs/${clubId}/share-settings`
}

export async function getShareSettings(clubId: string): Promise<ShareSettings> {
  const { data } = await api.get<ShareSettings>(shareSettingsPath(clubId))
  return data
}

export async function updateShareSettings(clubId: string, settings: ShareSettings): Promise<ShareSettings> {
  const { data } = await api.put<ShareSettings>(shareSettingsPath(clubId), settings)
  return data
}
