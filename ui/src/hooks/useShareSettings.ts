import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getShareSettings, shareSettingsKey, updateShareSettings } from '../api/shareSettingsApi'
import type { ShareSettingsUpdate } from '../api/shareSettingsApi'

// docs/specs/114-share-result.md (Default and junior lock): the club default for Initials only. A failed read leaves
// `settings` undefined (the default is then off); the write updates the cached value so the switch follows at once.
export function useShareSettings(clubId: string | undefined, enabled = true) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: shareSettingsKey(clubId ?? ''),
    queryFn: () => getShareSettings(clubId as string),
    enabled: enabled && Boolean(clubId),
    retry: false,
  })
  const mutation = useMutation({
    mutationFn: (settings: ShareSettingsUpdate) => updateShareSettings(clubId as string, settings),
    onSuccess: (saved) => {
      queryClient.setQueryData(shareSettingsKey(clubId ?? ''), saved)
    },
  })
  return {
    settings: query.data,
    isLoading: query.isLoading,
    setInitialsOnlyDefault: (initialsOnlyDefault: boolean) => mutation.mutate({ initialsOnlyDefault }),
    // Administrators only (the server refuses anyone else); keeps the stored initials default.
    setDisabledFormats: (disabledFormats: Record<string, string[]>) =>
      mutation.mutate({ initialsOnlyDefault: query.data?.initialsOnlyDefault ?? false, disabledFormats }),
    disabledFormats: query.data?.disabledFormats ?? ({} as Record<string, string[]>),
    isSaving: mutation.isPending,
    saveFailed: mutation.isError,
  }
}
