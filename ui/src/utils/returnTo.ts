// docs/specs/127-return-navigation.md: the origin of a page travels in the address as two query parameters on the destination,
// `returnTo` (the origin's path and query) and `returnLabel` (a short plain-text name for it). Only an in-app /manage/ or /admin/
// path is ever followed; the guard rules extend utils/backTarget.ts (which stays as the legacy router-state fallback).
export const RETURN_TO_PARAM = 'returnTo'
export const RETURN_LABEL_PARAM = 'returnLabel'

export interface ReturnOrigin {
  to: string
  label: string | null
}

const MAX_RETURN_TO = 512
const MAX_RETURN_LABEL = 60
// Control characters are found by code, not by a regular expression, so the check stays readable and lint-clean.
function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127
  })
}

function stripControlCharacters(value: string): string {
  return Array.from(value).map((character) => (hasControlCharacter(character) ? ' ' : character)).join('')
}
const ENCODED_UNSAFE = /%(2f|5c|00|0a|0d|09|2e%2e)/i

function isSafePath(path: string): boolean {
  if (!(path.startsWith('/manage/') || path.startsWith('/admin/'))) return false
  if (path.startsWith('//') || path.includes('\\') || hasControlCharacter(path)) return false
  if (path.includes('://')) return false
  const pathOnly = path.split(/[?#]/)[0]
  return !pathOnly.split('/').some((segment) => segment === '..' || segment === '.')
}

// Returns the already-decoded in-app path, or null. Double-encoded variants (%2F, %5C, control codes written as escapes in the path
// part) and anything that is not a /manage/ or /admin/ path are rejected.
export function safeReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_RETURN_TO) return null
  if (!isSafePath(value)) return null
  const pathOnly = value.split(/[?#]/)[0]
  if (ENCODED_UNSAFE.test(pathOnly)) return null
  try {
    // A second decoding must not turn it into something unsafe either.
    const decodedAgain = decodeURIComponent(value)
    if (!isSafePath(decodedAgain)) return null
  } catch {
    return null
  }
  return value
}

export function safeReturnLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const label = value.trim()
  if (!label || label.length > MAX_RETURN_LABEL || hasControlCharacter(label)) return null
  return label
}

// The current page as an origin: path and query, minus any returnTo it was itself given (only one step back is kept).
export function currentOrigin(location: { pathname: string; search?: string }): string {
  const params = new URLSearchParams(location.search ?? '')
  params.delete(RETURN_TO_PARAM)
  params.delete(RETURN_LABEL_PARAM)
  const query = params.toString()
  return query ? `${location.pathname}?${query}` : location.pathname
}

// Adds returnTo and returnLabel to a destination, keeping its own params. An origin that fails the guard leaves the destination
// unchanged. The origin is `currentOrigin(location)` plus a label, or an `{ to, label }` object.
export function withReturnTo(destination: string, origin: string | { to: string; label?: string | null }, label?: string): string {
  const to = typeof origin === 'string' ? origin : origin.to
  const rawLabel = typeof origin === 'string' ? label : (origin.label ?? label)
  if (!safeReturnTo(to)) return destination
  const hashIndex = destination.indexOf('#')
  const hash = hashIndex >= 0 ? destination.slice(hashIndex) : ''
  const beforeHash = hashIndex >= 0 ? destination.slice(0, hashIndex) : destination
  const queryIndex = beforeHash.indexOf('?')
  const path = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash
  const params = new URLSearchParams(queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '')
  params.delete(RETURN_TO_PARAM)
  params.delete(RETURN_LABEL_PARAM)
  params.set(RETURN_TO_PARAM, to)
  const cleanLabel = stripControlCharacters(rawLabel ?? '').trim().slice(0, MAX_RETURN_LABEL).trim()
  if (cleanLabel) params.set(RETURN_LABEL_PARAM, cleanLabel)
  return `${path}?${params.toString()}${hash}`
}

const LEAGUE_SCHEDULE_PATH = /^\/manage\/fixtures\/leagues\/[^/?#]+\/schedule(?:[?#]|$)/

export function isLeagueSchedulePath(path: string): boolean {
  return LEAGUE_SCHEDULE_PATH.test(path)
}

// Where a successful Save or Delete goes: the origin when there is one, else the page's own default. A league Schedule origin gets
// showAll=1 when the saved match is in the past, so the new match is not hidden by the upcoming-only default.
export function afterSaveTarget(origin: { to: string } | null, options: { defaultTo: string; showAll?: boolean }): string {
  if (!origin) return options.defaultTo
  if (options.showAll && isLeagueSchedulePath(origin.to)) {
    const hashIndex = origin.to.indexOf('#')
    const hash = hashIndex >= 0 ? origin.to.slice(hashIndex) : ''
    const beforeHash = hashIndex >= 0 ? origin.to.slice(0, hashIndex) : origin.to
    const queryIndex = beforeHash.indexOf('?')
    const path = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash
    const params = new URLSearchParams(queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '')
    params.set('showAll', '1')
    return `${path}?${params.toString()}${hash}`
  }
  return origin.to
}
