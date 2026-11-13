import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getHubSettings, hubSettingsKey, updateHubSettings } from '../api/hubSettingsApi'
import type { HubSettings } from '../api/hubSettingsApi'

// docs/specs/148 (Manager side): the Player Hub switches. Each toggle saves the whole set; turning the directory off also turns its
// phone and email columns off. The write updates the cached value so the chips follow at once.
export function useHubSettings(clubId: string | undefined, enabled = true) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: hubSettingsKey(clubId ?? ''),
    queryFn: () => getHubSettings(clubId as string),
    enabled: enabled && Boolean(clubId),
    retry: false,
  })
  const mutation = useMutation({
    mutationFn: (settings: HubSettings) => updateHubSettings(clubId as string, settings),
    onSuccess: (saved) => {
      queryClient.setQueryData(hubSettingsKey(clubId ?? ''), saved)
    },
  })
  return {
    settings: query.data,
    isLoading: query.isLoading,
    setSettings: (next: HubSettings) => mutation.mutate(next.directoryShown ? next : { ...next, directoryPhoneShown: false, directoryEmailShown: false }),
    isSaving: mutation.isPending,
    saveFailed: mutation.isError,
    saveError: mutation.error,
  }
}
