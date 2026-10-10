import { useEffect, useState } from 'react'
import { AUTH_AWARE_PATH_PREFIXES, keycloak, keycloakInitPromise } from './keycloak'

// Seam so tests can assert the navigation without jsdom's non-configurable window.location.
export const navigation = {
  replace: (url: string) => window.location.replace(url),
}

let redirecting = false

// True on pages that need a resolved Keycloak session (/admin, /manage). Public pages and
// /post-login are deliberately excluded: they must never be redirected by an auth failure.
export function isAuthAwarePath(): boolean {
  return AUTH_AWARE_PATH_PREFIXES.some((prefix) => window.location.pathname.startsWith(prefix))
}

// Expired or missing session on an authenticated page: drop the stale token and do a full
// navigation to the landing page so no stale in-memory state survives. Runs once per page load.
export function redirectToLanding(): void {
  if (redirecting) return
  redirecting = true
  keycloak.clearToken()
  navigation.replace('/')
}

// Test helper: the once-per-page-load guard is module state.
export function resetSessionExpiryForTests(): void {
  redirecting = false
}

// True once keycloak.init() has settled (resolved or rejected), so guards can read
// keycloak.authenticated without a blank flash or a false "Not authorized".
export function useKeycloakSettled(): boolean {
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    let active = true
    keycloakInitPromise
      .catch(() => undefined)
      .then(() => {
        if (active) setSettled(true)
      })
    return () => {
      active = false
    }
  }, [])
  return settled
}
