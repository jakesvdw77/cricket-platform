import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './axiosConfig'
import { leaderboardKeys } from './leaderboardApi'

// docs/specs/103-player-stats.md decision 18: which award categories the club's Awards view shows, stored per club
// (GET and PUT /leaderboard-settings, mirroring 114's share-settings). Mirrors LeaderboardSettingsDto.
export interface LeaderboardSettings {
  // the codes shown now (the nine defaults when the club never chose)
  awardCategories: string[]
  // every code a club may pick, defaults included; sent on the response, ignored on the request
  selectableCategories: string[]
}

export const leaderboardSettingsKey = (clubId: string) => ['managed-club', clubId, 'leaderboard-settings'] as const

const settingsPath = (clubId: string) => `/manage/clubs/${clubId}/leaderboard-settings`

export async function getLeaderboardSettings(clubId: string): Promise<LeaderboardSettings> {
  const { data } = await api.get<LeaderboardSettings>(settingsPath(clubId))
  return data
}

export async function updateLeaderboardSettings(clubId: string, awardCategories: string[]): Promise<LeaderboardSettings> {
  const { data } = await api.put<LeaderboardSettings>(settingsPath(clubId), { awardCategories })
  return data
}

export function useLeaderboardSettings(clubId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: leaderboardSettingsKey(clubId as string),
    queryFn: () => getLeaderboardSettings(clubId as string),
    enabled: Boolean(clubId) && enabled,
  })
}

// Saving the choice refreshes the awards view (a different set of categories) and the settings themselves.
export function useSaveLeaderboardSettings(clubId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (awardCategories: string[]) => updateLeaderboardSettings(clubId as string, awardCategories),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: leaderboardKeys.awardsAll(clubId as string) }),
        queryClient.invalidateQueries({ queryKey: leaderboardSettingsKey(clubId as string) }),
      ])
    },
  })
}
