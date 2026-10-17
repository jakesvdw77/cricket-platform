import { useMemo } from 'react'
import { DEFAULT_SHARE_CHOICES, sanitiseShareChoices, shareChoicesKey } from '../utils/share/shareChoices'
import type { ShareChoices } from '../utils/share/shareChoices'
import { usePersistedListFilters } from './usePersistedListFilters'

// docs/specs/114-share-result.md (Browser storage): the manager's remembered choices for this club on this device. What
// comes out of storage is always sanitised, so a corrupt or old value can never reach a screen. `update` merges the
// top-level keys given (pass a whole nested object, e.g. include, when changing one switch in it).
export function useShareChoices(clubId: string): [ShareChoices, (next: Partial<ShareChoices>) => void] {
  const [stored, update] = usePersistedListFilters<ShareChoices>(shareChoicesKey(clubId), DEFAULT_SHARE_CHOICES)
  const choices = useMemo(() => sanitiseShareChoices(stored), [stored])
  return [choices, update]
}
