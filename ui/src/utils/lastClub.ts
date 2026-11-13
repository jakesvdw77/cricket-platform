// The club a visitor last picked on the landing page (device memory, a convenience only: never a permission and never sent anywhere).
export const LAST_CLUB_KEY = 'login:lastClub'

export interface LastClub {
  slug: string
  name: string
}

export function readLastClub(): LastClub | null {
  try {
    const raw = window.localStorage.getItem(LAST_CLUB_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LastClub> | null
    return parsed && typeof parsed.slug === 'string' && typeof parsed.name === 'string' ? { slug: parsed.slug, name: parsed.name } : null
  } catch {
    return null
  }
}

export function rememberClub(club: LastClub) {
  try {
    window.localStorage.setItem(LAST_CLUB_KEY, JSON.stringify({ slug: club.slug, name: club.name }))
  } catch {
    // Storage unavailable or full: the memory is a convenience, never a requirement.
  }
}

export function forgetClub() {
  try {
    window.localStorage.removeItem(LAST_CLUB_KEY)
  } catch {
    // Storage unavailable: nothing to forget.
  }
}
