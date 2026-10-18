import { useMemo } from 'react'
import { DEFAULT_SHARE_CHOICES, mergeShareChoices, sanitiseShareChoices, shareChoicesKey } from '../utils/share/shareChoices'
import type { ShareChoices, ShareChoicesPatch } from '../utils/share/shareChoices'
import { usePersistedListFilters } from './usePersistedListFilters'

// docs/specs/114-share-result.md (Browser storage): the manager's remembered choices for this club on this device. What
// comes out of storage is always sanitised, so a corrupt or old value can never reach a screen. `update` merges the
// keys given onto the LATEST stored value, nested objects key by key, so pass only what changed
// (e.g. { include: { image: { venueAndDate: false } } }) and two quick changes in different formats cannot lose one.
export function useShareChoices(clubId: string): [ShareChoices, (next: ShareChoicesPatch) => void] {
  const [stored, update] = usePersistedListFilters<ShareChoices>(shareChoicesKey(clubId), DEFAULT_SHARE_CHOICES)
  const choices = useMemo(() => sanitiseShareChoices(stored), [stored])
  const patch = (next: ShareChoicesPatch) => update((previous) => mergeShareChoices(sanitiseShareChoices(previous), next))
  return [choices, patch]
}
