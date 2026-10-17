import type { ShareSettings } from '../../api/shareSettingsApi'
import type { JuniorMatchResult } from '../../utils/share/isJuniorMatch'
import type { ShareChoices } from '../../utils/share/shareChoices'

// docs/specs/114-share-result.md (Default and junior lock): the ONE Initials only value every format reads.
export const JUNIOR_LOCK_REASON = 'Always on for junior leagues'
export const UNAVAILABLE_LOCK_REASON = 'Could not check the league, so Initials only is on'

export interface ShareInitialsState {
  value: boolean
  locked: boolean
  // The visible reason when locked.
  lockReason: string | null
  setValue: (next: boolean) => void
  // The club-wide default and how to change it.
  clubDefault: boolean
  setClubDefault: (next: boolean) => void
  clubDefaultSaving: boolean
  clubDefaultFailed: boolean
}

interface Input {
  choices: ShareChoices
  updateChoices: (next: Partial<ShareChoices>) => void
  junior: JuniorMatchResult
  settings: ShareSettings | undefined
  setClubDefault: (next: boolean) => void
  clubDefaultSaving: boolean
  clubDefaultFailed: boolean
}

// A junior match is locked on whatever was remembered or set as the club default; otherwise the remembered choice on this
// device wins, then the club default, then off.
export function resolveShareInitials({ choices, updateChoices, junior, settings, setClubDefault, clubDefaultSaving, clubDefaultFailed }: Input): ShareInitialsState {
  const locked = junior.junior
  return {
    value: locked ? true : (choices.initialsOnly ?? settings?.initialsOnlyDefault ?? false),
    locked,
    lockReason: locked ? (junior.reason === 'UNAVAILABLE' ? UNAVAILABLE_LOCK_REASON : JUNIOR_LOCK_REASON) : null,
    setValue: (next) => {
      if (!locked) updateChoices({ initialsOnly: next })
    },
    clubDefault: settings?.initialsOnlyDefault ?? false,
    setClubDefault,
    clubDefaultSaving,
    clubDefaultFailed,
  }
}
