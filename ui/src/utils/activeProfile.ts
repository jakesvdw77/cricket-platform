import type { Profile } from '../api/meApi'

// docs/specs/119 slice 4 (Decisions 7, 25 and 29): which profile card is loaded, the optional "remember my choice on this
// device" and how a card is opened. The hat is not a permission: the server never reads it, it only decides what the UI shows.
const REMEMBER_KEY = 'profile:remembered'
const ACTIVE_CLUB_KEY = 'profile:activeClub'
const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN ?? 'localhost:5173'

export const profileKey = (p: Pick<Profile, 'kind' | 'clubId'>) => `${p.kind}:${p.clubId ?? ''}`

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Storage unavailable: the choice just is not remembered.
  }
}

export const getRememberedProfileKey = () => read(REMEMBER_KEY)
export const setRememberedProfileKey = (key: string | null) => write(REMEMBER_KEY, key)

// The club slug in the current address, or null on the root domain.
export function currentClubSlug(): string | null {
  const root = ROOT_DOMAIN.split(':')[0]
  const host = window.location.hostname
  return host.endsWith(`.${root}`) ? host.slice(0, -(root.length + 1)) : null
}

// Which club the manager shell loads: the club of the address, else the last chosen manager card, else the first one.
export function resolveManagerClubId(profiles: Profile[] | undefined, clubAdminClubIds: string[] | undefined): string | undefined {
  const managers = (profiles ?? []).filter((p) => p.kind === 'MANAGER' && p.clubId)
  const slug = currentClubSlug()
  const bySlug = slug ? managers.find((p) => p.clubSlug === slug) : undefined
  if (bySlug?.clubId) return bySlug.clubId
  const stored = read(ACTIVE_CLUB_KEY)
  const known = (id: string | null) => Boolean(id) && (managers.some((p) => p.clubId === id) || (clubAdminClubIds ?? []).includes(id as string))
  if (known(stored)) return stored as string
  return managers[0]?.clubId ?? clubAdminClubIds?.[0]
}

export function activeProfileKey(pathname: string, profiles: Profile[], clubAdminClubIds?: string[]): string | null {
  if (pathname.startsWith('/account')) return 'MY_PLAYERS:'
  if (pathname.startsWith('/admin')) return 'PLATFORM_ADMIN:'
  if (pathname.startsWith('/manage')) {
    const clubId = resolveManagerClubId(profiles, clubAdminClubIds)
    return clubId ? `MANAGER:${clubId}` : null
  }
  return null
}

// Opens a card. A manager card of another club goes to that club's subdomain (the Keycloak session makes sign-in silent);
// everything else swaps in place.
export function openProfile(profile: Profile, navigate: (to: string) => void, remember = false) {
  if (profile.kind === 'MANAGER') write(ACTIVE_CLUB_KEY, profile.clubId ?? null)
  if (remember) setRememberedProfileKey(profileKey(profile))
  const slug = currentClubSlug()
  if (profile.kind === 'MANAGER' && profile.clubSlug && slug && slug !== profile.clubSlug) {
    window.location.assign(`${window.location.protocol}//${profile.clubSlug}.${ROOT_DOMAIN}${profile.landing}`)
    return
  }
  navigate(profile.landing)
}
