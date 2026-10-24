import { useLocation, useNavigate } from 'react-router-dom'
import { useMyProfiles } from '../api/meApi'
import type { ProfileSwitchItem } from '../components/ProfileSwitcher'
import { activeProfileKey, openProfile, profileKey } from '../utils/activeProfile'

// docs/specs/119 slice 4: the switcher's items, or undefined unless the person has more than one profile card (never blocks a menu).
export function useProfileSwitch(): ProfileSwitchItem[] | undefined {
  const profiles = useMyProfiles().data
  const navigate = useNavigate()
  const { pathname } = useLocation()
  if (!profiles || profiles.length < 2) return undefined
  const active = activeProfileKey(pathname, profiles)
  return profiles.map((profile) => ({
    key: profileKey(profile),
    title: profile.title,
    subtitle: profile.subtitle ?? profile.clubName ?? null,
    active: profileKey(profile) === active,
    onChoose: () => openProfile(profile, navigate),
  }))
}
