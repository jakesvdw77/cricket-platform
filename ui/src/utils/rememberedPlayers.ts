// docs/specs/077: the public availability form remembers who answered on this device, as a
// shortcut only. localStorage ONLY, every read and write in try/catch, a versioned key, and names
// only: never a date of birth, a token or a player id (see the type below, there is no field for
// them). Per club, so a shared device used for two clubs keeps them apart.

export const REMEMBERED_PLAYERS_KEY = 'cricketlegend.publicAvailability.players.v1'
export const MAX_REMEMBERED_PLAYERS = 10
export const MAX_ANSWERED_POLLS = 10
export const EXPIRY_MS = 365 * 24 * 60 * 60 * 1000

export interface RememberedPlayer {
  firstName: string
  lastName: string
  // ISO instant of last use, drives both ordering and the roughly one year expiry.
  lastUsedAt: string
  // pollId to ISO instant of the last answer, newest MAX_ANSWERED_POLLS polls only.
  answered: Record<string, string>
}

interface Store {
  version: 1
  clubs: Record<string, RememberedPlayer[]>
}

function emptyStore(): Store {
  return { version: 1, clubs: {} }
}

function isIso(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function sanitizePlayer(raw: unknown): RememberedPlayer | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  if (typeof p.firstName !== 'string' || typeof p.lastName !== 'string' || !isIso(p.lastUsedAt)) return null
  const answered: Record<string, string> = {}
  if (p.answered && typeof p.answered === 'object') {
    for (const [pollId, at] of Object.entries(p.answered as Record<string, unknown>)) {
      if (isIso(at)) answered[pollId] = at
    }
  }
  return { firstName: p.firstName, lastName: p.lastName, lastUsedAt: p.lastUsedAt, answered }
}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(REMEMBERED_PLAYERS_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as { version?: unknown; clubs?: unknown }
    if (parsed?.version !== 1 || !parsed.clubs || typeof parsed.clubs !== 'object') return emptyStore()
    const clubs: Record<string, RememberedPlayer[]> = {}
    for (const [clubId, list] of Object.entries(parsed.clubs as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue
      clubs[clubId] = list.map(sanitizePlayer).filter((p): p is RememberedPlayer => p !== null)
    }
    return { version: 1, clubs }
  } catch {
    return emptyStore()
  }
}

function writeStore(store: Store): void {
  try {
    localStorage.setItem(REMEMBERED_PLAYERS_KEY, JSON.stringify(store))
  } catch {
    // storage full or unavailable: remembering is a shortcut, never a requirement
  }
}

export function samePlayer(a: { firstName: string; lastName: string }, b: { firstName: string; lastName: string }): boolean {
  const norm = (value: string) => value.trim().toLowerCase()
  return norm(a.firstName) === norm(b.firstName) && norm(a.lastName) === norm(b.lastName)
}

function byRecency(a: RememberedPlayer, b: RememberedPlayer): number {
  return Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt)
}

function liveOnly(list: RememberedPlayer[], now: number): RememberedPlayer[] {
  return list.filter((p) => now - Date.parse(p.lastUsedAt) < EXPIRY_MS).sort(byRecency).slice(0, MAX_REMEMBERED_PLAYERS)
}

// Most recently used first; entries unused for about a year are dropped.
export function listRememberedPlayers(clubId: string, now: number = Date.now()): RememberedPlayer[] {
  return liveOnly(readStore().clubs[clubId] ?? [], now)
}

export function rememberPlayer(
  clubId: string,
  pollId: string,
  firstName: string,
  lastName: string,
  now: number = Date.now(),
): void {
  const first = firstName.trim()
  const last = lastName.trim()
  if (!first || !last) return
  const store = readStore()
  const stamp = new Date(now).toISOString()
  const list = liveOnly(store.clubs[clubId] ?? [], now)
  const existing = list.find((p) => samePlayer(p, { firstName: first, lastName: last }))
  const answered = { ...(existing?.answered ?? {}), [pollId]: stamp }
  const newest = Object.entries(answered)
    .sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]))
    .slice(0, MAX_ANSWERED_POLLS)
  const entry: RememberedPlayer = {
    firstName: first,
    lastName: last,
    lastUsedAt: stamp,
    answered: Object.fromEntries(newest),
  }
  const rest = list.filter((p) => p !== existing)
  store.clubs[clubId] = liveOnly([entry, ...rest], now)
  writeStore(store)
}

export function removeRememberedPlayer(
  clubId: string,
  player: { firstName: string; lastName: string },
  now: number = Date.now(),
): void {
  const store = readStore()
  store.clubs[clubId] = liveOnly(store.clubs[clubId] ?? [], now).filter((p) => !samePlayer(p, player))
  writeStore(store)
}

// "Forget this device": clears this club's players only.
export function forgetClub(clubId: string): void {
  const store = readStore()
  delete store.clubs[clubId]
  writeStore(store)
}
